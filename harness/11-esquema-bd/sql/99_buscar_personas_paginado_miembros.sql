-- VisionHub -- 99_buscar_personas_paginado_miembros.sql
-- Personas (Supervisor de la Vision en Accion, 2026-08-04): la busqueda global
-- devolvia hasta 200 filas sin paginar, y mezclaba registros de evangelismo
-- tipo "Semilla" (NuevoEvangelizadoDialog.tsx: persona real con
-- primer_nombre='Semilla', primer_apellido='(sin datos)', sin datos reales)
-- junto con el resto de las personas. Se agregan 2 parametros con default (no
-- rompen el contrato existente para Pastor/Lider/Sublider de CdP, que no los
-- usan):
--   - p_excluir_semillas: saca los registros con un evangelismo de tipo
--     'SEMILLA' vigente (evangelismo.tipo_evangelismo_id -> tipo_evangelismo.codigo,
--     44_tipo_evangelismo.sql) -- son los unicos "sin datos reales" (owner,
--     2026-08-05). CORREGIDO: la primera version exigia membresia vigente en
--     una Casa de Paz, que de paso sacaba a cualquier persona real que
--     todavia no llego a miembro (2 visitas) -- vaciaba la lista entera.
--   - p_pagina / p_por_pagina: paginacion real via OFFSET, con el total de
--     filas devuelto como columna extra (count(*) OVER(), sin una segunda
--     consulta) para que el frontend arme el paginador.

-- RETURNS TABLE cambia de forma (columna `total` nueva): CREATE OR REPLACE
-- no lo permite, hace falta DROP + CREATE (mismo caso ya resuelto en
-- 51_flag_afirmacion_iglesias.sql / 82_roles_globales_jovenes_matrimonios.sql).
DROP FUNCTION IF EXISTS fn_buscar_personas(UUID, TEXT, BOOLEAN, INT);

CREATE FUNCTION fn_buscar_personas(
  p_iglesia_id UUID,
  p_texto TEXT DEFAULT NULL,
  p_incluir_ocultas BOOLEAN DEFAULT false,
  p_limite INT DEFAULT 200,
  p_excluir_semillas BOOLEAN DEFAULT false,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, nombre_completo TEXT, sexo sexo_enum, fecha_nacimiento DATE, edad INT,
  ci VARCHAR, correo VARCHAR, oculto BOOLEAN,
  estado_sigla VARCHAR, estado_nombre VARCHAR,
  casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT,
  telefono_principal VARCHAR,
  total BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_por_pagina INT := COALESCE(p_por_pagina, p_limite);
  v_offset INT := GREATEST(p_pagina - 1, 0) * v_por_pagina;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
         CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         p.ci, p.correo, p.oculto,
         e.sigla, e.nombre,
         cdp.id, CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END,
         tel.numero,
         count(*) OVER()
  FROM persona p
  LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  LEFT JOIN estado e ON e.id = pe.estado_id
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND (p_incluir_ocultas OR NOT p.oculto)
    AND (
      NOT p_excluir_semillas OR NOT EXISTS (
        SELECT 1 FROM evangelismo ev
        JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
        WHERE ev.persona_id = p.id AND te.codigo = 'SEMILLA' AND ev.fecha_eliminacion IS NULL
      )
    )
    AND (
      p_texto IS NULL OR btrim(p_texto) = '' OR
      fn_nombre_completo(p) ILIKE '%' || p_texto || '%' OR
      p.ci ILIKE '%' || p_texto || '%' OR
      p.correo ILIKE '%' || p_texto || '%'
    )
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT v_por_pagina OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_personas(UUID, TEXT, BOOLEAN, INT, BOOLEAN, INT, INT) TO authenticated;
