-- KAN-449 (2026-09-25, pedido explícito del owner, probado en vivo): el
-- backend ya permite marcar asistencia cruzada entre iglesia madre y
-- satélite (fn_validar_asistencia usa fn_son_madre_satelite_vigente para
-- no bloquearla, KAN-251), pero fn_buscar_personas_reporte nunca buscaba
-- ahí -- sus 3 niveles (CdP, Red, iglesia) siempre filtraban por
-- iglesia_id exacto. Sin poder encontrar a la persona en el buscador, no
-- hay forma real de aprovechar el permiso que el backend ya da.
--
-- Se agrega un Nivel 4: si los 3 anteriores no encontraron a nadie, busca
-- en la iglesia madre/satélite pareja de la iglesia activa (si existe).
DROP FUNCTION IF EXISTS public.fn_buscar_personas_reporte(uuid, text, integer, uuid, integer);

CREATE FUNCTION public.fn_buscar_personas_reporte(
  p_iglesia_id UUID,
  p_texto TEXT,
  p_edad_minima INT DEFAULT NULL,
  p_cdp_id UUID DEFAULT NULL,
  p_limite INT DEFAULT 10
)
RETURNS TABLE(id UUID, nombre_completo TEXT, edad INT, estado_sigla TEXT, telefono TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tokens TEXT[];
  v_red_id UUID;
  v_count INT;
  v_iglesia_pareja UUID;
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
             WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
           (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
             WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
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
               WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
             (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
               WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
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
           WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
         (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
           WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
    AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
         OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
    AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RETURN; END IF;

  -- Nivel 4 (KAN-449): iglesia madre/satélite pareja de la iglesia activa,
  -- si existe -- mismo criterio que ya usa fn_validar_asistencia para no
  -- bloquear la asistencia cruzada (fn_son_madre_satelite_vigente).
  SELECT i.id INTO v_iglesia_pareja
  FROM iglesia i
  WHERE i.fecha_eliminacion IS NULL AND fn_son_madre_satelite_vigente(i.id, p_iglesia_id)
  LIMIT 1;

  IF v_iglesia_pareja IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, fn_nombre_completo(p),
           CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
           (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
             WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
           (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
             WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
    FROM persona p
    WHERE p.iglesia_id = v_iglesia_pareja AND p.fecha_eliminacion IS NULL
      AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
           OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
      AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
    ORDER BY p.primer_apellido, p.primer_nombre
    LIMIT p_limite;
  END IF;
END;
$function$;
