-- KAN-445 (2026-09-25, pedido explícito del owner): el buscador de personas
-- del Reporte de CdP ("Asistentes nuevos" y el mini-buscador de asistencia)
-- solo devolvía id + nombre -- no se podía mostrar la edad por clasificación
-- ni el estado SSVA vigente (SIM/NC/CRE/RE), a diferencia de las pastillas
-- de "Asistencia regular"/"de niños" que ya lo mostraban (KAN-435). Se
-- agregan las 2 columnas para que el buscador y las 3 listas de resultado
-- se vean consistentes entre sí.
--
-- DROP + CREATE (no CREATE OR REPLACE): Postgres no permite cambiar la
-- lista de columnas de RETURNS TABLE con CREATE OR REPLACE, mismo gotcha ya
-- documentado en 20260906020000_evangelizado_por.sql.
DROP FUNCTION IF EXISTS public.fn_buscar_personas_reporte(uuid, text, integer, uuid, integer);

CREATE FUNCTION public.fn_buscar_personas_reporte(
  p_iglesia_id UUID,
  p_texto TEXT,
  p_edad_minima INT DEFAULT NULL,
  p_cdp_id UUID DEFAULT NULL,
  p_limite INT DEFAULT 10
)
RETURNS TABLE(id UUID, nombre_completo TEXT, edad INT, estado_sigla TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SELECT p.id, fn_nombre_completo(p),
           CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
           (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
             WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1)
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
      SELECT p.id, fn_nombre_completo(p),
             CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
             (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
               WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1)
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
  SELECT p.id, fn_nombre_completo(p),
         CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
           WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
    AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
         OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
    AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;
END;
$function$;
