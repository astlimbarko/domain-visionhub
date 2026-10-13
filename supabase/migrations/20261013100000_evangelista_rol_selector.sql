-- Pedido del owner (2026-10-13, vía Daniel): "Mi Evangelismo" deja de ser un
-- botón suelto (ya removido del AppShell, commit 1177ed8) y pasa a
-- aparecer como un ROL más dentro del selector multirol -- mismo patrón ya
-- usado para Líder de Jóvenes / Encargado de Matrimonios (capacidad
-- ortogonal expuesta en fn_mis_iglesias_detalle, consumida por el selector
-- en el frontend). La capacidad real (fn_es_evangelista_en) ya existía
-- desde KAN-427, esto solo la suma a la foto que arma el selector.
--
-- DROP + CREATE (no CREATE OR REPLACE): Postgres no permite reemplazar una
-- función cambiando la lista de columnas de su RETURNS TABLE (mismo gotcha
-- que 20260925140000_kan442_fn_mis_iglesias_detalle_padre.sql).
DROP FUNCTION IF EXISTS public.fn_mis_iglesias_detalle();

CREATE FUNCTION public.fn_mis_iglesias_detalle()
RETURNS TABLE(
  id UUID,
  nombre VARCHAR,
  ciudad VARCHAR,
  es_operativo BOOLEAN,
  es_pastor BOOLEAN,
  es_lider_afirmacion BOOLEAN,
  es_lider_evangelismo BOOLEAN,
  es_lider_jovenes BOOLEAN,
  es_encargado_matrimonios BOOLEAN,
  es_evangelista BOOLEAN,
  iglesia_padre_id UUID
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id), fn_es_pastor_en(i.id),
         fn_es_lider_afirmacion_en(i.id), fn_es_lider_evangelismo_en(i.id),
         fn_es_lider_jovenes_en(i.id), fn_es_encargado_matrimonios_en(i.id),
         fn_es_evangelista_en(i.id), i.iglesia_padre_id
  from iglesia i
  where i.id in (select fn_mis_iglesias())
    and i.activo
    and i.fecha_eliminacion is null
  order by i.nombre;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_mis_iglesias_detalle() TO authenticated;
