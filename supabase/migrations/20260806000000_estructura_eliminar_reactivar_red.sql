-- VisionHub — Estructura Organizacional: eliminar/reactivar una Red.
-- Pedido explícito del owner: nunca borrado físico (ya lo bloquea
-- trg_no_delete_red) — soft-delete visible y agrisado en el lienzo durante
-- 1 año, con opción de reactivar. El corte de 1 año lo aplica el frontend
-- al leer (WHERE fecha_eliminacion es null O es reciente), acá solo se
-- marca/desmarca la fecha.

begin;

create or replace function public.fn_estructura_eliminar_red(
  p_red_id uuid,
  p_otp text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  update public.red
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where id = p_red_id;
end;
$$;

create or replace function public.fn_estructura_reactivar_red(
  p_red_id uuid,
  p_otp text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is not null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  update public.red
  set fecha_eliminacion = null, eliminado_por = null
  where id = p_red_id;
end;
$$;

revoke all on function public.fn_estructura_eliminar_red(uuid, text) from public, anon, authenticated;
revoke all on function public.fn_estructura_reactivar_red(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_eliminar_red(uuid, text) to authenticated;
grant execute on function public.fn_estructura_reactivar_red(uuid, text) to authenticated;

commit;
