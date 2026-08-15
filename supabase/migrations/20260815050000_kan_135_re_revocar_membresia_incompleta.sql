-- VisionHub — KAN-135: re-cerrar privilegio publico regresado por accidente.
-- 6ce1612 (20260809053351) revoco ejecucion publica de
-- fn_mi_membresia_incompleta(). La migracion 20260811110000 (recheck por rol
-- activo) reemplazo la funcion con DROP FUNCTION + CREATE FUNCTION para
-- agregarle el parametro p_iglesia_id -- eso resetea el ACL al default de
-- Postgres (EXECUTE a PUBLIC), y solo volvio a otorgar a `authenticated`, sin
-- revocar de `public`/`anon`. Confirmado en vivo (2026-08-15):
-- has_function_privilege('anon', ..., 'EXECUTE') = true.
--
-- Riesgo real hoy es bajo (la funcion depende enteramente de auth.uid(), que
-- es NULL para un llamado anonimo, asi que no filtra datos), pero es
-- exactamente el patron que KAN-135 existe para cerrar -- se corrige igual.
begin;

revoke all on function public.fn_mi_membresia_incompleta(uuid)
  from public, anon;
grant execute on function public.fn_mi_membresia_incompleta(uuid)
  to authenticated;

commit;
