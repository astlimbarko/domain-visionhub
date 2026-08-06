-- VisionHub -- 102_fix_ingresos_red_etiqueta_cdp.sql
-- Bug real reportado por el owner (2026-08-06): en Finanzas del Supervisor y en
-- el dashboard del Lider/Supervisor de Red, el desglose de ingresos "por Casa
-- de Paz" no terminaba de aparecer para las CdP al elegir un rango de fechas
-- con movimientos reales.
--
-- Causa: fn_ingresos_red (14_finanzas.sql) devolvia `casa_de_paz.nombre` --
-- la columna manual que, igual que ya se documento en
-- 78_dashboard_cdp_nombre_dinamico.sql y 97_fix_nombre_cdp_vacio_registro_via_url.sql,
-- queda NULL a proposito en casi todas las CdP (se identifican por su lider,
-- no por un nombre propio -- fn_etiqueta_cdp calcula el nombre a mostrar).
-- El frontend (agruparFinanzasPorCdp, BloqueFinanciero.tsx) agrupa los
-- ingresos por ese nombre y los cruza contra `etiqueta` (la que sí viene de
-- fn_etiqueta_cdp via fn_listar_cdp) para precargar una fila por CdP -- al no
-- coincidir, los ingresos de cualquier CdP sin nombre manual caian todos
-- juntos bajo un unico bucket ficticio "Sin Casa de Paz" en vez de aparecer
-- bajo su fila real. Mismo bug, cuarta aparicion en el proyecto.
--
-- fn_dashboard_lider_red, en el mismo archivo 36_dashboards_completos.sql, ya
-- usa fn_etiqueta_cdp(c.id) correctamente para 'casas_de_paz' y
-- 'cdp_sin_reporte_semana' -- solo fn_ingresos_red se habia quedado leyendo
-- la columna cruda. CREATE OR REPLACE alcanza (misma firma).

CREATE OR REPLACE FUNCTION fn_ingresos_red(p_red_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (casa_de_paz_nombre VARCHAR, tipo_codigo VARCHAR, moneda_codigo CHAR(3), moneda_simbolo VARCHAR, total NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT fn_etiqueta_cdp(c.id)::VARCHAR, t.codigo, m.codigo, m.simbolo, sum(i.monto)
  FROM finanzas_ingreso i
  JOIN finanzas_tipo_ingreso t ON t.id = i.tipo_ingreso_id
  JOIN moneda m ON m.id = i.moneda_id
  JOIN casa_de_paz c ON c.id = i.casa_de_paz_id
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  WHERE cdr.red_id = p_red_id AND i.fecha BETWEEN p_desde AND p_hasta AND i.fecha_eliminacion IS NULL
  GROUP BY c.id, t.codigo, m.codigo, m.simbolo, t.orden, m.orden
  ORDER BY fn_etiqueta_cdp(c.id), t.orden, m.orden;
END;
$$;
