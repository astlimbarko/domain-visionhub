-- 97: fix del mensaje de confirmacion vacio en el registro publico por URL.
--
-- Motivo: fn_registrar_persona_via_url devolvia `casa_de_paz.nombre` (columna
-- que desde la migracion 78_dashboard_cdp_nombre_dinamico.sql quedo NULL a
-- proposito -- el nombre a mostrar de una CdP se calcula con fn_etiqueta_cdp,
-- no se guarda en una columna fija). Encontrado probando en vivo el flujo:
-- el mensaje de exito del formulario publico decia "<nombre> quedo
-- registrado en ." con el nombre de la Casa de Paz vacio. El dato en si se
-- guardaba bien (la persona quedaba vinculada a la CdP correcta), solo el
-- texto de confirmacion estaba mal.
CREATE OR REPLACE FUNCTION public.fn_registrar_persona_via_url(p_slug character varying, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_url.casa_de_paz_id)
  );
END;
$function$;
