-- VisionHub -- KAN-405 seguimiento (2026-09-21, mismo día): fix de una
-- regresión real que introdujo la migración anterior
-- (20260921100000_kan405_colaboradores_temporales.sql).
--
-- Al agregar el OR de colaborador a fn_registrar_persona_afirmacion,
-- fn_listar_lideres_cdp_afirmacion y fn_listar_casas_de_paz_afirmacion, se
-- copiaron los cuerpos desde harness/11-esquema-bd (snapshot viejo,
-- 2026-08-08) y desde 20260809080000_paridad_pastor_supervisor.sql en vez de
-- la version REAL mas reciente (20260909070000_kan339_superadmin_lectura_
-- pastor_afirmacion.sql, 2026-09-09) -- eso piso en la base real:
--
--   1. fn_registrar_persona_afirmacion: se perdieron las llamadas a
--      fn_guardar_membresia_extendida() y fn_guardar_telefono_membresia()
--      (KAN-123/celular) -- las respuestas del formulario de Discipulados,
--      Seminario/Universidad, Mentor/Bautismo, Cargo, Conyuge, Familia,
--      Ministerios y el celular dejaban de guardarse SILENCIOSAMENTE en
--      cualquier alta por Afirmacion, no solo la de Colaboradores. Tambien
--      se perdio fn_es_pastor_en() del chequeo de permiso.
--   2. fn_listar_lideres_cdp_afirmacion: se perdieron las columnas red_id/
--      red_nombre/zona (KAN-214, "Red primero") y fn_es_super_admin() del
--      chequeo -- el selector del formulario mostraba "Esa Red no tiene
--      lideres de CdP activos" con datos reales de sobra (detectado en vivo
--      verificando este mismo ticket).
--   3. fn_listar_casas_de_paz_afirmacion: se perdio fn_es_super_admin() del
--      chequeo (KAN-339, modo "Visualizar").
--
-- Esta migracion restaura el cuerpo real de las 3 funciones (tal como
-- estaba en 20260909070000, la ultima version registrada antes de esta
-- sesion) y le suma UNICAMENTE el OR de fn_es_colaborador_activo_en, sin
-- tocar nada mas.

DROP FUNCTION IF EXISTS fn_listar_lideres_cdp_afirmacion(UUID);
CREATE OR REPLACE FUNCTION public.fn_listar_lideres_cdp_afirmacion(p_iglesia_id uuid)
 RETURNS TABLE(casa_de_paz_cargo_id uuid, persona_id uuid, lider_nombre text, casa_de_paz_id uuid, cdp_etiqueta text, red_id uuid, red_nombre character varying, zona character varying)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)
          OR fn_es_super_admin() OR fn_es_colaborador_activo_en(p_iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cc.id, cc.persona_id, fn_nombre_completo(p), cc.casa_de_paz_id, fn_etiqueta_cdp(cc.casa_de_paz_id),
    r.id, r.nombre,
    (SELECT d.zona FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
     WHERE da.casa_de_paz_id = cc.casa_de_paz_id AND da.activo AND da.fecha_eliminacion IS NULL LIMIT 1)
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN persona p ON p.id = cc.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cc.iglesia_id = p_iglesia_id
    AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL
  ORDER BY fn_nombre_completo(p);
END;
$function$;

DROP FUNCTION IF EXISTS fn_listar_casas_de_paz_afirmacion(UUID);
CREATE OR REPLACE FUNCTION public.fn_listar_casas_de_paz_afirmacion(p_iglesia_id uuid)
 RETURNS TABLE(casa_de_paz_id uuid, casa_de_paz_etiqueta text, activo boolean, red_id uuid, red_nombre character varying, lider_red_nombre text, lider_cdp_nombre text, tiene_lider_vigente boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)
          OR fn_es_super_admin() OR fn_es_colaborador_activo_en(p_iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    cdp.activo,
    r.id,
    r.nombre,
    (SELECT fn_nombre_completo(prl)
     FROM red_cargo rcl JOIN cargo cl ON cl.id = rcl.cargo_id JOIN persona prl ON prl.id = rcl.persona_id
     WHERE rcl.red_id = r.id AND cl.codigo = 'LIDER_RED'
       AND rcl.fecha_fin IS NULL AND rcl.fecha_eliminacion IS NULL
     LIMIT 1),
    (SELECT fn_nombre_completo(pcdp)
     FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id JOIN persona pcdp ON pcdp.id = ccl.persona_id
     WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
       AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
     LIMIT 1),
    EXISTS (
      SELECT 1 FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id
      WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
        AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
    )
  FROM casa_de_paz cdp
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cdp.iglesia_id = p_iglesia_id
    AND cdp.fecha_eliminacion IS NULL
  ORDER BY r.nombre NULLS LAST, fn_etiqueta_cdp(cdp.id);
END;
$function$;

DROP FUNCTION IF EXISTS fn_registrar_persona_afirmacion(JSONB, UUID);
CREATE OR REPLACE FUNCTION public.fn_registrar_persona_afirmacion(p_datos jsonb, p_casa_de_paz_cargo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT (fn_es_lider_afirmacion_en(v_iglesia_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)
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
$function$;

GRANT EXECUTE ON FUNCTION fn_listar_lideres_cdp_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_casas_de_paz_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_persona_afirmacion(JSONB, UUID) TO authenticated;
