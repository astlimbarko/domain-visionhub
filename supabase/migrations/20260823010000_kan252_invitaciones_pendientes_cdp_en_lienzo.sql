-- VisionHub -- KAN-252 (bug real reportado por Matias, 2026-08-23): al
-- designar un Lider de Casa de Paz por correo (invitacion, todavia sin
-- aceptar), esa persona no aparecia en el lienzo del Constructor -- la
-- tarjeta de la CdP seguia mostrando "Lider sin asignar". El mismo caso para
-- Lider/Supervisor de Red SI funcionaba (se ve al toque, con el punto gris
-- de "pendiente").
--
-- Causa: fn_estructura_listar_invitaciones_red filtraba
-- "WHERE il.red_id IS NOT NULL" -- las invitaciones de Casa de Paz
-- (invitacion_lider.casa_de_paz_id, no red_id) nunca se devolvian, aunque la
-- tabla ya las guarda (mismo mecanismo que usa fn_resolver_invitaciones_
-- pendientes_extra de KAN-213).
--
-- Fix: se agrega casa_de_paz_id al resultado y se amplia el WHERE para
-- incluir invitaciones de Red O de Casa de Paz. DROP + CREATE porque
-- RETURNS TABLE cambia de forma.
DROP FUNCTION IF EXISTS fn_estructura_listar_invitaciones_red(uuid);

CREATE FUNCTION fn_estructura_listar_invitaciones_red(p_iglesia_id uuid)
RETURNS TABLE(
  id uuid, correo character varying, red_id uuid, casa_de_paz_id uuid,
  cargo_codigo character varying, estado character varying, fecha_creacion timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  select
    il.id,
    il.correo,
    il.red_id,
    il.casa_de_paz_id,
    c.codigo,
    il.estado,
    il.fecha_creacion
  from public.invitacion_lider il
  join public.cargo c on c.id = il.cargo_id
  where il.iglesia_id = p_iglesia_id
    and (il.red_id is not null or il.casa_de_paz_id is not null)
    and il.fecha_eliminacion is null
    and private.fn_estructura_puede_administrar(p_iglesia_id)
  order by il.fecha_creacion desc;
$$;

-- DROP borra los grants existentes -- se restauran igual que en la
-- migracion original (20260805170233_estructura_invitacion_supervisor_red.sql).
revoke all on function public.fn_estructura_listar_invitaciones_red(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_listar_invitaciones_red(uuid)
  to authenticated;
