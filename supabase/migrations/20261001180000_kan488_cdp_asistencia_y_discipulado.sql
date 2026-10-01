-- KAN-488 (decisiones owner 2026-10-01):
--  1) fn_listar_cdp_asistencia: listado de Casas de Paz para el picker de CdP
--     de la Membresía desde 0 -- incluye las CdP de la iglesia Y las de sus
--     iglesias satélite/hijas (iglesia_padre_id), con Red e iglesia para poder
--     agrupar por Red y buscar. Reemplaza al modo "elegir de la lista" simple.
--  2) fn_guardar_membresia_nuevos: ahora persiste el discipulado como NIVEL
--     (curso real, persona_detalle.discipulado_nivel, no un sí/no); acepta
--     CdPs de iglesias satélite en modo LISTA; y la membresía de CdP se crea
--     con la iglesia REAL de la CdP (no siempre la madre).

-- 1) Listado de CdP para asignar/elegir (iglesia + satélites), agrupable por Red.
CREATE OR REPLACE FUNCTION public.fn_listar_cdp_asistencia(p_iglesia_id uuid)
 RETURNS TABLE(casa_de_paz_id uuid, casa_de_paz_etiqueta text, red_id uuid,
               red_nombre text, iglesia_id uuid, iglesia_nombre text, es_satelite boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    r.id,
    r.nombre::text,
    ig.id,
    ig.nombre::text,
    (ig.id <> p_iglesia_id)
  FROM casa_de_paz cdp
  JOIN iglesia ig ON ig.id = cdp.iglesia_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE (cdp.iglesia_id = p_iglesia_id OR ig.iglesia_padre_id = p_iglesia_id)
    AND cdp.activo
    AND cdp.fecha_eliminacion IS NULL
    AND ig.fecha_eliminacion IS NULL
  ORDER BY (ig.id = p_iglesia_id) DESC, ig.nombre, r.nombre NULLS LAST, fn_etiqueta_cdp(cdp.id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_listar_cdp_asistencia(uuid) TO authenticated;

-- 2) Guardado final actualizado: discipulado por nivel + CdP de satélite permitida.
CREATE OR REPLACE FUNCTION public.fn_guardar_membresia_nuevos(p_iglesia_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_persona_id      uuid;
  v_cdp_modo        text := p_payload->>'cdp_modo';
  v_invitador_id    uuid := NULLIF(p_payload->>'invitador_persona_id', '')::uuid;
  v_casa_de_paz_id  uuid := NULLIF(p_payload->>'casa_de_paz_id', '')::uuid;
  v_es_visita       boolean := COALESCE((p_payload->>'es_visita')::boolean, false);
  v_invitado_por_id uuid;
  v_motivo_id       uuid;
  v_direccion       text := NULLIF(trim(p_payload->>'direccion'), '');
  v_direccion_id    uuid;
  v_cdp_iglesia_id  uuid;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_payload->>'primer_nombre', '') = ''
     OR COALESCE(p_payload->>'primer_apellido', '') = ''
     OR COALESCE(p_payload->>'sexo', '') = '' THEN
    RAISE EXCEPTION 'MEMBRESIA_DATOS_INCOMPLETOS: faltan nombre, apellido o sexo'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                       sexo, fecha_nacimiento, ci, correo)
  VALUES (p_iglesia_id, p_payload->>'primer_nombre', NULLIF(p_payload->>'segundo_nombre', ''),
          p_payload->>'primer_apellido', NULLIF(p_payload->>'segundo_apellido', ''),
          (p_payload->>'sexo')::sexo_enum, NULLIF(p_payload->>'fecha_nacimiento', '')::date,
          NULLIF(p_payload->>'ci', ''), NULLIF(p_payload->>'correo', ''))
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion,
                               bautizado, bautizado_en_nuestra_iglesia, discipulado_nivel)
  VALUES (v_persona_id,
          NULLIF(p_payload->>'estado_civil', '')::estado_civil_enum,
          NULLIF(p_payload->>'grado_instruccion', '')::grado_instruccion_enum,
          NULLIF(p_payload->>'ocupacion', ''),
          CASE WHEN p_payload->>'bautizado' = 'true' THEN true
               WHEN p_payload->>'bautizado' = 'false' THEN false
               ELSE NULL END,
          CASE WHEN p_payload->>'bautizado_en_nuestra_iglesia' = 'true' THEN true ELSE NULL END,
          NULLIF(p_payload->>'discipulado_nivel', '')::discipulado_nivel_enum);

  PERFORM fn_guardar_telefono_membresia(v_persona_id, p_iglesia_id, NULLIF(p_payload->>'telefono', ''));

  IF v_direccion IS NOT NULL THEN
    INSERT INTO direccion (iglesia_id, calle) VALUES (p_iglesia_id, v_direccion)
    RETURNING id INTO v_direccion_id;
    INSERT INTO direccion_asignacion (iglesia_id, direccion_id, persona_id, es_principal)
    VALUES (p_iglesia_id, v_direccion_id, v_persona_id, true);
  END IF;

  -- Casa de Paz según modo. La LISTA ahora puede ser una CdP de la iglesia O
  -- de una satélite/hija (iglesia_padre_id = p_iglesia_id).
  IF v_cdp_modo = 'INVITADOR' AND v_invitador_id IS NOT NULL THEN
    v_invitado_por_id := v_invitador_id;
    SELECT casa_de_paz_id INTO v_casa_de_paz_id
    FROM casa_de_paz_membresia
    WHERE persona_id = v_invitador_id AND es_principal
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
    LIMIT 1;
  ELSIF v_cdp_modo = 'LISTA' AND v_casa_de_paz_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM casa_de_paz cdp JOIN iglesia ig ON ig.id = cdp.iglesia_id
      WHERE cdp.id = v_casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
        AND (cdp.iglesia_id = p_iglesia_id OR ig.iglesia_padre_id = p_iglesia_id)
    ) THEN
      RAISE EXCEPTION 'MEMBRESIA_CDP_INVALIDA: la Casa de Paz no pertenece a esta iglesia ni a sus satélites'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_casa_de_paz_id := NULL;
  END IF;

  SELECT id INTO v_motivo_id FROM motivo_llegada
  WHERE codigo = CASE WHEN v_invitado_por_id IS NOT NULL THEN 'INVITACION_PERSONAL' ELSE 'OTRO' END;
  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                               invitado_por_id, comentarios)
  VALUES (p_iglesia_id, v_persona_id, v_motivo_id, CURRENT_DATE, v_invitado_por_id,
          NULLIF(trim(p_payload->>'como_llego'), ''));

  -- Membresía de CdP con la iglesia REAL de la CdP (puede ser una satélite).
  IF v_casa_de_paz_id IS NOT NULL THEN
    SELECT iglesia_id INTO v_cdp_iglesia_id FROM casa_de_paz WHERE id = v_casa_de_paz_id;
    INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
    VALUES (COALESCE(v_cdp_iglesia_id, p_iglesia_id), v_casa_de_paz_id, v_persona_id, true, CURRENT_DATE);
  END IF;

  PERFORM fn_transicionar_estado(
    v_persona_id,
    CASE WHEN v_es_visita THEN 'SIM' ELSE 'NC' END,
    CURRENT_DATE, 'Membresía desde 0', false);

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_id', v_casa_de_paz_id,
    'sin_casa_de_paz', v_casa_de_paz_id IS NULL
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_guardar_membresia_nuevos(uuid, jsonb) TO authenticated;
