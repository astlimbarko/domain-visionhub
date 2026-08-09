-- VisionHub — KAN-117: el correo de designacion (REQ-ASG-7 / KAN-89) solo
-- quedo conectado para Lider/Supervisor de Red (notificar-asignacion-cargo +
-- fn_estructura_datos_notificacion_cargo_red). Asignar un Lider o Sublider
-- de Casa de Paz a una persona ya registrada nunca avisaba por correo --
-- mismo patron que la version de Red, pero resolviendo la iglesia a traves
-- de casa_de_paz.iglesia_id en vez de red.iglesia_id.

begin;

create or replace function public.fn_estructura_datos_notificacion_cargo_cdp(
  p_cdp_id uuid,
  p_persona_id uuid
)
returns table(persona_nombre text, correo text, cdp_nombre text, iglesia_nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select c.iglesia_id into v_iglesia_id from public.casa_de_paz c where c.id = p_cdp_id;
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    public.fn_nombre_completo(p),
    coalesce(p.correo, u.email)::text,
    c.nombre::text,
    i.nombre::text
  from public.persona p
  join public.casa_de_paz c on c.id = p_cdp_id
  join public.iglesia i on i.id = c.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_notificacion_cargo_cdp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_notificacion_cargo_cdp(uuid, uuid) to authenticated;

commit;
