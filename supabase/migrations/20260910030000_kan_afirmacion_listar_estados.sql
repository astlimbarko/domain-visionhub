-- VisionHub -- 20260910030000_kan_afirmacion_listar_estados.sql
--
-- KAN-358 seguimiento (2026-09-11): filtro de Estado en la tabla de
-- Membresia de Afirmacion, mismo patron que Red/Casa de Paz. `estado` es
-- un catalogo global (sin iglesia_id), no hace falta scope por iglesia --
-- solo requiere sesion autenticada, como cualquier catalogo de referencia.

CREATE OR REPLACE FUNCTION public.fn_listar_estados()
RETURNS TABLE (id UUID, sigla VARCHAR, nombre VARCHAR)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.id, e.sigla, e.nombre
  FROM estado e
  WHERE e.activo AND e.fecha_eliminacion IS NULL
  ORDER BY e.orden;
$function$;

REVOKE ALL ON FUNCTION public.fn_listar_estados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_listar_estados() TO authenticated;
