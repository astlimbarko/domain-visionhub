-- KAN-419 seguimiento (2026-09-22, pedido explicito del owner): el buscador
-- de Disertador/Evangelizado por debe intentar 3 niveles en orden, no 2 --
-- primero la Casa de Paz activa, si ahi no aparece nadie entonces toda la
-- Red de esa CdP (mas probable que toda la iglesia), y recien si tampoco
-- hay resultado ahi, toda la iglesia. Mismo CREATE OR REPLACE (firma
-- identica a la version anterior), sin cambios en el frontend.

begin;

CREATE OR REPLACE FUNCTION public.fn_buscar_personas_reporte(
  p_iglesia_id UUID,
  p_texto TEXT,
  p_edad_minima INT DEFAULT NULL,
  p_cdp_id UUID DEFAULT NULL,
  p_limite INT DEFAULT 10
)
RETURNS TABLE (id UUID, nombre_completo TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tokens TEXT[];
  v_red_id UUID;
  v_count INT;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  v_tokens := regexp_split_to_array(btrim(coalesce(p_texto, '')), '\s+');
  IF v_tokens IS NULL OR array_length(v_tokens, 1) IS NULL OR v_tokens[1] = '' THEN
    RETURN;
  END IF;

  -- Nivel 1: dentro de la Casa de Paz activa.
  IF p_cdp_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, fn_nombre_completo(p)
    FROM persona p
    JOIN casa_de_paz_membresia cm
      ON cm.persona_id = p.id AND cm.casa_de_paz_id = p_cdp_id
      AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
    WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
      AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
           OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
      AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
    ORDER BY p.primer_apellido, p.primer_nombre
    LIMIT p_limite;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RETURN; END IF;

    -- Nivel 2: toda la Red de esa Casa de Paz.
    SELECT red_id INTO v_red_id FROM casa_de_paz_red
      WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
      LIMIT 1;

    IF v_red_id IS NOT NULL THEN
      RETURN QUERY
      SELECT p.id, fn_nombre_completo(p)
      FROM persona p
      JOIN casa_de_paz_membresia cm
        ON cm.persona_id = p.id
        AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
      JOIN casa_de_paz_red cr
        ON cr.casa_de_paz_id = cm.casa_de_paz_id
        AND cr.red_id = v_red_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
      WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
        AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
             OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
        AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
      ORDER BY p.primer_apellido, p.primer_nombre
      LIMIT p_limite;

      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN RETURN; END IF;
    END IF;
  END IF;

  -- Nivel 3: toda la iglesia.
  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
    AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
         OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
    AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_buscar_personas_reporte(UUID, TEXT, INT, UUID, INT) TO authenticated;

commit;
