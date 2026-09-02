-- VisionHub -- Agrega el celular a los 2 flujos de alta que no lo capturaban:
-- el registro interno de Afirmacion (fn_registrar_persona_afirmacion) y el
-- registro publico por URL (fn_registrar_persona_via_url). El wizard de
-- MembresiaObligatoria ya lo pedia; estos dos no. El frontend ahora manda
-- p_datos->>'telefono' (prefijo pais + numero, o ausente si no se cargo).
--
-- Se persiste con fn_guardar_telefono_membresia (KAN-252 Parte B), que crea
-- el telefono WHATSAPP principal etiquetado con la iglesia de la persona y
-- es no-op si el numero viene NULL/vacio -- por eso se puede llamar siempre.
-- Todo lo demas de ambas funciones queda idéntico (reproducidas tal cual la
-- ultima definicion vigente, solo se agrega el PERFORM del telefono).

-- fn_registrar_persona_afirmacion: reproduce 20260808320000 + telefono.
CREATE OR REPLACE FUNCTION public.fn_registrar_persona_afirmacion(p_datos JSONB, p_casa_de_paz_cargo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cargo        casa_de_paz_cargo;
  v_iglesia_id   UUID;
  v_persona_id   UUID;
BEGIN
  SELECT cc.* INTO v_cargo
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
  WHERE cc.id = p_casa_de_paz_cargo_id
    AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFIRMACION_LIDER_CDP_INVALIDO: el lider de casa de paz elegido no tiene un cargo vigente'
      USING ERRCODE = 'P0001';
  END IF;

  v_iglesia_id := v_cargo.iglesia_id;

  IF NOT fn_es_lider_afirmacion_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso, invitado_por_id)
  VALUES (v_iglesia_id, v_persona_id,
          (SELECT id FROM motivo_llegada WHERE codigo = 'INVITACION_PERSONAL'),
          CURRENT_DATE, v_cargo.persona_id);

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_iglesia_id, v_cargo.casa_de_paz_id, v_persona_id, true, CURRENT_DATE);

  -- KAN-123: campos ampliados, incluye Ministerios.
  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, p_datos);

  -- Celular (nuevo): no-op si p_datos->>'telefono' viene NULL/vacio.
  PERFORM fn_guardar_telefono_membresia(v_persona_id, v_iglesia_id, p_datos->>'telefono');

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_cargo.casa_de_paz_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_registrar_persona_afirmacion(jsonb, uuid) TO authenticated;

-- fn_registrar_persona_via_url: reproduce 20260821090000 + telefono.
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

  -- Celular (nuevo): no-op si p_datos->>'telefono' viene NULL/vacio.
  PERFORM fn_guardar_telefono_membresia(v_persona_id, v_url.iglesia_id, p_datos->>'telefono');

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_url.casa_de_paz_id)
  );
END;
$function$;
