-- VisionHub -- KAN-247 (bug real reportado por Matias, 2026-08-22): al
-- designar Lider de Red desde el Constructor (Estructura Organizacional),
-- una persona que ya tenia un cargo (ej. Lider de Casa de Paz) no aparecia
-- en el buscador "Desde base de datos" -- ni por nombre ni por correo
-- exacto, aunque su fila en `persona` cumplia todas las condiciones
-- (oculto=false, fecha_eliminacion=null, iglesia_id correcta).
--
-- Causa raiz encontrada verificando en vivo (pg_get_functiondef): existen
-- DOS versiones de fn_buscar_personas conviviendo en produccion:
--   1) La del 2026-08-09 (buscar_personas_global_super_admin), 4 parametros,
--      con busqueda global para Super Admin e iglesia_id/iglesia_nombre en
--      el resultado.
--   2) La del 2026-08-21 (afirmacion_buscar_personas_membresia_completada),
--      7 parametros, con red_nombre/via_registro/membresia_completada.
-- La migracion del 21 hizo "DROP FUNCTION IF EXISTS fn_buscar_personas(...7
-- parametros...)" para reemplazarla, pero en ese momento la funcion
-- desplegada todavia tenia SOLO 4 parametros -- ese DROP no encontro nada
-- que borrar (IF EXISTS lo dejo pasar en silencio) y el CREATE de al lado
-- termino agregando una SEGUNDA funcion con el mismo nombre en vez de
-- reemplazar la primera. Point-in-time: la de 4 parametros (con soporte
-- Super Admin) nunca se borro, asi que desde el 21 de agosto conviven las
-- dos, cada llamada del frontend resolviendo a una u otra segun que
-- parametros nombrados manda cada pantalla -- comportamiento no
-- determinista para cualquier llamada que solo pase los primeros 4
-- parametros (exactamente el caso de Estructura Organizacional).
--
-- Fix: una sola funcion fn_buscar_personas que junta las dos ramas
-- (busqueda global Super Admin + iglesia_id/iglesia_nombre + paginacion +
-- red_nombre/via_registro/membresia_completada), y se borran explicitamente
-- las dos firmas viejas para que no quede ninguna huerfana.
DROP FUNCTION IF EXISTS fn_buscar_personas(UUID, TEXT, BOOLEAN, INT);
DROP FUNCTION IF EXISTS fn_buscar_personas(UUID, TEXT, BOOLEAN, INT, BOOLEAN, INT, INT);

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
  red_nombre VARCHAR,
  telefono_principal VARCHAR,
  via_registro TEXT,
  membresia_completada BOOLEAN,
  iglesia_id UUID, iglesia_nombre VARCHAR,
  total BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_por_pagina INT := COALESCE(p_por_pagina, p_limite);
  v_offset INT := GREATEST(p_pagina - 1, 0) * v_por_pagina;
  v_global BOOLEAN;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  v_global := fn_es_super_admin();

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
         CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         p.ci, p.correo, p.oculto,
         e.sigla, e.nombre,
         cdp.id, CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END,
         r.nombre,
         tel.numero,
         CASE
           WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NOT NULL THEN 'URL'
           WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NULL THEN 'FORMULARIO'
           ELSE NULL
         END,
         p.membresia_completada,
         p.iglesia_id, ig.nombre,
         count(*) OVER()
  FROM persona p
  LEFT JOIN iglesia ig ON ig.id = p.iglesia_id
  LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  LEFT JOIN estado e ON e.id = pe.estado_id
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  LEFT JOIN LATERAL (
    SELECT pl.casa_paz_url_id, ml.codigo AS motivo_codigo
    FROM persona_llegada pl
    JOIN motivo_llegada ml ON ml.id = pl.motivo_llegada_id
    WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
    ORDER BY pl.fecha_creacion DESC
    LIMIT 1
  ) llegada ON true
  WHERE (v_global OR p.iglesia_id = p_iglesia_id)
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
