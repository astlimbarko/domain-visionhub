-- VisionHub -- 87_fix_tipos_jovenes_iglesia.sql
-- Bug real encontrado en QA (2026-08-02, primera vez que se ejecutó de
-- verdad contra Postgres -- antes solo se había verificado por tipos/lint
-- del frontend, nunca invocada): fn_jovenes_iglesia declaraba
-- red_nombre/estado_sigla/telefono_principal como TEXT, pero red.nombre,
-- estado.sigla y telefono.numero son VARCHAR en el esquema real -- Postgres
-- no acepta esa mezcla en RETURN QUERY de una función plpgsql ("structure of
-- query does not match function result type"). La función nunca funcionó.
-- Casteo explícito a ::TEXT en cada subquery en vez de tocar el
-- RETURNS TABLE (no cambia el contrato con el frontend, que ya trata todo
-- como string).

CREATE OR REPLACE FUNCTION fn_jovenes_iglesia(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, nombre_completo TEXT, sexo sexo_enum, edad INT,
  casa_de_paz_etiqueta TEXT, red_nombre TEXT, estado_sigla TEXT, telefono_principal TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_edad_min NUMERIC; v_edad_max NUMERIC;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_jovenes_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'SIN_ACCESO: se requiere ser Lider de Jovenes, Pastor o Supervisor' USING ERRCODE = 'P0001';
  END IF;

  v_edad_min := fn_criterio(p_iglesia_id, 'EDAD_JOVEN_MIN');
  v_edad_max := fn_criterio(p_iglesia_id, 'EDAD_JOVEN_MAX');

  RETURN QUERY
  SELECT
    p.id, fn_nombre_completo(p), p.sexo,
    EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT,
    (SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
     WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT r.nombre::TEXT FROM casa_de_paz_membresia cm
     JOIN casa_de_paz_red cr ON cr.casa_de_paz_id = cm.casa_de_paz_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
     JOIN red r ON r.id = cr.red_id
     WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
     WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL),
    (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
     WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto
    AND p.fecha_nacimiento IS NOT NULL
    AND EXTRACT(YEAR FROM age(p.fecha_nacimiento)) BETWEEN v_edad_min AND v_edad_max
  ORDER BY fn_nombre_completo(p);
END;
$$;
