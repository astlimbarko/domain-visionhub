-- VisionHub -- 21_validaciones_membresia.sql
-- Cierra un pendiente de 10-panel-supervisor/tasks.md (tarea 5.2, nunca implementado):
-- "Crear el equivalente [al reporte] para el formulario de membresia". Necesario
-- ahora porque 13-registro-publico-cdp Requisito 5.6/6.10 promete aplicar los
-- mismos Campo_Configurable de FORMULARIO_MEMBRESIA al registro publico, y sin
-- este disparador esa promesa no se cumplia ni siquiera en el flujo autenticado.
--
-- MEMBRESIA_CI_OBLIGATORIO y MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO viven en
-- `persona`. MEMBRESIA_OCUPACION_OBLIGATORIO y MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO
-- viven en `persona_detalle`, que es una tabla aparte y opcional -- por eso
-- fn_registrar_persona_via_url (19_registro_publico.sql) se actualiza para
-- crear siempre la fila de persona_detalle, aunque estos dos campos no vengan
-- en el formulario, para que el disparador tenga donde validar.

CREATE OR REPLACE FUNCTION fn_validar_campos_membresia_persona()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO') AND NEW.ci IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "ci" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO') AND NEW.fecha_nacimiento IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "fecha_nacimiento" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_campos_membresia_persona
  BEFORE INSERT OR UPDATE ON persona
  FOR EACH ROW EXECUTE FUNCTION fn_validar_campos_membresia_persona();

CREATE OR REPLACE FUNCTION fn_validar_campos_membresia_detalle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = NEW.persona_id;

  IF fn_config_bool(v_iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO')
     AND (NEW.ocupacion IS NULL OR btrim(NEW.ocupacion) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "ocupacion" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(v_iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO') AND NEW.grado_instruccion IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "grado_instruccion" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_campos_membresia_detalle
  BEFORE INSERT OR UPDATE ON persona_detalle
  FOR EACH ROW EXECUTE FUNCTION fn_validar_campos_membresia_detalle();

-- fn_registrar_persona_via_url pasa a crear siempre persona_detalle (antes era
-- condicional), para que el disparador de arriba tenga donde validar aunque el
-- formulario publico no haya mandado ninguno de esos cuatro campos.
CREATE OR REPLACE FUNCTION fn_registrar_persona_via_url(p_slug VARCHAR, p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Siempre se crea (ver nota arriba): el disparador de obligatoriedad necesita
  -- la fila para validar ocupacion/grado_instruccion aunque vengan nulos.
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

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', (SELECT nombre FROM casa_de_paz WHERE id = v_url.casa_de_paz_id)
  );
END;
$$;

-- fn_resolver_url_registro expone ahora los cuatro flags de obligatoriedad de
-- FORMULARIO_MEMBRESIA (Requisito 5.6: "para que el frontend pinte el
-- asterisco"), reutilizando fn_config_formulario que ya existia en
-- 06_configuracion.sql para el flujo autenticado.
CREATE OR REPLACE FUNCTION fn_resolver_url_registro(p_slug VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT cpu.estado, fn_config_bool(cpu.iglesia_id, 'REGISTRO_URL_ACTIVO') AS iglesia_activa,
         fn_nombre_completo(p) AS lider_nombre, cdp.nombre AS cdp_nombre, cpu.iglesia_id AS iglesia_id
  INTO r
  FROM casa_paz_url cpu
  JOIN persona p ON p.id = cpu.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cpu.casa_de_paz_id
  WHERE cpu.slug = p_slug AND cpu.fecha_eliminacion IS NULL;

  IF NOT FOUND OR r.estado <> 'ACTIVO' OR NOT r.iglesia_activa THEN
    RETURN jsonb_build_object('admite_registro', false);
  END IF;

  RETURN jsonb_build_object(
    'admite_registro', true,
    'lider_nombre', r.lider_nombre,
    'casa_de_paz_nombre', r.cdp_nombre,
    'campos_obligatorios', jsonb_build_object(
      'ci', fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_resolver_url_registro(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_persona_via_url(VARCHAR, JSONB) TO anon, authenticated;
