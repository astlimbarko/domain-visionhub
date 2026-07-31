-- VisionHub -- 60_red_color.sql
-- Color identificativo por Red (pedido del owner, 2026-07-31). Columna
-- aditiva en `red`, sin tocar ninguna otra tabla ni la logica de permisos:
-- la RLS de UPDATE de `red` ya permite al Supervisor y al propio Lider de
-- Red actualizar cualquier columna de su fila (pol_red_update,
-- 08_estructura.sql), asi que el frontend puede escribir `color` con un
-- UPDATE directo, igual que ya hace toggleActivoRed con `activo`.

ALTER TABLE red
  ADD COLUMN color CHAR(7) NOT NULL DEFAULT '#FFFFFF'
  CONSTRAINT chk_red_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

-- fn_listar_redes (36_dashboards_completos.sql) es RETURNS TABLE: no admite
-- agregar una columna via CREATE OR REPLACE, hace falta DROP + CREATE (mismo
-- caso que fn_mis_iglesias_detalle en 43_pastor_no_operativo.sql).
DROP FUNCTION IF EXISTS fn_listar_redes(UUID);

CREATE FUNCTION fn_listar_redes(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, nombre VARCHAR, activo BOOLEAN, color CHAR(7),
  lider_nombre TEXT, encargado_departamentos_nombre TEXT, encargado_ministerio_nombre TEXT,
  cantidad_cdp BIGINT, incompleta BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.id, r.nombre, r.activo, r.color,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'LIDER_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_MINISTERIO_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT count(*) FROM casa_de_paz_red cdr
     JOIN casa_de_paz c ON c.id = cdr.casa_de_paz_id
     WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL AND c.activo),
    COALESCE(fi.falta_departamentos OR fi.falta_ministerio, false)
  FROM red r
  LEFT JOIN fn_redes_incompletas(p_iglesia_id) fi ON fi.red_id = r.id
  WHERE r.iglesia_id = p_iglesia_id AND r.fecha_eliminacion IS NULL
  ORDER BY r.nombre;
$$;
