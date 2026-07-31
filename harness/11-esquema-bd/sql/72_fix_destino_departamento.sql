-- VisionHub -- 72_fix_destino_departamento.sql
-- Bug real encontrado al probar 71_ en vivo: fn_etiqueta_cdp(NULL) NO
-- devuelve NULL -- devuelve el texto 'Casa de Paz sin lider' (para el caso
-- real de una CdP sin lider asignado). El COALESCE(red_nombre,
-- fn_etiqueta_cdp(casa_de_paz_id), departamento_nombre) en
-- fn_mi_invitacion_pendiente/fn_completar_membresia siempre evaluaba
-- fn_etiqueta_cdp aunque casa_de_paz_id fuera NULL (invitacion de
-- departamento), y ese texto ganaba el COALESCE antes de llegar a
-- departamento_nombre. Cambia a CASE explicito que solo llama a
-- fn_etiqueta_cdp cuando casa_de_paz_id no es NULL.

CREATE OR REPLACE FUNCTION fn_mi_invitacion_pendiente()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT il.id, il.rol, il.iglesia_id, i.nombre AS iglesia_nombre,
         red.nombre AS red_nombre, il.casa_de_paz_id, il.departamento_id, d.nombre AS departamento_nombre
  INTO r
  FROM invitacion_lider il
  JOIN iglesia i ON i.id = il.iglesia_id
  LEFT JOIN red ON red.id = il.red_id
  LEFT JOIN departamento d ON d.id = il.departamento_id
  WHERE il.usuario_id = auth.uid() AND il.estado = 'PENDIENTE' AND il.fecha_eliminacion IS NULL
  ORDER BY il.fecha_creacion DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'rol', r.rol,
    'iglesia_nombre', r.iglesia_nombre,
    'destino', CASE
      WHEN r.red_nombre IS NOT NULL THEN r.red_nombre
      WHEN r.casa_de_paz_id IS NOT NULL THEN fn_etiqueta_cdp(r.casa_de_paz_id)
      ELSE r.departamento_nombre
    END,
    'departamento_nombre', r.departamento_nombre,
    'campos_obligatorios', jsonb_build_object(
      'ci', fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_completar_membresia(p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  ELSIF v_inv.departamento_id IS NOT NULL THEN
    UPDATE departamento_cargo SET fecha_fin = CURRENT_DATE
    WHERE departamento_id = v_inv.departamento_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.departamento_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', CASE
      WHEN v_inv.red_id IS NOT NULL THEN (SELECT nombre FROM red WHERE id = v_inv.red_id)
      WHEN v_inv.casa_de_paz_id IS NOT NULL THEN fn_etiqueta_cdp(v_inv.casa_de_paz_id)
      ELSE (SELECT nombre FROM departamento WHERE id = v_inv.departamento_id)
    END
  );
END;
$$;
