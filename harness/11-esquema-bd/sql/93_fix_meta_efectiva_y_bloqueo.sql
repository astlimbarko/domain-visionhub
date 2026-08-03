-- VisionHub -- 93_fix_meta_efectiva_y_bloqueo.sql
--
-- Bug reportado por el owner (2026-08-03): "ya se asignó por parte del líder
-- de red una meta y no aparece". Causa real: fn_tasa_evangelismo/
-- fn_tasa_evangelismo_red le pasaban a fn_meta_efectiva la fecha de FIN del
-- período que se está mirando (p_hasta, ej. el 31 de agosto si estás viendo
-- "Agosto"), en vez de HOY. Una meta asignada por 4 semanas (ej. 09-jul al
-- 08-ago) es una vigencia perfectamente normal que NO llega hasta el último
-- día del mes calendario -- con la lógica vieja, esa meta desaparecía de la
-- vista de "este mes" apenas el líder de red la creaba, porque fecha_fin
-- (08-ago) es anterior a p_hasta (31-ago). fn_metas_cdp_red (el listado del
-- líder de red en 55_calendario_evangelismo_red.sql) ya usaba CURRENT_DATE
-- correctamente -- por eso el líder de red SÍ veía "asignada" en su propia
-- pantalla mientras el líder de CdP no la veía en la suya.

CREATE OR REPLACE FUNCTION fn_tasa_evangelismo(p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (evangelizados BIGINT, meta INTEGER, origen VARCHAR, tasa NUMERIC)
LANGUAGE sql STABLE
AS $$
  WITH
  conteo AS (
    SELECT count(*) AS n FROM evangelismo e
    WHERE e.casa_de_paz_id = p_casa_de_paz_id AND e.fecha BETWEEN p_desde AND p_hasta AND e.fecha_eliminacion IS NULL
  ),
  m AS (SELECT * FROM fn_meta_efectiva(p_casa_de_paz_id, CURRENT_DATE))
  SELECT c.n, m.meta, m.origen,
         CASE WHEN m.meta IS NULL OR m.meta = 0 THEN NULL ELSE round((c.n::numeric / m.meta) * 100, 2) END
  FROM conteo c LEFT JOIN m ON true;
$$;

CREATE OR REPLACE FUNCTION fn_tasa_evangelismo_red(p_red_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (evangelizados BIGINT, meta_total INTEGER, cdp_con_meta INTEGER, cdp_total INTEGER, tasa NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH cdps AS (
    SELECT c.id FROM casa_de_paz c
    JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
    WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
      AND c.activo AND c.fecha_eliminacion IS NULL
  ),
  conteo AS (
    SELECT count(*) AS n FROM evangelismo e
    WHERE e.casa_de_paz_id IN (SELECT id FROM cdps) AND e.fecha BETWEEN p_desde AND p_hasta AND e.fecha_eliminacion IS NULL
  ),
  metas AS (
    SELECT m.meta FROM cdps CROSS JOIN LATERAL fn_meta_efectiva(cdps.id, CURRENT_DATE) m
  )
  SELECT c.n, COALESCE(SUM(metas.meta), 0)::INTEGER AS meta_total,
         COUNT(metas.meta)::INTEGER AS cdp_con_meta,
         (SELECT COUNT(*) FROM cdps)::INTEGER AS cdp_total,
         CASE WHEN COALESCE(SUM(metas.meta), 0) = 0 THEN NULL ELSE round((c.n::numeric / SUM(metas.meta)) * 100, 2) END AS tasa
  FROM conteo c LEFT JOIN metas ON true
  GROUP BY c.n;
END;
$$;

-- ============================================================
-- Segundo pedido del owner (2026-08-03): mientras haya una meta asignada por
-- el líder de red vigente y todavía no se cumplió, el líder de la CdP no
-- puede tocar su meta propia -- tiene que alcanzar la de la red primero. Un
-- rol superior de esa CdP (el mismo líder de red que la impuso, un supervisor,
-- etc.) sí puede seguir editando sin esta traba.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_bloquear_meta_propia_bajo_asignada()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_asignada RECORD;
  v_evangelizados INTEGER;
BEGIN
  IF NEW.meta_evangelismo IS NOT DISTINCT FROM OLD.meta_evangelismo THEN
    RETURN NEW;
  END IF;

  IF fn_es_rol_superior_de_cdp(NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT meta, fecha_inicio, fecha_fin INTO v_asignada
  FROM meta_evangelismo_asignada
  WHERE casa_de_paz_id = NEW.id AND fecha_eliminacion IS NULL
    AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
  LIMIT 1;

  IF v_asignada IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_evangelizados
  FROM evangelismo
  WHERE casa_de_paz_id = NEW.id AND fecha_eliminacion IS NULL
    AND fecha BETWEEN v_asignada.fecha_inicio AND v_asignada.fecha_fin;

  IF v_evangelizados < v_asignada.meta THEN
    RAISE EXCEPTION 'META_ASIGNADA_SIN_CUMPLIR: tu red te asignó una meta de % (llevás %) -- no podés cambiar tu meta propia hasta alcanzarla', v_asignada.meta, v_evangelizados USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_meta_propia_bajo_asignada ON casa_de_paz;
CREATE TRIGGER trg_bloquear_meta_propia_bajo_asignada
BEFORE UPDATE ON casa_de_paz
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_meta_propia_bajo_asignada();
