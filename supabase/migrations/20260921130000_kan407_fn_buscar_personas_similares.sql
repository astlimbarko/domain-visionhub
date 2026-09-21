-- VisionHub -- KAN-407: aviso de posible duplicado al registrar persona
-- (alta de evangelizado en Evangelismo, alta directa en Casas de Paz).
--
-- La busqueda ya existente (fn_buscar_personas / buscarPersonas en
-- casas-de-paz.service.ts) usa ILIKE '%texto%' -- exige coincidencia
-- literal de substring. Si alguien escribe "Alberto Peres" y la persona ya
-- esta cargada como "Alberto Pérez", esa busqueda no la encuentra y el
-- alta rapida termina creando una ficha duplicada de la misma persona real.
--
-- Este archivo agrega una funcion aparte (fn_buscar_personas_similares)
-- pensada solo para el momento de confirmar un alta "nueva": compara el
-- nombre completo tentativo contra los ya cargados en la MISMA iglesia
-- usando pg_trgm (similarity de trigramas), que tolera errores de tipeo
-- comunes en español (s/z, b/v, m/n, con/sin acentos) sin necesitar una
-- coincidencia exacta de ningun substring.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Mismo patron ya aceptado en el proyecto para fn_slugificar
-- (19_registro_publico.sql): unaccent() es STABLE en sentido estricto
-- (depende del diccionario de texto configurado), pero en la practica el
-- resultado no cambia en runtime -- envolverla como IMMUTABLE es el
-- workaround necesario para poder indexar la expresion con GIN.
-- unaccent() sin calificar de esquema fallaba al crear el indice GIN de
-- abajo ("function unaccent(text) does not exist" durante el inlining de
-- esta funcion) -- el chequeo interno de Postgres para indexar una
-- expresion no siempre resuelve con el mismo search_path que una consulta
-- normal. Calificarla como public.unaccent (misma extension, instalada en
-- public) lo hace independiente del search_path de quien la llame.
CREATE OR REPLACE FUNCTION fn_normalizar_texto_similitud(p_texto TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(public.unaccent(btrim(regexp_replace(COALESCE(p_texto, ''), '\s+', ' ', 'g'))));
$$;

-- Indice trigram sobre el nombre completo normalizado -- evita escanear
-- toda la tabla `persona` en iglesias grandes cada vez que se tipea un
-- alta nueva. Parcial (solo filas vivas) porque la busqueda de duplicados
-- nunca tiene sentido contra personas ya eliminadas.
CREATE INDEX IF NOT EXISTS idx_persona_nombre_completo_trgm
  ON persona USING GIN (fn_normalizar_texto_similitud(fn_nombre_completo(persona)) gin_trgm_ops)
  WHERE fecha_eliminacion IS NULL;

CREATE OR REPLACE FUNCTION fn_buscar_personas_similares(
  p_iglesia_id UUID,
  p_primer_nombre TEXT,
  p_primer_apellido TEXT,
  p_segundo_nombre TEXT DEFAULT NULL,
  p_segundo_apellido TEXT DEFAULT NULL,
  p_umbral REAL DEFAULT 0.4,
  p_limite INT DEFAULT 5
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
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  IF v_normalizado = '' THEN
    RETURN;
  END IF;

  -- Umbral de similitud a nivel de sesion (solo para esta transaccion,
  -- `is_local = true`) -- necesario para que el operador `%` (que usa el
  -- indice GIN) filtre con el mismo umbral que despues se devuelve como
  -- `score`, en vez de depender del default global de pg_trgm (0.3).
  PERFORM set_config('pg_trgm.similarity_threshold', p_umbral::text, true);

  RETURN QUERY
  SELECT
    p.id,
    fn_nombre_completo(p),
    similarity(fn_normalizar_texto_similitud(fn_nombre_completo(p)), v_normalizado) AS score,
    cdp.id,
    CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END
  FROM persona p
  LEFT JOIN casa_de_paz_membresia cm
    ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND fn_normalizar_texto_similitud(fn_nombre_completo(p)) % v_normalizado
  ORDER BY score DESC
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_personas_similares(UUID, TEXT, TEXT, TEXT, TEXT, REAL, INT) TO authenticated;
