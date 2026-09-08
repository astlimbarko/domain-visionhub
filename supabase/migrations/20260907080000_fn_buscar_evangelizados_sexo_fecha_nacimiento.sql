-- VisionHub -- KAN-347 (pedido explicito del owner, 2026-09-07): mostrar
-- tambien Sexo y Fecha de nacimiento de la persona en "Personas
-- evangelizadas" -- primer paso, chico y aislado, de una funcionalidad mas
-- grande (modal de edicion con switch de desbloqueo) que se deja anotada
-- en un ticket aparte para implementar despues con mas tiempo.

DROP FUNCTION IF EXISTS public.fn_buscar_evangelizados(UUID, UUID, TEXT, DATE, DATE, INT, INT, UUID, UUID);

CREATE FUNCTION public.fn_buscar_evangelizados(
  p_iglesia_id UUID,
  p_red_id UUID DEFAULT NULL,
  p_texto TEXT DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 50,
  p_casa_de_paz_id UUID DEFAULT NULL,
  p_tipo_evangelismo_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  persona_id UUID,
  nombre_completo TEXT,
  fecha DATE,
  domicilio TEXT,
  telefono_principal VARCHAR,
  red_id UUID,
  red_nombre VARCHAR,
  casa_de_paz_id UUID,
  casa_de_paz_etiqueta TEXT,
  tipo_evangelismo_nombre VARCHAR,
  tipo_evangelismo_color VARCHAR,
  evangelizado_por_nombre TEXT,
  sexo TEXT,
  fecha_nacimiento DATE,
  total BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_offset INT := GREATEST(p_pagina - 1, 0) * p_por_pagina;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    fn_es_operativo_en(p_iglesia_id)
    OR fn_es_pastor_en(p_iglesia_id)
    OR fn_es_lider_evangelismo_en(p_iglesia_id)
  ) THEN
    RAISE EXCEPTION 'SIN_PERMISO: no tenes permiso para ver el listado de evangelizados de esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF p_red_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM red WHERE red.id = p_red_id AND red.iglesia_id = p_iglesia_id AND red.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: la red % no pertenece a esta iglesia', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT ev.id, ev.persona_id, fn_nombre_completo(p), ev.fecha, ev.domicilio,
         tel.numero,
         r.id, r.nombre,
         ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id),
         te.nombre, te.color::VARCHAR,
         fn_nombre_completo(evz),
         p.sexo::TEXT, p.fecha_nacimiento,
         count(*) OVER()
  FROM evangelismo ev
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = ev.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  LEFT JOIN persona evz ON evz.id = ev.evangelizado_por_id
  WHERE ev.iglesia_id = p_iglesia_id
    AND ev.fecha_eliminacion IS NULL
    -- "Semilla" es un conteo agregado, no personas con nombre real (mismo
    -- criterio que ya usa fn_buscar_personas con p_excluir_semillas) --
    -- pedido explicito del owner (2026-09-06): esta pantalla es de personas,
    -- no debe listar filas "Semilla (sin datos)".
    AND (te.codigo IS DISTINCT FROM 'SEMILLA')
    AND (p_red_id IS NULL OR r.id = p_red_id)
    AND (p_casa_de_paz_id IS NULL OR ev.casa_de_paz_id = p_casa_de_paz_id)
    AND (p_tipo_evangelismo_id IS NULL OR te.id = p_tipo_evangelismo_id)
    AND (p_desde IS NULL OR ev.fecha >= p_desde)
    AND (p_hasta IS NULL OR ev.fecha <= p_hasta)
    AND (p_texto IS NULL OR btrim(p_texto) = '' OR fn_nombre_completo(p) ILIKE '%' || p_texto || '%')
  ORDER BY ev.fecha DESC
  LIMIT p_por_pagina OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_buscar_evangelizados(UUID, UUID, TEXT, DATE, DATE, INT, INT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_buscar_evangelizados(UUID, UUID, TEXT, DATE, DATE, INT, INT, UUID, UUID) TO authenticated;
