-- VisionHub -- 103_evangelismo_meta_supervisor_red.sql
-- Pedido del owner (2026-08-06): el Supervisor de la Vision en Accion ve el
-- mismo Evangelismo que el Lider de Red (EvangelismoRed.tsx), pudiendo elegir
-- cualquier Red de la iglesia, y puede asignarle una meta propia a cada Red --
-- algo nuevo, hasta ahora inexistente. Esa meta debe repercutir de verdad:
-- si vale, se hereda hacia las Casas de Paz de esa Red que no tengan ya su
-- propia meta asignada por su Lider de Red, y bloquea que esas CdP toquen su
-- meta propia hasta cumplirla -- mismo criterio que ya aplica una meta
-- asignada CdP-especifica.
--
-- El esquema para esto ya existia y esta aplicado en produccion, sin usar:
-- meta_evangelismo_asignada.red_id (81_meta_global_red.sql), su exclusion de
-- solapamiento, y una policy de INSERT bifurcada que ya permite que un
-- Supervisor inserte una fila red_id-scoped. Solo se habia borrado la funcion
-- de lectura fn_meta_global_red (83_limpieza_meta_global.sql) por quedar sin
-- caller -- este trabajo le da un caller real.
--
-- "Meta Global de la Red" (la suma de las metas por CdP) NO se toca -- el
-- owner confirmo que debe convivir como un numero aparte, no reemplazarla.
-- Por eso el origen nuevo se distingue como 'ASIGNADA_RED' (no 'ASIGNADA' a
-- secas): fn_tasa_evangelismo_red excluye ese origen de su SUM para no
-- contar la misma meta heredada una vez por cada CdP que la hereda.

-- ============================================================
-- 1) fn_meta_efectiva: nuevo tercer nivel (Red, origen ASIGNADA_RED) entre la
--    meta CdP-especifica (ASIGNADA) y la propia (PROPIA). Cada branch queda
--    NOT EXISTS-guardado contra los de mayor prioridad -- la funcion sigue
--    devolviendo como maximo 1 fila.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_meta_efectiva(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (meta INTEGER, origen VARCHAR)
LANGUAGE sql STABLE
AS $$
  (SELECT ma.meta, 'ASIGNADA'::VARCHAR
   FROM meta_evangelismo_asignada ma
   WHERE ma.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma.fecha_inicio AND ma.fecha_fin AND ma.fecha_eliminacion IS NULL
   LIMIT 1)

  UNION ALL

  (SELECT ma.meta, 'ASIGNADA_RED'::VARCHAR
   FROM meta_evangelismo_asignada ma
   JOIN casa_de_paz_red cdr ON cdr.red_id = ma.red_id AND cdr.casa_de_paz_id = p_casa_de_paz_id
     AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
   WHERE ma.red_id IS NOT NULL AND p_fecha BETWEEN ma.fecha_inicio AND ma.fecha_fin AND ma.fecha_eliminacion IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma2
       WHERE ma2.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma2.fecha_inicio AND ma2.fecha_fin AND ma2.fecha_eliminacion IS NULL
     )
   LIMIT 1)

  UNION ALL

  (SELECT c.meta_evangelismo, 'PROPIA'::VARCHAR
   FROM casa_de_paz c
   WHERE c.id = p_casa_de_paz_id AND c.meta_evangelismo IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma2
       WHERE ma2.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma2.fecha_inicio AND ma2.fecha_fin AND ma2.fecha_eliminacion IS NULL
     )
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma3
       JOIN casa_de_paz_red cdr3 ON cdr3.red_id = ma3.red_id AND cdr3.casa_de_paz_id = p_casa_de_paz_id
         AND cdr3.fecha_fin IS NULL AND cdr3.fecha_eliminacion IS NULL
       WHERE ma3.red_id IS NOT NULL AND p_fecha BETWEEN ma3.fecha_inicio AND ma3.fecha_fin AND ma3.fecha_eliminacion IS NULL
     )
   LIMIT 1);
$$;

-- ============================================================
-- 2) fn_bloquear_meta_propia_bajo_asignada: mismo fallback -- si no hay una
--    meta CdP-especifica vigente, busca una red_id-scoped que cubra la Red
--    actual de esa CdP antes de dejar pasar el UPDATE sin bloqueo.
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
    SELECT ma.meta, ma.fecha_inicio, ma.fecha_fin INTO v_asignada
    FROM meta_evangelismo_asignada ma
    JOIN casa_de_paz_red cdr ON cdr.red_id = ma.red_id AND cdr.casa_de_paz_id = NEW.id
      AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
    WHERE ma.red_id IS NOT NULL AND ma.fecha_eliminacion IS NULL
      AND CURRENT_DATE BETWEEN ma.fecha_inicio AND ma.fecha_fin
    LIMIT 1;
  END IF;

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

-- ============================================================
-- 3) fn_tasa_evangelismo_red: el SUM de meta_total excluye origen
--    ASIGNADA_RED para no contar la misma meta heredada una vez por cada CdP
--    que la hereda -- "Meta Global de la Red" sigue siendo exactamente lo
--    que era antes de esta migracion.
-- ============================================================
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
    SELECT m.meta, m.origen FROM cdps CROSS JOIN LATERAL fn_meta_efectiva(cdps.id, CURRENT_DATE) m
  )
  SELECT c.n,
         COALESCE(SUM(metas.meta) FILTER (WHERE metas.origen IS DISTINCT FROM 'ASIGNADA_RED'), 0)::INTEGER AS meta_total,
         COUNT(metas.meta)::INTEGER AS cdp_con_meta,
         (SELECT COUNT(*) FROM cdps)::INTEGER AS cdp_total,
         CASE WHEN COALESCE(SUM(metas.meta) FILTER (WHERE metas.origen IS DISTINCT FROM 'ASIGNADA_RED'), 0) = 0 THEN NULL
              ELSE round((c.n::numeric / SUM(metas.meta) FILTER (WHERE metas.origen IS DISTINCT FROM 'ASIGNADA_RED')) * 100, 2) END AS tasa
  FROM conteo c LEFT JOIN metas ON true
  GROUP BY c.n;
END;
$$;
