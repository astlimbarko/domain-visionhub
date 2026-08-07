-- VisionHub — REQ-ASG-7 (ya documentado como brecha real desde 2026-08-05):
-- al designar a alguien YA REGISTRADO (via "Desde base de datos" o
-- "asignar de todas formas" desde el correo), el sistema nunca le avisaba
-- por correo de su nuevo cargo. Pedido explicito del owner: agregar ese
-- aviso. Postgres no puede mandar correos solo -- esta funcion junta los
-- datos (con el mismo chequeo de permiso ya usado para asignar) y una
-- Edge Function nueva los usa para enviar el correo por Brevo SMTP.

begin;

create or replace function public.fn_estructura_datos_notificacion_cargo_red(
  p_red_id uuid,
  p_persona_id uuid
)
returns table(persona_nombre text, correo text, red_nombre text, iglesia_nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select r.iglesia_id into v_iglesia_id from public.red r where r.id = p_red_id;
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    public.fn_nombre_completo(p),
    coalesce(p.correo, u.email)::text,
    r.nombre::text,
    i.nombre::text
  from public.persona p
  join public.red r on r.id = p_red_id
  join public.iglesia i on i.id = r.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_notificacion_cargo_red(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_notificacion_cargo_red(uuid, uuid) to authenticated;

commit;
