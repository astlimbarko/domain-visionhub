-- VisionHub -- 100_calendario_ambito_iglesia.sql
-- Panel del Supervisor de la Vision en Accion (2026-08-04): hoy `Calendario.tsx`
-- solo tiene ramas para Lider de Red (CalendarioRed) y para quien lidera/
-- sublidera una Casa de Paz -- Supervisor y Pastor caen siempre en el
-- placeholder vacio. Se agrega un tercer ambito de evento, IGLESIA (ademas de
-- CDP y RED que ya existian, 13_calendario.sql/55_calendario_evangelismo_red.sql),
-- con el mismo patron de cascada que ya usa RED -> CDP: un evento "de toda la
-- iglesia" se ve automaticamente en el calendario de cada Red y cada CdP de
-- esa iglesia.
--
-- NOTA: esta migracion gatea el ambito IGLESIA con fn_es_operativo_en simple
-- (Pastor/Supervisor de esa iglesia). La siguiente (101_calendario_padre_satelite.sql)
-- la extiende para que el Pastor/Supervisor de una iglesia padre tambien
-- pueda crear/ver el calendario de su iglesia hija/satelite.

-- ============================================================
-- 1. Relajar el ambito: CDP, RED o IGLESIA (antes exigia CDP o RED, nunca los
--    dos en cero). Un evento de iglesia se identifica por AMBOS nulos, sin
--    agregar columna.
-- ============================================================
ALTER TABLE evento DROP CONSTRAINT chk_evento_ambito;
ALTER TABLE evento ADD CONSTRAINT chk_evento_ambito
  CHECK ((casa_de_paz_id IS NOT NULL)::int + (red_id IS NOT NULL)::int <= 1);

CREATE INDEX idx_evento_iglesia_fecha ON evento (iglesia_id, fecha_inicio)
  WHERE casa_de_paz_id IS NULL AND red_id IS NULL AND fecha_eliminacion IS NULL;

-- ============================================================
-- 2. fn_eventos_iglesia / fn_proximos_iglesia -- mismo shape que
--    fn_eventos_red/fn_proximos_red (55_calendario_evangelismo_red.sql),
--    punto de entrada del calendario propio de una iglesia.
-- ============================================================
CREATE FUNCTION fn_eventos_iglesia(
  p_iglesia_id UUID, p_desde DATE, p_hasta DATE, p_tipo_evento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, titulo VARCHAR, descripcion TEXT, tipo_codigo VARCHAR, tipo_nombre VARCHAR,
  color CHAR(7), icono VARCHAR, fecha_inicio DATE, fecha_fin DATE, hora_inicio TIME, hora_fin TIME,
  es_multi_dia BOOLEAN, ambito VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: sin acceso a la iglesia %', p_iglesia_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         'IGLESIA'::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND e.iglesia_id = p_iglesia_id AND e.casa_de_paz_id IS NULL AND e.red_id IS NULL
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_eventos_iglesia(UUID, DATE, DATE, UUID) TO authenticated;

CREATE FUNCTION fn_proximos_iglesia(p_iglesia_id UUID)
RETURNS TABLE (clase VARCHAR, titulo TEXT, fecha DATE, dias_faltantes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ventana AS (
    SELECT CURRENT_DATE AS desde,
           (CURRENT_DATE + (fn_criterio(p_iglesia_id, 'DIAS_AVISO_EVENTO') || ' days')::interval)::date AS hasta
  )
  SELECT 'EVENTO'::VARCHAR, e.titulo::TEXT, e.fecha_inicio AS fecha, (e.fecha_inicio - CURRENT_DATE)::int
  FROM fn_eventos_iglesia(p_iglesia_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) e
  ORDER BY fecha;
$$;

GRANT EXECUTE ON FUNCTION fn_proximos_iglesia(UUID) TO authenticated;

-- ============================================================
-- 3. Cascada hacia abajo: un evento de IGLESIA aparece tambien en el
--    calendario de cada Red y cada CdP de esa iglesia (mismo patron que ya
--    usa RED -> CDP).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_eventos_cdp(
  p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE, p_tipo_evento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, titulo VARCHAR, descripcion TEXT, tipo_codigo VARCHAR, tipo_nombre VARCHAR,
  color CHAR(7), icono VARCHAR, fecha_inicio DATE, fecha_fin DATE, hora_inicio TIME, hora_fin TIME,
  es_multi_dia BOOLEAN, ambito VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT cdp.iglesia_id INTO v_iglesia_id FROM casa_de_paz cdp WHERE cdp.id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         CASE WHEN e.red_id IS NOT NULL THEN 'RED' WHEN e.casa_de_paz_id IS NOT NULL THEN 'CDP' ELSE 'IGLESIA' END::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND (
      e.casa_de_paz_id = p_casa_de_paz_id
      OR e.red_id = (
        SELECT cdr.red_id FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = p_casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
      )
      OR (e.casa_de_paz_id IS NULL AND e.red_id IS NULL AND e.iglesia_id = v_iglesia_id)
    )
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION fn_eventos_red(
  p_red_id UUID, p_desde DATE, p_hasta DATE, p_tipo_evento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, titulo VARCHAR, descripcion TEXT, tipo_codigo VARCHAR, tipo_nombre VARCHAR,
  color CHAR(7), icono VARCHAR, fecha_inicio DATE, fecha_fin DATE, hora_inicio TIME, hora_fin TIME,
  es_multi_dia BOOLEAN, ambito VARCHAR
)
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
  SELECT e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         CASE WHEN e.red_id IS NOT NULL THEN 'RED' ELSE 'IGLESIA' END::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND (
      e.red_id = p_red_id
      OR (e.casa_de_paz_id IS NULL AND e.red_id IS NULL AND e.iglesia_id = v_iglesia_id)
    )
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$$;

-- ============================================================
-- 4. RLS: permitir INSERT/UPDATE de eventos de ambito IGLESIA a quien sea
--    Pastor/Supervisor de esa iglesia (mismo criterio que fn_eventos_iglesia).
-- ============================================================
DROP POLICY pol_evento_insert ON evento;
CREATE POLICY pol_evento_insert ON evento
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
      OR (casa_de_paz_id IS NULL AND red_id IS NULL AND fn_es_operativo_en(iglesia_id))
    )
  );

DROP POLICY pol_evento_update ON evento;
CREATE POLICY pol_evento_update ON evento
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
      OR (casa_de_paz_id IS NULL AND red_id IS NULL AND fn_es_operativo_en(iglesia_id))
    )
  );
