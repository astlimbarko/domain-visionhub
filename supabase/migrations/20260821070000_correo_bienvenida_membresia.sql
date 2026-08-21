-- VisionHub -- correo de confirmacion al completar el formulario de
-- membresia, dirigido al correo escrito y al nombre de la persona. Pedido
-- explicito del owner (2026-08-21). Cubre los 3 flujos que dan de alta o
-- completan una Persona: registro publico por URL (anonimo),
-- registro interno de Afirmacion, y MembresiaObligatoria (invitacion +
-- caso general).
--
-- La Edge Function nueva (notificar-membresia-completada) es callable sin
-- sesion (necesario para el flujo publico anonimo) -- por eso NUNCA confia
-- en nombre/correo que le pase el cliente, solo en el `personaId`: vuelve a
-- leer persona.correo/nombre con el service role antes de mandar nada. El
-- flag de "ya enviado" evita que alguien golpee el endpoint muchas veces
-- con el mismo personaId y sature el correo de esa persona.

ALTER TABLE persona ADD COLUMN membresia_correo_bienvenida_enviado BOOLEAN NOT NULL DEFAULT false;

-- fn_registrar_persona_via_url: agrega persona_id a la respuesta (antes solo
-- nombre_completo/casa_de_paz_nombre) para que el frontend pueda avisarle a
-- la Edge Function que persona avisar.
CREATE OR REPLACE FUNCTION public.fn_registrar_persona_via_url(p_slug character varying, p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_url casa_paz_url;
  v_persona_id UUID;
  v_intentos INT;
BEGIN
  SELECT * INTO v_url FROM casa_paz_url WHERE slug = p_slug AND fecha_eliminacion IS NULL;

  IF NOT FOUND OR v_url.estado <> 'ACTIVO'
     OR NOT fn_config_bool(v_url.iglesia_id, 'REGISTRO_URL_ACTIVO') THEN
    RAISE EXCEPTION 'REGISTRO_URL_NO_DISPONIBLE: el enlace no admite registro en este momento'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_intentos FROM persona_llegada
  WHERE casa_paz_url_id = v_url.id AND fecha_creacion > now() - interval '10 minutes';
  IF v_intentos >= 20 THEN
    RAISE EXCEPTION 'REGISTRO_URL_LIMITE_EXCEDIDO: demasiados registros recientes para este enlace'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_url.iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                                invitado_por_id, casa_paz_url_id)
  VALUES (v_url.iglesia_id, v_persona_id,
          (SELECT id FROM motivo_llegada WHERE codigo = 'INVITACION_PERSONAL'),
          CURRENT_DATE, v_url.persona_id, v_url.id);

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_url.iglesia_id, v_url.casa_de_paz_id, v_persona_id, true, CURRENT_DATE);

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_url.iglesia_id, p_datos);

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', (SELECT nombre FROM casa_de_paz WHERE id = v_url.casa_de_paz_id)
  );
END;
$function$;

-- fn_registrar_persona_afirmacion ya devuelve persona_id -- sin cambios.

-- fn_completar_membresia (invitacion): agrega persona_id.
CREATE OR REPLACE FUNCTION public.fn_completar_membresia(p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_inv invitacion_lider;
  v_persona_id UUID;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider
  WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBRESIA_SIN_INVITACION_PENDIENTE: no hay una invitacion pendiente para completar' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_inv.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  IF v_inv.rol = 'LIDER_RED' THEN
    UPDATE red_cargo SET fecha_fin = CURRENT_DATE
    WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_inv.iglesia_id, p_datos);

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', COALESCE((SELECT nombre FROM red WHERE id = v_inv.red_id), fn_etiqueta_cdp(v_inv.casa_de_paz_id))
  );
END;
$function$;

-- fn_completar_membresia_general: agrega persona_id (mantiene el fix de
-- KAN-213 -- reabrir por nombre vacio y upsert de persona_detalle).
CREATE OR REPLACE FUNCTION public.fn_completar_membresia_general(p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID;
  v_borrador JSONB;
  v_datos_completos JSONB;
BEGIN
  v_iglesia_id := fn_mi_iglesia_membresia_general();
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEMBRESIA_GENERAL_SIN_ROL: no se encontro un rol vigente que requiera completar la membresia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, membresia_borrador INTO v_persona_id, v_borrador FROM persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND fecha_eliminacion IS NULL
    AND (membresia_completada = false OR btrim(primer_nombre) = '' OR btrim(primer_apellido) = '');

  v_datos_completos := COALESCE(v_borrador, '{}'::jsonb) || p_datos;

  IF v_persona_id IS NOT NULL THEN
    UPDATE persona SET
      primer_nombre = p_datos->>'primer_nombre',
      segundo_nombre = p_datos->>'segundo_nombre',
      primer_apellido = p_datos->>'primer_apellido',
      segundo_apellido = p_datos->>'segundo_apellido',
      sexo = (p_datos->>'sexo')::sexo_enum,
      fecha_nacimiento = NULLIF(p_datos->>'fecha_nacimiento', '')::date,
      ci = p_datos->>'ci',
      correo = p_datos->>'correo',
      membresia_completada = true,
      membresia_borrador = NULL,
      membresia_paso_actual = NULL
    WHERE id = v_persona_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM persona
      WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
        AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
    ) THEN
      RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                          sexo, fecha_nacimiento, ci, correo, membresia_completada)
    VALUES (v_iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
            p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
            (p_datos->>'sexo')::sexo_enum, NULLIF(p_datos->>'fecha_nacimiento', '')::date,
            p_datos->>'ci', p_datos->>'correo', true)
    RETURNING id INTO v_persona_id;
  END IF;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad')
  ON CONFLICT (persona_id) DO UPDATE SET
    estado_civil = EXCLUDED.estado_civil,
    grado_instruccion = EXCLUDED.grado_instruccion,
    ocupacion = EXCLUDED.ocupacion,
    nacimiento_ciudad = EXCLUDED.nacimiento_ciudad;

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, v_datos_completos);

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$function$;
