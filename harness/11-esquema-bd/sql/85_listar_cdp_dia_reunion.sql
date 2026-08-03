-- VisionHub -- 85_listar_cdp_dia_reunion.sql
-- Control de Reportes (Líder de Red) mostraba columnas de semana calendario
-- (lunes a domingo) iguales para todas las Casas de Paz, pero cada CdP fija
-- su propio día de reunión en su Perfil (dia_reunion, 48_reunion_cdp.sql) y
-- no todas se reúnen el mismo día -- las fechas de columna no representaban
-- el día real en que cada una reporta. fn_listar_cdp (la que usa Control de
-- Reportes vía useCdps) no exponía dia_reunion todavía. RETURNS TABLE cambia
-- de forma -> DROP + CREATE (mismo caso que 79_cdp_virtual.sql).

DROP FUNCTION IF EXISTS fn_listar_cdp(UUID, UUID);

CREATE FUNCTION fn_listar_cdp(p_iglesia_id UUID, p_red_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, etiqueta TEXT, activo BOOLEAN, modalidad modalidad_cdp_enum, red_id UUID, red_nombre VARCHAR,
  lider_id UUID, lider_nombre TEXT, anfitrion_id UUID, anfitrion_nombre TEXT,
  sublideres_count BIGINT, miembros_count BIGINT, dia_reunion SMALLINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, fn_etiqueta_cdp(c.id), c.activo, c.modalidad, cdr.red_id, r.nombre,
    (SELECT p.id FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'LIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS lider_id,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'LIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS lider_nombre,
    (SELECT p.id FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'ANFITRION'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS anfitrion_id,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'ANFITRION'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS anfitrion_nombre,
    (SELECT count(*) FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'SUBLIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL) AS sublideres_count,
    (SELECT count(*) FROM casa_de_paz_membresia m
     WHERE m.casa_de_paz_id = c.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL) AS miembros_count,
    c.dia_reunion
  FROM casa_de_paz c
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE c.iglesia_id = p_iglesia_id AND c.fecha_eliminacion IS NULL
    AND (p_red_id IS NULL OR cdr.red_id = p_red_id)
  ORDER BY r.nombre NULLS LAST, lider_nombre NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION fn_listar_cdp(UUID, UUID) TO authenticated;
