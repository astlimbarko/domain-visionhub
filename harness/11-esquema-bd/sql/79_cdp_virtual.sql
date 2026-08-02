-- VisionHub -- 79_cdp_virtual.sql
-- Bloque 3 del pedido del owner (2026-08-02): modalidad de Casa de Paz.
-- domain_knowledge/iglesia/reuniones.md e iu/casas-de-paz/reuniones.md ya
-- documentan que "pueden existir casas de paz virtuales, normalmente con
-- personas de otros paises, transmitidas por redes sociales en vivo" -- a
-- diferencia de Bautizo/Retiro/Discipulado, esto no es parte de ningun modulo
-- futuro planeado (99-modulos-futuros.md no lo menciona), asi que se
-- implementa directo, sin version "simple" ni advertencias de alcance.

CREATE TYPE modalidad_cdp_enum AS ENUM ('PRESENCIAL', 'VIRTUAL');

ALTER TABLE casa_de_paz
  ADD COLUMN modalidad modalidad_cdp_enum NOT NULL DEFAULT 'PRESENCIAL';

-- fn_mi_cdp_perfil: JSONB, CREATE OR REPLACE alcanza.
CREATE OR REPLACE FUNCTION fn_mi_cdp_perfil(p_casa_de_paz_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'PERFIL_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT (
       fn_es_lider_cdp(p_casa_de_paz_id)
    OR fn_es_sublider_cdp(p_casa_de_paz_id)
    OR fn_es_rol_superior_de_cdp(p_casa_de_paz_id)
  ) THEN
    RAISE EXCEPTION 'PERFIL_FUERA_DE_ALCANCE: sin cargo vigente en la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'nombre',         fn_etiqueta_cdp(c.id),
      'activo',         c.activo,
      'modalidad',      c.modalidad,
      'fecha_creacion', c.fecha_creacion,
      'dia_reunion',    c.dia_reunion,
      'hora_reunion',   c.hora_reunion,
      'red_nombre', (
        SELECT r.nombre
        FROM casa_de_paz_red cdr
        JOIN red r ON r.id = cdr.red_id
        WHERE cdr.casa_de_paz_id = c.id
          AND cdr.fecha_fin IS NULL
          AND cdr.fecha_eliminacion IS NULL
        ORDER BY cdr.fecha_inicio DESC
        LIMIT 1
      )
    )
    FROM casa_de_paz c
    WHERE c.id = p_casa_de_paz_id
  );
END;
$$;

-- fn_listar_cdp: RETURNS TABLE cambia de forma -> DROP + CREATE (mismo caso
-- que fn_listar_redes en 60_red_color.sql). Se aprovecha para sumar
-- lider_id/anfitrion_id (pendiente de "vínculos de perfil" en Casas de Paz,
-- bloqueado hasta ahora porque esta función solo devolvía los nombres).
DROP FUNCTION IF EXISTS fn_listar_cdp(UUID, UUID);

CREATE FUNCTION fn_listar_cdp(p_iglesia_id UUID, p_red_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, etiqueta TEXT, activo BOOLEAN, modalidad modalidad_cdp_enum, red_id UUID, red_nombre VARCHAR,
  lider_id UUID, lider_nombre TEXT, anfitrion_id UUID, anfitrion_nombre TEXT,
  sublideres_count BIGINT, miembros_count BIGINT
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
     WHERE m.casa_de_paz_id = c.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL) AS miembros_count
  FROM casa_de_paz c
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE c.iglesia_id = p_iglesia_id AND c.fecha_eliminacion IS NULL
    AND (p_red_id IS NULL OR cdr.red_id = p_red_id)
  ORDER BY r.nombre NULLS LAST, lider_nombre NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION fn_listar_cdp(UUID, UUID) TO authenticated;
