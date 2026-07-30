-- VisionHub -- 49_afirmacion_registro.sql
-- 14-afirmacion. Registro interno manual (Requisito 4.1): el Lider de
-- Afirmacion elige un Lider de CdP (por identificador estable, nunca por
-- nombre) y el sistema resuelve su CdP activa. Mismo patron atomico que
-- fn_registrar_persona_via_url (19_registro_publico.sql), pero autenticado
-- y sin exponer nada a anon.

-- ============================================================
-- Solo lectura: lideres de CdP vigentes de la iglesia, para el selector del
-- formulario. NO toca ni expone nada de escritura sobre Casas de Paz.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_listar_lideres_cdp_afirmacion(p_iglesia_id UUID)
RETURNS TABLE (
  casa_de_paz_cargo_id UUID,
  persona_id           UUID,
  lider_nombre         TEXT,
  casa_de_paz_id       UUID,
  cdp_etiqueta         TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT cc.id, cc.persona_id, fn_nombre_completo(p), cc.casa_de_paz_id, fn_etiqueta_cdp(cc.casa_de_paz_id)
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN persona p ON p.id = cc.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
  WHERE cc.iglesia_id = p_iglesia_id
    AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL
  ORDER BY fn_nombre_completo(p);
END;
$$;

-- ============================================================
-- Escritura: alta atomica de persona + detalle + llegada + membresia.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_registrar_persona_afirmacion(p_datos JSONB, p_casa_de_paz_cargo_id UUID)
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

  -- Siempre se crea (mismo motivo que fn_registrar_persona_via_url): el
  -- disparador de obligatoriedad de 21_validaciones_membresia.sql necesita la
  -- fila para validar ocupacion/grado_instruccion aunque vengan nulos.
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

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_cargo.casa_de_paz_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_listar_lideres_cdp_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_persona_afirmacion(JSONB, UUID) TO authenticated;
