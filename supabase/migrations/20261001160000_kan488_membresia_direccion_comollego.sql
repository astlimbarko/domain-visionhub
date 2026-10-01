-- KAN-488: el guardado final de Membresía desde 0 ahora persiste la DIRECCIÓN
-- (por el sistema normalizado direccion + direccion_asignacion; el texto libre
-- del formulario va en `calle`, es_principal=true) y el "CÓMO LLEGÓ" (texto
-- libre en persona_llegada.comentarios, columna que ya existe). Decisión del
-- owner 2026-10-01: ambos campos SÍ se guardan, y la dirección debe verse al
-- buscar la persona (por eso el sistema normalizado, no una columna suelta).
-- CREATE OR REPLACE de la función ya existente (20261001120000) con esos 2 agregados.

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

  -- Persona (identidad)
  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                       sexo, fecha_nacimiento, ci, correo)
  VALUES (p_iglesia_id, p_payload->>'primer_nombre', NULLIF(p_payload->>'segundo_nombre', ''),
          p_payload->>'primer_apellido', NULLIF(p_payload->>'segundo_apellido', ''),
          (p_payload->>'sexo')::sexo_enum, NULLIF(p_payload->>'fecha_nacimiento', '')::date,
          NULLIF(p_payload->>'ci', ''), NULLIF(p_payload->>'correo', ''))
  RETURNING id INTO v_persona_id;

  -- Detalle (lo que tiene columna directa)
  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion,
                               bautizado, bautizado_en_nuestra_iglesia)
  VALUES (v_persona_id,
          NULLIF(p_payload->>'estado_civil', '')::estado_civil_enum,
          NULLIF(p_payload->>'grado_instruccion', '')::grado_instruccion_enum,
          NULLIF(p_payload->>'ocupacion', ''),
          CASE WHEN p_payload->>'bautizado' = 'true' THEN true
               WHEN p_payload->>'bautizado' = 'false' THEN false
               ELSE NULL END,
          CASE WHEN p_payload->>'bautizado_en_nuestra_iglesia' = 'true' THEN true ELSE NULL END);

  -- Teléfono (no-op si viene NULL/vacío)
  PERFORM fn_guardar_telefono_membresia(v_persona_id, p_iglesia_id, NULLIF(p_payload->>'telefono', ''));

  -- Dirección (sistema normalizado). El texto libre del form va en `calle`;
  -- es_principal=true para que sea la que se muestra al buscar la persona.
  IF v_direccion IS NOT NULL THEN
    INSERT INTO direccion (iglesia_id, calle) VALUES (p_iglesia_id, v_direccion)
    RETURNING id INTO v_direccion_id;
    INSERT INTO direccion_asignacion (iglesia_id, direccion_id, persona_id, es_principal)
    VALUES (p_iglesia_id, v_direccion_id, v_persona_id, true);
  END IF;

  -- Casa de Paz según modo
  IF v_cdp_modo = 'INVITADOR' AND v_invitador_id IS NOT NULL THEN
    v_invitado_por_id := v_invitador_id;
    SELECT casa_de_paz_id INTO v_casa_de_paz_id
    FROM casa_de_paz_membresia
    WHERE persona_id = v_invitador_id AND es_principal
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
    LIMIT 1;
  ELSIF v_cdp_modo = 'LISTA' AND v_casa_de_paz_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM casa_de_paz
                   WHERE id = v_casa_de_paz_id AND iglesia_id = p_iglesia_id
                     AND fecha_eliminacion IS NULL) THEN
      RAISE EXCEPTION 'MEMBRESIA_CDP_INVALIDA: la Casa de Paz no pertenece a esta iglesia'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_casa_de_paz_id := NULL;
  END IF;

  -- Llegada. comentarios = "cómo llegó a la iglesia" (texto libre del form).
  SELECT id INTO v_motivo_id FROM motivo_llegada
  WHERE codigo = CASE WHEN v_invitado_por_id IS NOT NULL THEN 'INVITACION_PERSONAL' ELSE 'OTRO' END;
  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                               invitado_por_id, comentarios)
  VALUES (p_iglesia_id, v_persona_id, v_motivo_id, CURRENT_DATE, v_invitado_por_id,
          NULLIF(trim(p_payload->>'como_llego'), ''));

  -- Membresía de CdP (solo si quedó definida una CdP)
  IF v_casa_de_paz_id IS NOT NULL THEN
    INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
    VALUES (p_iglesia_id, v_casa_de_paz_id, v_persona_id, true, CURRENT_DATE);
  END IF;

  -- Estado SSVA: SIM (simpatizante) si es visita; NC si se integra como nuevo.
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
