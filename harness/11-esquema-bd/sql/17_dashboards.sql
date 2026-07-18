-- VisionHub -- 17_dashboards.sql
-- Una RPC por dashboard. Toda funcion SECURITY DEFINER verifica el alcance a mano.

CREATE OR REPLACE FUNCTION fn_kpi_asistencia_ultima(p_casa_de_paz_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  WITH ultimas AS (
    SELECT vt.total_asistentes, vt.fecha_reunion, ROW_NUMBER() OVER (ORDER BY vt.fecha_reunion DESC) AS pos
    FROM v_reporte_totales vt WHERE vt.casa_de_paz_id = p_casa_de_paz_id
  )
  SELECT jsonb_build_object(
    'valor', (SELECT total_asistentes FROM ultimas WHERE pos = 1),
    'anterior', (SELECT total_asistentes FROM ultimas WHERE pos = 2),
    'fecha', (SELECT fecha_reunion FROM ultimas WHERE pos = 1),
    'variacion_pct', (
      SELECT CASE
        WHEN (SELECT total_asistentes FROM ultimas WHERE pos = 2) IN (0, NULL) THEN NULL
        ELSE round((((SELECT total_asistentes FROM ultimas WHERE pos = 1)::numeric
                     - (SELECT total_asistentes FROM ultimas WHERE pos = 2))
                    / (SELECT total_asistentes FROM ultimas WHERE pos = 2)) * 100, 1)
      END
    )
  );
$$;

CREATE OR REPLACE FUNCTION fn_kpi_miembros_activos(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  WITH actual AS (
    SELECT count(*) AS n FROM casa_de_paz_membresia
    WHERE casa_de_paz_id = p_casa_de_paz_id AND fecha_eliminacion IS NULL
      AND fecha_inicio <= p_fecha AND (fecha_fin IS NULL OR fecha_fin >= p_fecha)
  ),
  anterior AS (
    SELECT count(*) AS n FROM casa_de_paz_membresia
    WHERE casa_de_paz_id = p_casa_de_paz_id AND fecha_eliminacion IS NULL
      AND fecha_inicio <= (date_trunc('month', p_fecha) - interval '1 day')::date
      AND (fecha_fin IS NULL OR fecha_fin >= (date_trunc('month', p_fecha) - interval '1 day')::date)
  )
  SELECT jsonb_build_object(
    'valor', (SELECT n FROM actual),
    'anterior', (SELECT n FROM anterior),
    'variacion_pct', CASE WHEN (SELECT n FROM anterior) IN (0, NULL) THEN NULL
      ELSE round((((SELECT n FROM actual)::numeric - (SELECT n FROM anterior)) / (SELECT n FROM anterior)) * 100, 1) END
  );
$$;

-- Lista de miembros con semaforo configurable (DIAS_SEMAFORO_AMARILLO/ROJO,
-- PENDIENTES.md #7, confirmado por el owner 2026-07-17).
CREATE OR REPLACE FUNCTION fn_lista_miembros_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (
  persona_id UUID, nombre TEXT, estado_sigla VARCHAR, estado_nombre VARCHAR,
  ultima_asistencia DATE, semanas_sin_venir INT, estado_civil estado_civil_enum,
  es_menor BOOLEAN, semaforo VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id, fn_nombre_completo(p) AS nombre, e.sigla, e.nombre AS estado_nombre, pd.estado_civil,
      (p.fecha_nacimiento IS NOT NULL
       AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento)) < fn_criterio(m.iglesia_id, 'EDAD_MINIMA_CREYENTE')) AS es_menor,
      (SELECT max(r.fecha_reunion) FROM casa_de_paz_asistencia a
       JOIN casa_de_paz_reporte r ON r.id = a.reporte_id
       WHERE a.persona_id = p.id AND r.casa_de_paz_id = p_casa_de_paz_id
         AND a.fecha_eliminacion IS NULL AND r.fecha_eliminacion IS NULL) AS ultima,
      m.iglesia_id
    FROM casa_de_paz_membresia m
    JOIN persona p ON p.id = m.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    WHERE m.casa_de_paz_id = p_casa_de_paz_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  )
  SELECT
    b.id, b.nombre, b.sigla, b.estado_nombre, b.ultima,
    CASE WHEN b.ultima IS NULL THEN NULL ELSE ((CURRENT_DATE - b.ultima) / 7)::int END,
    b.estado_civil, b.es_menor,
    CASE
      WHEN b.ultima IS NULL THEN 'ROJO'
      WHEN (CURRENT_DATE - b.ultima) >= fn_criterio(b.iglesia_id, 'DIAS_SEMAFORO_ROJO') THEN 'ROJO'
      WHEN (CURRENT_DATE - b.ultima) >= fn_criterio(b.iglesia_id, 'DIAS_SEMAFORO_AMARILLO') THEN 'AMARILLO'
      ELSE 'VERDE'
    END::VARCHAR
  FROM base b;
END;
$$;

CREATE OR REPLACE FUNCTION fn_simpatizantes_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (persona_id UUID, nombre TEXT, fecha_ingreso DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), pe.fecha_inicio
  FROM casa_de_paz_membresia m
  JOIN persona p ON p.id = m.persona_id
  JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  JOIN estado e ON e.id = pe.estado_id AND e.sigla = 'SIM'
  WHERE m.casa_de_paz_id = p_casa_de_paz_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  ORDER BY pe.fecha_inicio DESC;
END;
$$;

CREATE OR REPLACE FUNCTION fn_reconciliados_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (persona_id UUID, nombre TEXT, fecha_reconciliacion DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), pe.fecha_inicio
  FROM casa_de_paz_membresia m
  JOIN persona p ON p.id = m.persona_id
  JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  JOIN estado e ON e.id = pe.estado_id AND e.sigla = 'RE'
  WHERE m.casa_de_paz_id = p_casa_de_paz_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  ORDER BY pe.fecha_inicio DESC;
END;
$$;

CREATE OR REPLACE FUNCTION fn_dashboard_lider_cdp(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_resultado  JSONB;
  v_mes_desde  DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta  DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;

  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_lider_cdp(p_casa_de_paz_id) OR fn_es_sublider_cdp(p_casa_de_paz_id) OR fn_es_rol_superior_de_cdp(p_casa_de_paz_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin cargo vigente en la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'casa_de_paz', (
      SELECT jsonb_build_object(
        'id', c.id, 'nombre', c.nombre,
        'red', (SELECT r.nombre FROM casa_de_paz_red cdr JOIN red r ON r.id = cdr.red_id
                WHERE cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL),
        'miembros_total', (SELECT count(*) FROM casa_de_paz_membresia m
                           WHERE m.casa_de_paz_id = c.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL),
        'ultima_reunion', (SELECT max(rep.fecha_reunion) FROM casa_de_paz_reporte rep
                           WHERE rep.casa_de_paz_id = c.id AND rep.fecha_eliminacion IS NULL)
      )
      FROM casa_de_paz c WHERE c.id = p_casa_de_paz_id
    ),
    'kpi', jsonb_build_object(
      'miembros_activos', fn_kpi_miembros_activos(p_casa_de_paz_id, p_fecha),
      'asistencia_ultima', fn_kpi_asistencia_ultima(p_casa_de_paz_id),
      'ingresos_mes', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_ingresos_cdp(p_casa_de_paz_id, v_mes_desde, v_mes_hasta) x)
    ),
    'asistencia_historico', (
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.fecha_reunion)
      FROM (
        SELECT vt.fecha_reunion, vt.total_asistentes, vt.total_menores, vt.total_mayores
        FROM v_reporte_totales vt WHERE vt.casa_de_paz_id = p_casa_de_paz_id
        ORDER BY vt.fecha_reunion DESC LIMIT 8
      ) t
    ),
    'miembros', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.semanas_sin_venir DESC NULLS FIRST) FROM fn_lista_miembros_cdp(p_casa_de_paz_id) m),
    'alertas', jsonb_build_object(
      'inactivos', (SELECT jsonb_agg(to_jsonb(i)) FROM fn_inactividad_cdp(p_casa_de_paz_id) i WHERE i.supera_umbral),
      'reconciliados', (SELECT jsonb_agg(to_jsonb(r)) FROM fn_reconciliados_cdp(p_casa_de_paz_id) r),
      'simpatizantes', (SELECT jsonb_agg(to_jsonb(s)) FROM fn_simpatizantes_cdp(p_casa_de_paz_id) s)
    ),
    'proximos', (SELECT jsonb_agg(to_jsonb(p)) FROM fn_proximos_cdp(p_casa_de_paz_id) p)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION fn_alertas_supervisor(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'cdp_sin_reporte', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_cdp_sin_reporte(p_iglesia_id) x),
    'redes_incompletas', (
      SELECT jsonb_agg(to_jsonb(x)) FROM fn_redes_incompletas(p_iglesia_id) x
      WHERE x.falta_departamentos OR x.falta_ministerio
    ),
    'evangelismo_discrepante', (
      SELECT jsonb_agg(to_jsonb(x)) FROM v_reporte_evangelismo x
      JOIN casa_de_paz c ON c.id = x.casa_de_paz_id
      WHERE c.iglesia_id = p_iglesia_id AND x.diferencia <> 0 AND x.fecha_reunion >= CURRENT_DATE - 30
    ),
    'cdp_sin_red', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre))
      FROM casa_de_paz c
      WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL
        AND NOT EXISTS (SELECT 1 FROM casa_de_paz_red cdr WHERE cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL)
    ),
    'iglesia_sin_autoridad', (
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'falta_pastor', i.pastor_id IS NULL, 'falta_supervisor', i.supervisor_id IS NULL))
      FROM iglesia i WHERE i.id = p_iglesia_id AND (i.pastor_id IS NULL OR i.supervisor_id IS NULL)
    ),
    'miembros_inactivos', (
      SELECT jsonb_agg(jsonb_build_object('casa_de_paz', c.nombre, 'cantidad', sub.n))
      FROM casa_de_paz c
      CROSS JOIN LATERAL (SELECT count(*) AS n FROM fn_inactividad_cdp(c.id) i WHERE i.supera_umbral) sub
      WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL AND sub.n > 0
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_dashboard_pastor(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
BEGIN
  RETURN jsonb_build_object(
    'iglesias', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', i.nombre, 'ciudad', i.ciudad,
        'moneda_defecto', (SELECT codigo FROM moneda WHERE id = i.moneda_defecto_id),
        'redes', (SELECT count(*) FROM red r WHERE r.iglesia_id = i.id AND r.activo AND r.fecha_eliminacion IS NULL),
        'cdp', (SELECT count(*) FROM casa_de_paz c WHERE c.iglesia_id = i.id AND c.activo AND c.fecha_eliminacion IS NULL),
        'miembros_cdp', (SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
                         WHERE m.iglesia_id = i.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL),
        'familias', fn_total_familias(i.id),
        'activa', i.activo
      ) ORDER BY i.nombre)
      FROM iglesia i WHERE i.id IN (SELECT fn_mis_iglesias()) AND i.fecha_eliminacion IS NULL
    ),
    'ingresos_por_moneda', (
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT i.nombre AS iglesia, m.codigo AS moneda, t.codigo AS tipo, sum(fi.monto) AS total
        FROM finanzas_ingreso fi
        JOIN iglesia i ON i.id = fi.iglesia_id
        JOIN moneda m ON m.id = fi.moneda_id
        JOIN finanzas_tipo_ingreso t ON t.id = fi.tipo_ingreso_id
        WHERE fi.iglesia_id IN (SELECT fn_mis_iglesias()) AND fi.fecha BETWEEN v_mes_desde AND v_mes_hasta AND fi.fecha_eliminacion IS NULL
        GROUP BY i.nombre, m.codigo, t.codigo
        ORDER BY i.nombre, m.codigo
      ) x
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_conteo_estados(p_iglesia_id UUID)
RETURNS TABLE (estado_sigla VARCHAR, es_menor BOOLEAN, cantidad BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.sigla,
         (p.fecha_nacimiento IS NOT NULL AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento)) < fn_criterio(p_iglesia_id, 'EDAD_MINIMA_CREYENTE')),
         count(*)
  FROM persona_estado pe
  JOIN persona p ON p.id = pe.persona_id AND p.fecha_eliminacion IS NULL
  JOIN estado e ON e.id = pe.estado_id
  WHERE p.iglesia_id = p_iglesia_id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  GROUP BY e.sigla, 2
  ORDER BY e.sigla;
END;
$$;
