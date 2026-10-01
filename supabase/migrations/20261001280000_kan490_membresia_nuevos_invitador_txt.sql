-- KAN-490: fn_guardar_membresia_nuevos se alinea con el selector unificado.
-- Ya NO usa cdp_modo (el frontend resuelve la casa_de_paz_id final: sugerida del
-- invitador con override, elegida, o vacía). El invitador se guarda por id
-- (persona del sistema) o por texto libre (invitador_txt). Resto igual que
-- 20261001200000. La CdP acepta satélites (iglesia real de la CdP).

CREATE OR REPLACE FUNCTION public.fn_guardar_membresia_nuevos(p_iglesia_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_persona_id      uuid;
  v_invitador_id    uuid := NULLIF(p_payload->>'invitador_persona_id', '')::uuid;
  v_invitador_txt   text := NULLIF(trim(p_payload->>'invitador_txt'), '');
  v_casa_de_paz_id  uuid := NULLIF(p_payload->>'casa_de_paz_id', '')::uuid;
  v_es_visita       boolean := COALESCE((p_payload->>'es_visita')::boolean, false);
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
                       sexo, fecha_nacimiento, ci, correo, membresia_completada)
  VALUES (p_iglesia_id, p_payload->>'primer_nombre', NULLIF(p_payload->>'segundo_nombre', ''),
          p_payload->>'primer_apellido', NULLIF(p_payload->>'segundo_apellido', ''),
          (p_payload->>'sexo')::sexo_enum, NULLIF(p_payload->>'fecha_nacimiento', '')::date,
          NULLIF(p_payload->>'ci', ''), NULLIF(p_payload->>'correo', ''), false)
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

  -- Casa de Paz: la casa_de_paz_id ya viene resuelta del frontend. Validar que
  -- sea de esta iglesia o de una satélite/hija.
  IF v_casa_de_paz_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM casa_de_paz cdp JOIN iglesia ig ON ig.id = cdp.iglesia_id
      WHERE cdp.id = v_casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
        AND (cdp.iglesia_id = p_iglesia_id OR ig.iglesia_padre_id = p_iglesia_id)
    ) THEN
      RAISE EXCEPTION 'MEMBRESIA_CDP_INVALIDA: la Casa de Paz no pertenece a esta iglesia ni a sus satélites'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Llegada (invitado_por por id o texto libre).
  SELECT id INTO v_motivo_id FROM motivo_llegada
  WHERE codigo = CASE WHEN v_invitador_id IS NOT NULL OR v_invitador_txt IS NOT NULL
                      THEN 'INVITACION_PERSONAL' ELSE 'OTRO' END;
  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                               invitado_por_id, invitado_por_txt, comentarios)
  VALUES (p_iglesia_id, v_persona_id, v_motivo_id, CURRENT_DATE, v_invitador_id, v_invitador_txt,
          NULLIF(trim(p_payload->>'como_llego'), ''));

  -- Membresía de CdP (con la iglesia real de la CdP, para satélites).
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
