-- VisionHub — pedido del owner (2026-08-07): el correo de invitacion
-- generico de Supabase Auth ("Aceptar invitacion") no dice para que rol
-- fue invitada la persona. No se puede editar ese template desde aqui (vive
-- en el dashboard, protegido con hCaptcha, sin API de lectura disponible
-- para esta sesion) -- en vez de arriesgar pisarlo a ciegas, se manda un
-- SEGUNDO correo propio (mismo patron Brevo que
-- notificar-asignacion-cargo) con el rol y la entidad. Esta funcion junta
-- el nombre de la entidad (Red / Casa de Paz / Departamento) y de la
-- iglesia para armar ese correo.

begin;

create or replace function public.fn_estructura_datos_invitacion(
  p_red_id uuid,
  p_casa_de_paz_id uuid,
  p_departamento_id uuid
)
returns table(entidad_nombre text, iglesia_nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  if p_red_id is not null then
    select r.iglesia_id into v_iglesia_id from public.red r where r.id = p_red_id;
  elsif p_casa_de_paz_id is not null then
    select c.iglesia_id into v_iglesia_id from public.casa_de_paz c where c.id = p_casa_de_paz_id;
  elsif p_departamento_id is not null then
    select d.iglesia_id into v_iglesia_id from public.departamento d where d.id = p_departamento_id;
  end if;

  if v_iglesia_id is null or v_iglesia_id not in (select public.fn_mis_iglesias()) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    coalesce(
      (select r.nombre::text from public.red r where r.id = p_red_id),
      (select public.fn_etiqueta_cdp(c.id) from public.casa_de_paz c where c.id = p_casa_de_paz_id),
      (select d.nombre::text from public.departamento d where d.id = p_departamento_id)
    ),
    i.nombre::text
  from public.iglesia i
  where i.id = v_iglesia_id;
end;
$$;

revoke all on function public.fn_estructura_datos_invitacion(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_invitacion(uuid, uuid, uuid) to authenticated;

commit;
