-- VisionHub -- 20260911010000_kan_afirmacion_membresia_filtros_kpi.sql
--
-- Pedido explicito del owner (2026-09-11): las tarjetas de KPI de arriba de
-- Membresia (Hombres, Mujeres, Por URL, Por formulario, Simpatizantes,
-- Con profesion, Soltero/a, etc) pasan a ser botones que filtran la tabla
-- por esa categoria. Suma 4 filtros nuevos a fn_afirmacion_buscar_membresia
-- (Estado ya existia desde la migracion anterior): sexo, via de registro,
-- con profesion, estado civil.

DROP FUNCTION IF EXISTS public.fn_afirmacion_buscar_membresia(UUID, TEXT, INT, INT, UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.fn_afirmacion_buscar_membresia(
  p_iglesia_id UUID,
  p_texto TEXT DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 50,
  p_red_id UUID DEFAULT NULL,
  p_casa_de_paz_id UUID DEFAULT NULL,
  p_estado_id UUID DEFAULT NULL,
  p_sexo sexo_enum DEFAULT NULL,
  p_via_registro TEXT DEFAULT NULL,
  p_con_profesion BOOLEAN DEFAULT NULL,
  p_estado_civil TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  primer_nombre VARCHAR,
  segundo_nombre VARCHAR,
  primer_apellido VARCHAR,
  segundo_apellido VARCHAR,
  nombre_completo TEXT,
  sexo sexo_enum,
  fecha_nacimiento DATE,
  edad INT,
  ci VARCHAR,
  correo VARCHAR,
  oculto BOOLEAN,
  estado_sigla VARCHAR,
  estado_nombre VARCHAR,
  casa_de_paz_id UUID,
  casa_de_paz_etiqueta TEXT,
  red_nombre VARCHAR,
  telefono_principal VARCHAR,
  via_registro TEXT,
  membresia_completada BOOLEAN,
  estado_civil TEXT,
  ocupacion VARCHAR,
  grado_instruccion TEXT,
  rango_miembro VARCHAR,
  bautizado BOOLEAN,
  es_lider_cdp BOOLEAN,
  es_sublider_cdp BOOLEAN,
  es_lider_red BOOLEAN,
  es_sublider_red BOOLEAN,
  iglesia_id UUID,
  iglesia_nombre VARCHAR,
  total BIGINT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_por_pagina INT := COALESCE(p_por_pagina, 50);
  v_offset INT := GREATEST(p_pagina - 1, 0) * v_por_pagina;
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id) OR fn_es_super_admin()) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
         fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
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
         pd.estado_civil::TEXT,
         pd.ocupacion,
         pd.grado_instruccion::TEXT,
         pcm.rango_miembro,
         COALESCE(pd.bautizado, false),
         EXISTS (
           SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
           WHERE cc.persona_id = p.id AND c.codigo = 'LIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
         ),
         EXISTS (
           SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
           WHERE cc.persona_id = p.id AND c.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
         ),
         EXISTS (
           SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
           WHERE rc.persona_id = p.id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
         ),
         EXISTS (
           SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
           WHERE rc.persona_id = p.id AND c.codigo = 'SUBLIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
         ),
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
  LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
  LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
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
    AND NOT p.oculto
    AND NOT EXISTS (
      SELECT 1 FROM evangelismo ev
      JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
      WHERE ev.persona_id = p.id AND te.codigo = 'SEMILLA' AND ev.fecha_eliminacion IS NULL
    )
    AND (
      p_texto IS NULL OR btrim(p_texto) = '' OR
      fn_nombre_completo(p) ILIKE '%' || p_texto || '%' OR
      p.ci ILIKE '%' || p_texto || '%' OR
      p.correo ILIKE '%' || p_texto || '%'
    )
    AND (p_red_id IS NULL OR r.id = p_red_id)
    AND (p_casa_de_paz_id IS NULL OR cdp.id = p_casa_de_paz_id)
    AND (p_estado_id IS NULL OR e.id = p_estado_id)
    AND (p_sexo IS NULL OR p.sexo = p_sexo)
    AND (
      p_via_registro IS NULL OR
      p_via_registro = (
        CASE
          WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NOT NULL THEN 'URL'
          WHEN llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NULL THEN 'FORMULARIO'
          ELSE NULL
        END
      )
    )
    AND (
      p_con_profesion IS NULL OR
      (pd.ocupacion IS NOT NULL AND btrim(pd.ocupacion) <> '') = p_con_profesion
    )
    AND (p_estado_civil IS NULL OR pd.estado_civil::TEXT = p_estado_civil)
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT v_por_pagina OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_afirmacion_buscar_membresia(UUID, TEXT, INT, INT, UUID, UUID, UUID, sexo_enum, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_buscar_membresia(UUID, TEXT, INT, INT, UUID, UUID, UUID, sexo_enum, TEXT, BOOLEAN, TEXT) TO authenticated;
