-- VisionHub -- KAN-376 seguimiento (2026-09-13, pedido explícito del owner
-- probando en vivo): quiere poder asignarle una contraseña fija a
-- leonosinagafelipa@gmail.com para loguearse como ella y probar el fix,
-- sin depender del correo de invitación. El botón "Restablecer contraseña"
-- (KAN-278) ya existe pero solo se muestra cuando la invitación ya fue
-- ACEPTADA (persona.id real) -- mientras está PENDIENTE, la persona
-- todavía no existe como fila `persona` (se crea recién en
-- fn_completar_membresia), así que no hay forma de usarlo.
--
-- Fix: mismo patrón de "fallback a usuario_id" que ya usaba
-- fn_estructura_datos_reenvio_cargo_principal para Pastor/Supervisor
-- recién invitado -- se extiende a la variante de Casa de Paz. Se agrega
-- usuario_id a fn_estructura_listar_invitaciones_red (la RPC real que
-- alimenta casaDePaz.lideres/sublideres en el lienzo del Constructor,
-- no fn_listar_invitaciones_lider -- esa es una lista aparte, sin
-- relación con este panel) para que el frontend tenga ese id disponible.

begin;

-- RETURNS TABLE cambia de forma -- DROP + CREATE, mismo criterio que la
-- migración original de esta función (20260823010000).
drop function if exists public.fn_estructura_listar_invitaciones_red(uuid);

create function public.fn_estructura_listar_invitaciones_red(p_iglesia_id uuid)
returns table(
  id uuid, correo character varying, red_id uuid, casa_de_paz_id uuid,
  cargo_codigo character varying, estado character varying, fecha_creacion timestamp with time zone,
  usuario_id uuid
)
language sql stable security definer set search_path = '' as $$
  select
    il.id,
    il.correo,
    il.red_id,
    il.casa_de_paz_id,
    c.codigo,
    il.estado,
    il.fecha_creacion,
    il.usuario_id
  from public.invitacion_lider il
  join public.cargo c on c.id = il.cargo_id
  where il.iglesia_id = p_iglesia_id
    and (il.red_id is not null or il.casa_de_paz_id is not null)
    and il.fecha_eliminacion is null
    and private.fn_estructura_puede_administrar(p_iglesia_id)
  order by il.fecha_creacion desc;
$$;

revoke all on function public.fn_estructura_listar_invitaciones_red(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_listar_invitaciones_red(uuid)
  to authenticated;

create or replace function public.fn_estructura_datos_reenvio_cargo_cdp(
  p_cdp_id uuid,
  p_persona_id uuid
)
returns table(correo text, persona_nombre text, iglesia_nombre text, usuario_id uuid, membresia_completada boolean, invitado_confirmado boolean)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_iglesia_id uuid;
begin
  select c.iglesia_id into v_iglesia_id from public.casa_de_paz c where c.id = p_cdp_id;
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  -- p_persona_id acepta TANTO un persona.id real COMO, en el caso de una
  -- invitacion todavia PENDIENTE (la Persona recien se crea al aceptar,
  -- fn_completar_membresia), un usuario_id de respaldo -- mismo criterio
  -- que ya usaba fn_estructura_datos_reenvio_cargo_principal.
  return query
  select
    coalesce(p.correo, u.email)::text,
    coalesce(public.fn_nombre_completo(p), ''),
    i.nombre::text,
    coalesce(p.usuario_id, u.id),
    coalesce(p.membresia_completada, false),
    (u.email_confirmed_at is not null)
  from public.casa_de_paz c
  join public.iglesia i on i.id = c.iglesia_id
  left join public.persona p on p.id = p_persona_id and p.fecha_eliminacion is null
  left join auth.users u on u.id = coalesce(p.usuario_id, p_persona_id)
  where c.id = p_cdp_id
  limit 1;
end;
$$;

commit;
