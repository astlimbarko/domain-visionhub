-- KAN-442 (2026-09-25): el selector de rol necesita saber cuál iglesia es
-- la "madre" dentro del conjunto de iglesias accesibles de la cuenta, para
-- poder ordenarlas madre-arriba en el frontend (ver
-- frontend/src/utils/ordenar-iglesias.ts). Se agrega iglesia_padre_id al
-- resultado de fn_mis_iglesias_detalle().
--
-- DROP + CREATE (no CREATE OR REPLACE): Postgres no permite reemplazar una
-- función cambiando la lista de columnas de su RETURNS TABLE, mismo gotcha
-- ya documentado en 20260906020000_evangelizado_por.sql.
--
-- Nota: esta migración documenta un cambio que ya se aplicó directamente
-- contra la base en vivo durante la sesión (mismo patrón de
-- "migraciones aisladas" ya usado antes en este proyecto, ver memoria
-- visionhub-supabase-migraciones-aisladas) -- se agrega acá para que el
-- historial de migraciones quede al día con lo que ya está corriendo.
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
  iglesia_padre_id UUID
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id), fn_es_pastor_en(i.id),
         fn_es_lider_afirmacion_en(i.id), fn_es_lider_evangelismo_en(i.id),
         fn_es_lider_jovenes_en(i.id), fn_es_encargado_matrimonios_en(i.id), i.iglesia_padre_id
  from iglesia i
  where i.id in (select fn_mis_iglesias())
    and i.activo
    and i.fecha_eliminacion is null
  order by i.nombre;
$function$;
