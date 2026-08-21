-- VisionHub -- KAN-216 (plan panel Afirmacion, punto 3/4): extiende
-- fn_buscar_personas con 2 columnas nuevas para la tabla de personas de
-- Afirmacion:
--   - red_nombre: via casa_de_paz_red (mismo patron que
--     fn_listar_casas_de_paz_afirmacion, 09_afirmacion_registro.sql).
--   - via_registro: 'URL' | 'FORMULARIO' | NULL, derivado de la ultima fila
--     de persona_llegada con motivo INVITACION_PERSONAL (unico motivo que
--     usan los 2 caminos de Afirmacion) -- NULL para cualquier otro origen
--     (evangelismo, invitacion directa de un lider, etc.), no aplica.
--
-- RETURNS TABLE cambia de forma -> DROP + CREATE (mismo patron ya usado en
-- 99_buscar_personas_paginado_miembros.sql).
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
         r.nombre,
         tel.numero,
         CASE
           WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NOT NULL THEN 'URL'
           WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NULL THEN 'FORMULARIO'
           ELSE NULL
         END,
         count(*) OVER()
  FROM persona p
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

-- Estadisticas agregadas para la fila de KPIs de /afirmacion-personas -- sin
-- paginar, cuenta real sobre toda la iglesia (fn_buscar_personas pagina, no
-- sirve para totales).
CREATE OR REPLACE FUNCTION public.fn_afirmacion_estadisticas_personas(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INT;
  v_por_estado JSONB;
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_total
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto;

  SELECT jsonb_object_agg(COALESCE(e.sigla, 'SIN_ESTADO'), conteo)
  INTO v_por_estado
  FROM (
    SELECT pe.estado_id, count(*) AS conteo
    FROM persona p
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto
    GROUP BY pe.estado_id
  ) c
  LEFT JOIN estado e ON e.id = c.estado_id;

  RETURN jsonb_build_object('total', v_total, 'por_estado', COALESCE(v_por_estado, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_estadisticas_personas(UUID) TO authenticated;
