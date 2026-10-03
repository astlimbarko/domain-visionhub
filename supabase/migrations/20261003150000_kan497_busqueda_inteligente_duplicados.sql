-- KAN-497 paso 12: "búsqueda inteligente" anti-duplicados. Extiende
-- fn_buscar_personas_similares (pg_trgm, ya existía, tope 5 candidatos) para
-- que CI y teléfono EXACTOS también encuentren coincidencias, no solo el
-- nombre por similitud difusa. Parámetros nuevos SIEMPRE al final, con
-- DEFAULT NULL -- los 3 llamados que ya existen (Evangelismo, Reportes,
-- Bautismo/Membresía) siguen funcionando sin tocarlos.
--
-- Criterio de pesos (confirmado por el owner, 2026-10-03):
--   - CI exacto -> score 1.0 (máxima prioridad, es casi una huella digital).
--   - Teléfono exacto -> score 0.9 (alto, pero un poco menos que el CI --
--     puede estar compartido entre familiares).
--   - Nombre por similitud -> score tal cual lo da pg_trgm (como ya era).
--   - Sexo coincidente -> +0.05 (suma, NUNCA excluye ni resta -- un error de
--     tipeo en el sexo no debe tapar un duplicado real).
-- El score final de cada candidato es el máximo de los 3 primeros más el
-- bonus de sexo.
--
-- Antes, la función solo devolvía candidatos que matchearan el operador de
-- trigram `%` sobre el nombre. Ahora también entran los que matchean EXACTO
-- por CI o por teléfono, aunque el nombre no se parezca (ej. apodos).
CREATE OR REPLACE FUNCTION fn_buscar_personas_similares(
  p_iglesia_id UUID,
  p_primer_nombre TEXT,
  p_primer_apellido TEXT,
  p_segundo_nombre TEXT DEFAULT NULL,
  p_segundo_apellido TEXT DEFAULT NULL,
  p_umbral REAL DEFAULT 0.4,
  p_limite INT DEFAULT 5,
  p_ci TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL,
  p_sexo sexo_enum DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nombre_completo TEXT,
  score REAL,
  casa_de_paz_id UUID,
  casa_de_paz_nombre TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_normalizado TEXT := fn_normalizar_texto_similitud(
    concat_ws(' ', p_primer_nombre, p_segundo_nombre, p_primer_apellido, p_segundo_apellido)
  );
  v_ci TEXT := NULLIF(btrim(coalesce(p_ci, '')), '');
  v_telefono TEXT := NULLIF(btrim(coalesce(p_telefono, '')), '');
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  -- Antes se cortaba si no había nombre. Ahora también sirve buscar solo por
  -- CI o teléfono (ej. se completó el documento antes que el nombre).
  IF v_normalizado = '' AND v_ci IS NULL AND v_telefono IS NULL THEN
    RETURN;
  END IF;

  IF v_normalizado <> '' THEN
    PERFORM set_config('pg_trgm.similarity_threshold', p_umbral::text, true);
  END IF;

  RETURN QUERY
  SELECT sub.id, sub.nombre_completo, sub.score, sub.casa_de_paz_id, sub.casa_de_paz_nombre
  FROM (
    SELECT
      p.id,
      fn_nombre_completo(p) AS nombre_completo,
      GREATEST(
        CASE WHEN v_ci IS NOT NULL AND p.ci = v_ci THEN 1.0 ELSE 0 END,
        CASE WHEN v_telefono IS NOT NULL AND EXISTS (
          SELECT 1 FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
          WHERE ta.persona_id = p.id AND ta.fecha_eliminacion IS NULL AND t.fecha_eliminacion IS NULL
            AND t.numero = v_telefono
        ) THEN 0.9 ELSE 0 END,
        CASE WHEN v_normalizado <> '' THEN similarity(fn_normalizar_texto_similitud(fn_nombre_completo(p)), v_normalizado) ELSE 0 END
      )
      + CASE WHEN p_sexo IS NOT NULL AND p.sexo = p_sexo THEN 0.05 ELSE 0 END AS score,
      cdp.id AS casa_de_paz_id,
      CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END AS casa_de_paz_nombre
    FROM persona p
    LEFT JOIN casa_de_paz_membresia cm
      ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
    LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
    WHERE p.iglesia_id = p_iglesia_id
      AND p.fecha_eliminacion IS NULL
      AND (
        (v_ci IS NOT NULL AND p.ci = v_ci)
        OR (v_telefono IS NOT NULL AND EXISTS (
          SELECT 1 FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
          WHERE ta.persona_id = p.id AND ta.fecha_eliminacion IS NULL AND t.fecha_eliminacion IS NULL
            AND t.numero = v_telefono
        ))
        OR (v_normalizado <> '' AND fn_normalizar_texto_similitud(fn_nombre_completo(p)) % v_normalizado)
      )
  ) sub
  ORDER BY sub.score DESC
  LIMIT p_limite;
END;
$$;
