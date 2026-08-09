-- VisionHub — KAN-117 (continuacion de 20260808220000): el mismo hueco de
-- REQ-ASG-7 existe para Pastor y Supervisor de la Vision en Accion cuando
-- se asignan "Desde base de datos" en PanelPrincipalEstructura.tsx -- ese
-- camino nunca llamaba a ningun mecanismo de correo (a diferencia de
-- invitar por correo nuevo, que ya dispara la plantilla Auth "Invite").
-- Mismo patron que la version de Red/CdP, a nivel iglesia directamente.

begin;

create or replace function public.fn_estructura_datos_notificacion_cargo_principal(
  p_iglesia_id uuid,
  p_persona_id uuid
)
returns table(persona_nombre text, correo text, iglesia_nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_iglesia_id is null or not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    public.fn_nombre_completo(p),
    coalesce(p.correo, u.email)::text,
    i.nombre::text
  from public.persona p
  join public.iglesia i on i.id = p_iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_notificacion_cargo_principal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_notificacion_cargo_principal(uuid, uuid) to authenticated;

commit;
