-- VisionHub -- 78_dashboard_cdp_nombre_dinamico.sql
-- Bug real reportado por el owner (2026-08-02): el dashboard del Lider/Sublider
-- de CdP mostraba el titulo generico "Tu Casa de Paz" casi siempre, porque
-- fn_dashboard_lider_cdp devolvia `casa_de_paz.nombre` -- la columna manual,
-- que en la practica casi nunca se llena porque las CdP se identifican por su
-- lider, no por un nombre propio -- y el frontend (DashboardLiderCdp.tsx) solo
-- caia al nombre real cuando esa columna estaba seteada.
--
-- fn_etiqueta_cdp (23_etiqueta_cdp.sql) ya resuelve exactamente esto: usa el
-- nombre manual si existe, si no arma "Casa de Paz de {lider}" / "Casa de Paz
-- sin lider". Es la misma funcion que ya usan GestionSubliderVista, Visitas,
-- Finanzas, etc. -- fn_dashboard_lider_cdp era la unica que todavia leia la
-- columna cruda. CREATE OR REPLACE alcanza (JSONB, no RETURNS TABLE).

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
        'id', c.id, 'nombre', fn_etiqueta_cdp(c.id),
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
