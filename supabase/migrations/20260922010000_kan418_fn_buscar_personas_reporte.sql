-- KAN-418: el buscador de personas usado por "Disertador" y "Evangelizado
-- por" (buscarPersonas en casas-de-paz.service.ts) traia hasta 30 filas que
-- matcheaban CUALQUIER palabra por separado (OR de ilike por campo), y
-- recien en el CLIENTE filtraba exigiendo que TODAS las palabras aparezcan
-- (AND). Con nombres comunes, la persona buscada quedaba fuera de esas 30
-- filas antes de llegar al filtro AND -- por eso "no aparecia" al buscar
-- con 2 nombres o solo el segundo nombre.
--
-- Fix: mover el filtro AND a la consulta SQL (antes del LIMIT), en vez de
-- aplicarlo despues en JS. Misma regla de negocio que ya tenia el cliente:
-- sin fecha de nacimiento registrada no se puede saber si es menor -- se
-- deja pasar el filtro de edad minima en vez de ocultar a la persona.

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
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  v_tokens := regexp_split_to_array(btrim(coalesce(p_texto, '')), '\s+');
  IF v_tokens IS NULL OR array_length(v_tokens, 1) IS NULL OR v_tokens[1] = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p)
  FROM persona p
  LEFT JOIN casa_de_paz_membresia cm
    ON cm.persona_id = p.id
    AND cm.casa_de_paz_id = p_cdp_id
    AND cm.es_principal
    AND cm.fecha_fin IS NULL
    AND cm.fecha_eliminacion IS NULL
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND (p_cdp_id IS NULL OR cm.persona_id IS NOT NULL)
    AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
         OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
    AND (
      SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%')
      FROM unnest(v_tokens) AS t
    )
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_buscar_personas_reporte(UUID, TEXT, INT, UUID, INT) TO authenticated;

commit;
