-- VisionHub -- 55_calendario_evangelismo_red.sql
-- Calendario y Evangelismo a nivel Red para el Lider de Red. Hasta ahora
-- Calendario.tsx/Evangelismo.tsx solo funcionaban en contexto de una CdP
-- propia (useMisCasasDePaz), asi que un Lider de Red puro (sin cargo de
-- Lider/Sublider de CdP) veia el placeholder vacio -- las dos secciones
-- estaban rotas en la practica pese a estar en su menu.
--
-- No hace falta tocar RLS ni tablas existentes:
--   - `evento.red_id` y pol_evento_insert/update (16_rls.sql) YA permiten a
--     fn_es_lider_de_red(red_id) crear/editar eventos "de la Red" para
--     cualquier tipo_evento, visibles en todas sus CdP via el OR de
--     fn_eventos_cdp (13_calendario.sql). Solo falta un punto de entrada por
--     red_id (sin depender de una CdP "semilla").
--   - `meta_evangelismo_asignada` y pol_meta_asignada_insert (16_rls.sql) YA
--     permiten a fn_es_rol_superior_de_cdp asignar meta; solo falta lectura
--     agregada por red (nada en el front la usaba todavia).

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
  -- `red.id` calificado a proposito: la funcion declara una columna de salida
  -- `id` (RETURNS TABLE), que plpgsql expone como variable en todo el cuerpo
  -- -- un `WHERE id = ...` sin calificar es ambiguo entre esa variable y la
  -- columna real de la tabla.
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
         'RED'::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND e.red_id = p_red_id
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION fn_proximos_red(p_red_id UUID)
RETURNS TABLE (clase VARCHAR, titulo TEXT, fecha DATE, dias_faltantes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ventana AS (
    SELECT CURRENT_DATE AS desde,
           (CURRENT_DATE + (fn_criterio((SELECT iglesia_id FROM red WHERE id = p_red_id), 'DIAS_AVISO_EVENTO') || ' days')::interval)::date AS hasta
  )
  SELECT 'EVENTO'::VARCHAR, e.titulo::TEXT, e.fecha_inicio AS fecha, (e.fecha_inicio - CURRENT_DATE)::int
  FROM fn_eventos_red(p_red_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) e
  ORDER BY fecha;
$$;

-- ============================================================
-- Evangelismo agregado de toda la Red (todas las CdP miembro).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_evangelismo_red(p_red_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (
  id UUID, casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT, persona_id UUID, nombre_completo TEXT,
  fecha DATE, domicilio TEXT, tipo_evangelismo_nombre VARCHAR, tipo_evangelismo_color CHAR(7)
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
  SELECT ev.id, ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id), ev.persona_id, fn_nombre_completo(p),
         ev.fecha, ev.domicilio, te.nombre, te.color
  FROM evangelismo ev
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = ev.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  JOIN casa_de_paz c ON c.id = ev.casa_de_paz_id AND c.activo AND c.fecha_eliminacion IS NULL
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  WHERE cdr.red_id = p_red_id
    AND ev.fecha_eliminacion IS NULL
    AND ev.fecha BETWEEN p_desde AND p_hasta
  ORDER BY ev.fecha DESC;
END;
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
    SELECT m.meta FROM cdps CROSS JOIN LATERAL fn_meta_efectiva(cdps.id, p_hasta) m
  )
  SELECT c.n, COALESCE(SUM(metas.meta), 0)::INTEGER AS meta_total,
         COUNT(metas.meta)::INTEGER AS cdp_con_meta,
         (SELECT COUNT(*) FROM cdps)::INTEGER AS cdp_total,
         CASE WHEN COALESCE(SUM(metas.meta), 0) = 0 THEN NULL ELSE round((c.n::numeric / SUM(metas.meta)) * 100, 2) END AS tasa
  FROM conteo c LEFT JOIN metas ON true
  GROUP BY c.n;
END;
$$;

-- Meta efectiva actual de cada CdP de la red -- para la lista de "Asignar
-- metas" del Lider de Red (12_evangelismo.sql ya trae fn_meta_efectiva).
CREATE OR REPLACE FUNCTION fn_metas_cdp_red(p_red_id UUID)
RETURNS TABLE (casa_de_paz_id UUID, etiqueta TEXT, meta INTEGER, origen VARCHAR)
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
  SELECT c.id, fn_etiqueta_cdp(c.id), m.meta, m.origen
  FROM casa_de_paz c
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
  LEFT JOIN LATERAL fn_meta_efectiva(c.id, CURRENT_DATE) m ON true
  WHERE cdr.red_id = p_red_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
    AND c.activo AND c.fecha_eliminacion IS NULL
  ORDER BY fn_etiqueta_cdp(c.id);
END;
$$;
