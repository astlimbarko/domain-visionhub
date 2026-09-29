-- Fix: fn_registrar_persona_afirmacion tampoco incluia el bypass de Super
-- Admin -- mismo patron de bug que fn_puede_gestionar_afirmacion (ver
-- 20260929150000). Estaba documentado como limitacion conocida en un
-- comentario de AfirmacionFormulario.tsx ("fn_registrar_persona_afirmacion
-- nunca sumo fn_es_super_admin()"), pero bloquea al owner (Super Admin, sin
-- fila en usuario_rol por iglesia) de usar el formulario real de membresia.
-- Corregido por consistencia con el resto de las funciones de Afirmacion.

CREATE OR REPLACE FUNCTION fn_registrar_persona_afirmacion(p_datos jsonb, p_casa_de_paz_cargo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cargo        casa_de_paz_cargo;
  v_iglesia_id   uuid;
  v_persona_id   uuid;
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

  IF NOT (fn_es_super_admin() OR fn_es_lider_afirmacion_en(v_iglesia_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)
          OR fn_es_colaborador_activo_en(v_iglesia_id, 'AFIRMACION')) THEN
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

  -- Celular: no-op si p_datos->>'telefono' viene NULL/vacio.
  PERFORM fn_guardar_telefono_membresia(v_persona_id, v_iglesia_id, p_datos->>'telefono');

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_cargo.casa_de_paz_id)
  );
END;
$$;
