-- VisionHub -- KAN-249 (pedido del owner, 2026-08-22): el color elegido
-- para una Red en el Constructor (Estructura Organizacional) no se veia
-- reflejado en el banner del dashboard del Lider de Red ni en el del
-- Lider de Casa de Paz -- quedaban siempre con el degradado azul marino
-- institucional generico, sin importar el color configurado.
--
-- Agrega el color de la Red al resultado de las 2 funciones de dashboard.
-- CREATE OR REPLACE alcanza (RETURNS jsonb en ambas, la firma de parametros
-- no cambia -- no aplica el problema de KAN-247/KAN-90 con DROP+CREATE de
-- funciones con RETURNS TABLE).

CREATE OR REPLACE FUNCTION public.fn_dashboard_lider_red(p_red_id uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'red', (SELECT jsonb_build_object('id', r.id, 'nombre', r.nombre, 'color', r.color) FROM red r WHERE r.id = p_red_id),
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_dashboard_lider_cdp(p_casa_de_paz_id uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'id', c.id, 'nombre', fn_etiqueta_cdp(c.id),
        'red', (SELECT r.nombre FROM casa_de_paz_red cdr JOIN red r ON r.id = cdr.red_id
                WHERE cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL),
        'red_color', (SELECT r.color FROM casa_de_paz_red cdr JOIN red r ON r.id = cdr.red_id
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
$function$;
