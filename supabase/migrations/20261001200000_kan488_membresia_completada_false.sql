-- KAN-488 FIX (hallazgo en verificación end-to-end 2026-10-01): el guardado de
-- Membresía desde 0 fallaba en iglesias con campos obligatorios (ej. Genesis
-- con MEMBRESIA_CI_OBLIGATORIO) porque persona.membresia_completada tiene
-- default TRUE, y el trigger fn_validar_campos_membresia_persona exige ci/
-- fecha_nacimiento cuando membresia_completada=true. La Membresía desde 0 es
-- una captura LIVIANA/progresiva (ci y fecha opcionales, decisión del owner),
-- así que la persona se crea con membresia_completada=false -- mismo patrón que
-- crearPersona (alta parcial del Directorio). Sin esto, el alta fallaba.
-- Solo cambia esa línea del INSERT de persona respecto de 20261001180000.

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

  -- membresia_completada=false: captura liviana/progresiva (ci/fecha opcionales).
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
