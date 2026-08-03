-- VisionHub -- 88_fix_alias_matrimonios_iglesia.sql
-- Bug real encontrado en QA (2026-08-02, primera vez que se ejecutó de
-- verdad contra Postgres): fn_matrimonios_iglesia nombraba las columnas del
-- subquery `par` como p1/p2 (UUID) Y a la vez usaba p1/p2 como alias de la
-- tabla persona en los JOIN de afuera -- Postgres resuelve el identificador
-- ambiguo "p1" contra la columna de `par` (UUID), no contra la fila de
-- persona, así que fn_nombre_completo(p1) fallaba con "function
-- fn_nombre_completo(uuid) does not exist". La función nunca funcionó.
-- Se renombran los alias de persona a pa/pb para sacar la colisión.

CREATE OR REPLACE FUNCTION fn_matrimonios_iglesia(p_iglesia_id UUID)
RETURNS TABLE (
  persona1_id UUID, persona1_nombre TEXT, persona1_sexo sexo_enum,
  persona2_id UUID, persona2_nombre TEXT, persona2_sexo sexo_enum,
  casa_de_paz_etiqueta TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_encargado_matrimonios_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'SIN_ACCESO: se requiere ser Encargado de Matrimonios, Pastor o Supervisor' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    pa.id, fn_nombre_completo(pa), pa.sexo,
    pb.id, fn_nombre_completo(pb), pb.sexo,
    (SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
     WHERE cm.persona_id = pa.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1)
  FROM (
    -- familia no guarda la relacion en ambos sentidos siempre (sin trigger
    -- reciproco) -- LEAST/GREATEST normaliza el par para no duplicar filas
    -- si en algun caso si esta cargada en los dos sentidos.
    SELECT DISTINCT LEAST(f.persona_id, f.familiar_id) AS p1, GREATEST(f.persona_id, f.familiar_id) AS p2
    FROM familia f
    JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id AND tr.codigo = 'CONYUGE'
    WHERE f.fecha_eliminacion IS NULL AND f.iglesia_id = p_iglesia_id
  ) par
  JOIN persona pa ON pa.id = par.p1 AND pa.fecha_eliminacion IS NULL
  JOIN persona pb ON pb.id = par.p2 AND pb.fecha_eliminacion IS NULL
  WHERE NOT pa.oculto AND NOT pb.oculto
  ORDER BY fn_nombre_completo(pa);
END;
$$;
