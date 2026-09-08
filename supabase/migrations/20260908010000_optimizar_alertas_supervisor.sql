-- VisionHub -- segunda parte de la optimización del Dashboard del
-- Supervisor (2026-09-08). El bloque `miembros_inactivos` de
-- fn_alertas_supervisor llamaba a fn_inactividad_cdp(cdp_id) una vez POR
-- CADA Casa de Paz de la iglesia (25 invocaciones separadas para la iglesia
-- real más grande en producción) -- cada llamada es una función PL/pgSQL
-- aparte con su propio chequeo de permiso (fn_mis_iglesias()) y su propia
-- subquery correlacionada por miembro.
--
-- Fix: se aplana la misma lógica de fn_inactividad_cdp a una sola consulta
-- que cubre TODAS las Casas de Paz de la iglesia de una vez (un solo
-- fn_criterio(), sin repetir el chequeo de permiso 25 veces). Verificado
-- antes de aplicar: 0 discrepancias comparando persona por persona (167
-- miembros) contra la lógica anterior, en la iglesia real con más datos.
-- fn_inactividad_cdp en sí no se toca (la sigue usando el detalle de una
-- CdP puntual en otras pantallas) -- solo se deja de invocar en bucle acá.

CREATE OR REPLACE FUNCTION public.fn_alertas_supervisor(p_iglesia_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
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
      WITH miembros AS (
        SELECT m.persona_id, m.casa_de_paz_id
        FROM casa_de_paz_membresia m
        JOIN casa_de_paz c ON c.id = m.casa_de_paz_id
        WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL
          AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
      ),
      ultima AS (
        SELECT mi.persona_id, mi.casa_de_paz_id, MAX(r.fecha_reunion) AS ultima_fecha
        FROM miembros mi
        LEFT JOIN casa_de_paz_asistencia a ON a.persona_id = mi.persona_id AND a.fecha_eliminacion IS NULL
        LEFT JOIN casa_de_paz_reporte r ON r.id = a.reporte_id AND r.casa_de_paz_id = mi.casa_de_paz_id AND r.fecha_eliminacion IS NULL
        GROUP BY mi.persona_id, mi.casa_de_paz_id
      ),
      reportes_totales_cdp AS (
        SELECT casa_de_paz_id, count(*) AS total_reportes
        FROM casa_de_paz_reporte
        WHERE fecha_eliminacion IS NULL
        GROUP BY casa_de_paz_id
      ),
      reportes_hasta_fecha AS (
        SELECT u.persona_id, u.casa_de_paz_id,
          (SELECT count(*)::int FROM casa_de_paz_reporte r2
           WHERE r2.casa_de_paz_id = u.casa_de_paz_id AND r2.fecha_eliminacion IS NULL
             AND u.ultima_fecha IS NOT NULL AND r2.fecha_reunion > u.ultima_fecha) AS reportes_despues
        FROM ultima u WHERE u.ultima_fecha IS NOT NULL
      ),
      faltadas AS (
        SELECT u.persona_id, u.casa_de_paz_id,
          COALESCE(rhf.reportes_despues, rt.total_reportes, 0) AS n_faltadas
        FROM ultima u
        LEFT JOIN reportes_hasta_fecha rhf ON rhf.persona_id = u.persona_id AND rhf.casa_de_paz_id = u.casa_de_paz_id
        LEFT JOIN reportes_totales_cdp rt ON rt.casa_de_paz_id = u.casa_de_paz_id AND u.ultima_fecha IS NULL
      )
      SELECT jsonb_agg(jsonb_build_object('casa_de_paz', c.nombre, 'cantidad', x.cantidad))
      FROM (
        SELECT f.casa_de_paz_id, count(*) AS cantidad
        FROM faltadas f
        WHERE f.n_faltadas >= fn_criterio(p_iglesia_id, 'INASISTENCIAS_PARA_INACTIVO')
        GROUP BY f.casa_de_paz_id
      ) x
      JOIN casa_de_paz c ON c.id = x.casa_de_paz_id
      WHERE x.cantidad > 0
    )
  );
END;
$function$;
