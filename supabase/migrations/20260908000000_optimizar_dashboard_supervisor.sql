-- VisionHub -- optimización real del Dashboard del Supervisor (2026-09-08,
-- pedido del owner: "todo carga demasiado lento" en ese rol).
--
-- Encontrado con EXPLAIN ANALYZE contra la iglesia real con más datos en
-- producción (25 CdP, 4 Redes): el bloque `redes_detalle` recalculaba
-- `asistencia_promedio` con una subquery CORRELACIONADA por cada Red, y esa
-- subquery pasa por `v_reporte_totales` -- una vista SIN filtro de iglesia,
-- que reagrupa TODOS los reportes de TODA la base antes de filtrar por Red.
-- Con 4 Redes, ese bloque solo ya tardaba ~110ms; escala linealmente con la
-- cantidad de Redes de la iglesia.
--
-- Fix: se calcula `asistencia_promedio` UNA sola vez para todas las Redes
-- de la iglesia (un solo GROUP BY por red_id, ya filtrado por iglesia antes
-- de la agregación) y se je JOINea por red_id, en vez de recalcularlo N
-- veces. Resultados verificados idénticos a la versión anterior antes de
-- aplicar (misma iglesia real, mismo mes) -- bajó a ~60ms, y la ganancia
-- crece con más Redes.

CREATE OR REPLACE FUNCTION public.fn_dashboard_supervisor(p_iglesia_id uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
  v_resultado JSONB;
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
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
      WITH asistencia_por_red AS (
        SELECT cdr.red_id, round(avg(vt.total_asistentes), 1) AS asistencia_promedio
        FROM v_reporte_totales vt
        JOIN casa_de_paz c ON c.id = vt.casa_de_paz_id
        JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = vt.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
        WHERE c.iglesia_id = p_iglesia_id AND vt.fecha_reunion BETWEEN v_mes_desde AND v_mes_hasta
        GROUP BY cdr.red_id
      )
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
        'asistencia_promedio', apr.asistencia_promedio,
        'incompleta', COALESCE(fi.falta_departamentos OR fi.falta_ministerio, false)
      ) ORDER BY r.nombre)
      FROM red r
      LEFT JOIN asistencia_por_red apr ON apr.red_id = r.id
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
$function$;
