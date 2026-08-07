-- VisionHub — al invitar por correo a alguien que ya tiene cuenta, el
-- admin solo se enteraba de que "ya existe" pero no de QUIEN es, ni podia
-- asignarla directo -- tenia que ir a buscarla por nombre a mano en la
-- otra pestaña. Pedido explicito del owner: que se pueda asignar "de
-- todas formas" desde el mismo lugar donde salta el aviso.

begin;

create or replace function public.fn_persona_por_correo_cuenta(p_correo text)
returns table(id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, public.fn_nombre_completo(p)
  from auth.users u
  join public.persona p on p.usuario_id = u.id and p.fecha_eliminacion is null
  where lower(u.email) = lower(p_correo)
  limit 1;
$$;

revoke all on function public.fn_persona_por_correo_cuenta(text) from public, anon, authenticated;
grant execute on function public.fn_persona_por_correo_cuenta(text) to authenticated;

commit;
