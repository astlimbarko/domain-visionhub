-- VisionHub -- 51_flag_afirmacion_iglesias.sql
-- 14-afirmacion. Expone es_lider_afirmacion en fn_mis_iglesias_detalle para
-- que el frontend decida si mostrar el modulo (capacidad ortogonal al
-- RolUI, no un rol nuevo). Mismo patron de 43_pastor_no_operativo.sql:
-- RETURNS TABLE no admite agregar una columna via CREATE OR REPLACE, hace
-- falta DROP + CREATE. No se toca ninguna otra columna existente.
DROP FUNCTION IF EXISTS fn_mis_iglesias_detalle();

CREATE FUNCTION fn_mis_iglesias_detalle()
RETURNS TABLE (id UUID, nombre VARCHAR, ciudad VARCHAR, es_operativo BOOLEAN, es_pastor BOOLEAN, es_lider_afirmacion BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id), fn_es_pastor_en(i.id), fn_es_lider_afirmacion_en(i.id)
  FROM iglesia i
  WHERE i.id IN (SELECT fn_mis_iglesias())
    AND i.activo
    AND i.fecha_eliminacion IS NULL
  ORDER BY i.nombre;
$$;
