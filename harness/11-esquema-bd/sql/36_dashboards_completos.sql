-- VisionHub -- 36_dashboards_completos.sql
-- Completa 09-dashboards: fn_dashboard_lider_cdp, fn_alertas_supervisor,
-- fn_dashboard_pastor y fn_conteo_estados ya existian (17_dashboards.sql).
-- Faltaba: dashboard del Lider de Red (Req 4), dashboard completo del
-- Supervisor (Req 5, con KPIs + detalle por Red -- las alertas ya estaban),
-- dashboard del Sublider filtrado por configuracion (Req 3), y una funcion
-- para que el frontend sepa que roles tiene el usuario en la iglesia activa
-- (necesaria para decidir que panel mostrarle primero).

-- ============================================================
-- Hueco real encontrado al implementar el Requisito 3.6 ("impedir al
-- Sublider editar la lista de miembros"): pol_casa_de_paz_membresia_insert/
-- update incluia fn_es_sublider_cdp, dandole el mismo permiso que al Lider.
-- El comentario original decia "la misma gente que ya llena el reporte
-- semanal", confundiendo membresia (quien es Miembro_CdP formalmente) con
-- asistencia (quien vino esa semana) -- el Sublider sigue pudiendo marcar
-- asistencia y llenar el reporte (casa_de_paz_reporte/asistencia tienen su
-- propia policy con fn_puede_reportar_cdp, sin tocar), pero ya no puede
-- dar de alta ni cerrar membresias.
-- ============================================================
DROP POLICY IF EXISTS pol_casa_de_paz_membresia_insert ON casa_de_paz_membresia;
DROP POLICY IF EXISTS pol_casa_de_paz_membresia_update ON casa_de_paz_membresia;

CREATE POLICY pol_casa_de_paz_membresia_insert ON casa_de_paz_membresia
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_cdp(casa_de_paz_id))
  );

CREATE POLICY pol_casa_de_paz_membresia_update ON casa_de_paz_membresia
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_cdp(casa_de_paz_id))
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_cdp(casa_de_paz_id))
  );

-- ============================================================
-- Que roles tiene el usuario actual en una iglesia -- el frontend lo usa
-- para decidir que dashboard(s) mostrar. Agrupar varios roles en un solo
-- panel queda para mas adelante (cola del owner); por ahora alcanza con
-- saber "cuales tiene" para elegir uno por prioridad.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_mis_roles_dashboard(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'es_operativo', fn_es_operativo_en(p_iglesia_id),
    'redes_lider', (
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre) ORDER BY r.nombre)
      FROM red r JOIN red_cargo rc ON rc.red_id = r.id
      JOIN cargo c ON c.id = rc.cargo_id AND c.codigo = 'LIDER_RED'
      WHERE r.iglesia_id = p_iglesia_id AND rc.persona_id = fn_mi_persona_id()
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    ),
    'cdp_lider', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'etiqueta', fn_etiqueta_cdp(c.id)) ORDER BY fn_etiqueta_cdp(c.id))
      FROM casa_de_paz c JOIN casa_de_paz_cargo cc ON cc.casa_de_paz_id = c.id
      JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'LIDER_CDP'
      WHERE c.iglesia_id = p_iglesia_id AND cc.persona_id = fn_mi_persona_id()
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    ),
    'cdp_sublider', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'etiqueta', fn_etiqueta_cdp(c.id)) ORDER BY fn_etiqueta_cdp(c.id))
      FROM casa_de_paz c JOIN casa_de_paz_cargo cc ON cc.casa_de_paz_id = c.id
      JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'SUBLIDER_CDP'
      WHERE c.iglesia_id = p_iglesia_id AND cc.persona_id = fn_mi_persona_id()
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    )
  );
END;
$$;

-- ============================================================
-- Dashboard del Lider de Red (Requisito 4). Pastor/Supervisor tambien
-- pueden verlo (Requisito 6.7: descender de Iglesia a Red).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_dashboard_lider_red(p_red_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
  v_semana_lunes DATE := date_trunc('week', p_fecha)::date;
  v_semana_domingo DATE := (date_trunc('week', p_fecha) + interval '6 days')::date;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'red', (SELECT jsonb_build_object('id', r.id, 'nombre', r.nombre) FROM red r WHERE r.id = p_red_id),
    'kpi', jsonb_build_object(
      'cdp_activas', (
        SELECT count(*) FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND c.activo AND c.fecha_eliminacion IS NULL
      ),
      'miembros_totales', (
        SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
        JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = m.casa_de_paz_id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
      ),
      'asistencia_promedio', (
        SELECT round(avg(vt.total_asistentes), 1) FROM v_reporte_totales vt
        JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = vt.casa_de_paz_id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
      ),
      'ofrendas_mes', (
        SELECT jsonb_agg(jsonb_build_object('moneda', x.moneda_codigo, 'total', x.total))
        FROM (
          SELECT moneda_codigo, sum(total) AS total FROM fn_ingresos_red(p_red_id, v_mes_desde, v_mes_hasta)
          GROUP BY moneda_codigo
        ) x
      )
    ),
    -- Sirve a la vez como "asistencia de la ultima reunion por CdP" (Req 4.2)
    -- y como ranking (Req 4.3): ya viene ordenado por asistencia.
    'casas_de_paz', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ultima_asistencia DESC NULLS LAST)
      FROM (
        SELECT
          c.id AS casa_de_paz_id, fn_etiqueta_cdp(c.id) AS etiqueta,
          (SELECT vt.total_asistentes FROM v_reporte_totales vt
           WHERE vt.casa_de_paz_id = c.id ORDER BY vt.fecha_reunion DESC LIMIT 1) AS ultima_asistencia,
          (SELECT vt.fecha_reunion FROM v_reporte_totales vt
           WHERE vt.casa_de_paz_id = c.id ORDER BY vt.fecha_reunion DESC LIMIT 1) AS ultima_fecha
        FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
        WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND c.activo AND c.fecha_eliminacion IS NULL
      ) x
    ),
    'cdp_sin_reporte_semana', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'etiqueta', fn_etiqueta_cdp(c.id)))
      FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
      WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
        AND c.activo AND c.fecha_eliminacion IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM casa_de_paz_reporte rep
          WHERE rep.casa_de_paz_id = c.id AND rep.fecha_reunion BETWEEN v_semana_lunes AND v_semana_domingo
            AND rep.fecha_eliminacion IS NULL
        )
    ),
    'ingresos', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_ingresos_red(p_red_id, v_mes_desde, v_mes_hasta) x)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

-- ============================================================
-- Dashboard del Supervisor (Requisito 5). Las alertas (5.5-5.10) ya
-- estaban en fn_alertas_supervisor, se reusan tal cual.
--
-- Nota de alcance: el Requisito 5.3 pide "tendencia" de personas activas
-- por Departamento -- el esquema no tiene una tabla que vincule personas a
-- Departamento (Departamento hoy es solo un catalogo de 4 nombres con
-- activo/inactivo, usado para el toggle del Panel del Supervisor). Sin un
-- modelo de datos para eso, se expone la lista de Departamentos activos
-- (Req 5.4 -- ocultar los desactivados) sin el conteo/tendencia de
-- personas, que queda pendiente de decidir con el owner.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_dashboard_supervisor(p_iglesia_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
  v_resultado JSONB;
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'kpi', jsonb_build_object(
      'redes', (SELECT count(*) FROM red r WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL),
      'cdp', (SELECT count(*) FROM casa_de_paz c WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL),
      'miembros_totales', (
        SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
        WHERE m.iglesia_id = p_iglesia_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
      ),
      'asistencia_promedio', (
        SELECT round(avg(vt.total_asistentes), 1) FROM v_reporte_totales vt
        JOIN casa_de_paz c ON c.id = vt.casa_de_paz_id
        WHERE c.iglesia_id = p_iglesia_id AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
      ),
      'ingresos_mes', (
        SELECT jsonb_agg(jsonb_build_object('moneda', x.moneda_codigo, 'total', x.total))
        FROM (
          SELECT m.codigo AS moneda_codigo, sum(fi.monto) AS total
          FROM finanzas_ingreso fi JOIN moneda m ON m.id = fi.moneda_id
          WHERE fi.iglesia_id = p_iglesia_id AND fi.fecha BETWEEN v_mes_desde AND v_mes_hasta AND fi.fecha_eliminacion IS NULL
          GROUP BY m.codigo
        ) x
      )
    ),
    'redes_detalle', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'nombre', r.nombre,
        'cdp', (SELECT count(*) FROM casa_de_paz c JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
                WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
                  AND c.activo AND c.fecha_eliminacion IS NULL),
        'miembros', (
          SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
          JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = m.casa_de_paz_id
          WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
            AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
        ),
        'asistencia_promedio', (
          SELECT round(avg(vt.total_asistentes), 1) FROM v_reporte_totales vt
          JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = vt.casa_de_paz_id
          WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
            AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
        ),
        'incompleta', COALESCE(fi.falta_departamentos OR fi.falta_ministerio, false)
      ) ORDER BY r.nombre)
      FROM red r
      LEFT JOIN fn_redes_incompletas(p_iglesia_id) fi ON fi.red_id = r.id
      WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL
    ),
    'departamentos_activos', (
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre) ORDER BY d.nombre)
      FROM departamento d WHERE d.iglesia_id = p_iglesia_id AND d.activo AND d.fecha_eliminacion IS NULL
    ),
    'estados', (SELECT jsonb_agg(to_jsonb(x)) FROM fn_conteo_estados(p_iglesia_id) x),
    'alertas', fn_alertas_supervisor(p_iglesia_id)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

-- ============================================================
-- Dashboard del Sublider (Requisito 3): mismas secciones que el Lider,
-- ocultando lo que la configuracion de la iglesia no habilita. Se hace acá
-- (base de datos), no en el frontend (Requisito 3.5).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_dashboard_sublider_cdp(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_sublider_cdp(p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: se requiere ser Sublider vigente de la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  v_resultado := fn_dashboard_lider_cdp(p_casa_de_paz_id, p_fecha);

  IF NOT fn_config_bool(v_iglesia_id, 'SUBLIDER_VE_OFRENDAS') THEN
    v_resultado := v_resultado #- '{kpi,ingresos_mes}';
  END IF;
  IF NOT (fn_config_bool(v_iglesia_id, 'SUBLIDER_VE_GRAFICOS') OR fn_config_bool(v_iglesia_id, 'SUBLIDER_VE_HISTORIAL')) THEN
    v_resultado := v_resultado #- '{asistencia_historico}';
  END IF;

  RETURN v_resultado;
END;
$$;
