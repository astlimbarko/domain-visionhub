-- VisionHub — Estructura Organizacional: invitaciones y estado de Redes.
-- Reutiliza invitacion_lider. Un Supervisor de Red conserva LIDER_RED como
-- rol funcional de acceso, pero recibe el cargo SUBLIDER_RED en la Red.

begin;

create or replace function public.fn_estructura_validar_otp_red(
  p_red_id uuid,
  p_codigo text default null
)
returns boolean
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

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id
    and r.fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_codigo);
  return true;
end;
$$;

create or replace function public.fn_estructura_invitar_supervisor_red(
  p_usuario_id uuid,
  p_correo text,
  p_red_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_invitacion_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id
    and r.fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  select c.id
  into v_cargo_id
  from public.cargo c
  where c.codigo = 'SUBLIDER_RED'
    and c.activo
    and c.fecha_eliminacion is null;

  if v_cargo_id is null then
    raise exception 'ESTRUCTURA_CARGO_RED_NO_DISPONIBLE'
      using errcode = 'P0001';
  end if;

  insert into public.usuario_rol (
    usuario_id, rol, iglesia_id, creado_por, actualizado_por
  ) values (
    p_usuario_id, 'LIDER_RED'::public.rol_sistema_enum, v_iglesia_id,
    (select auth.uid()), (select auth.uid())
  );

  insert into public.invitacion_lider (
    usuario_id, correo, iglesia_id, rol, red_id, cargo_id,
    creado_por, actualizado_por
  ) values (
    p_usuario_id, lower(btrim(p_correo)), v_iglesia_id,
    'LIDER_RED'::public.rol_sistema_enum, p_red_id, v_cargo_id,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_invitacion_id;

  return v_invitacion_id;
end;
$$;

create or replace function public.fn_estructura_listar_invitaciones_red(
  p_iglesia_id uuid
)
returns table (
  id uuid,
  correo varchar,
  red_id uuid,
  cargo_codigo varchar,
  estado varchar,
  fecha_creacion timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    il.id,
    il.correo,
    il.red_id,
    c.codigo,
    il.estado,
    il.fecha_creacion
  from public.invitacion_lider il
  join public.cargo c on c.id = il.cargo_id
  where il.iglesia_id = p_iglesia_id
    and il.red_id is not null
    and il.fecha_eliminacion is null
    and private.fn_estructura_puede_administrar(p_iglesia_id)
  order by il.fecha_creacion desc;
$$;

create index if not exists idx_invitacion_lider_red_pendiente
  on public.invitacion_lider (iglesia_id, red_id, cargo_id)
  where estado = 'PENDIENTE' and fecha_eliminacion is null;

revoke all on function public.fn_estructura_validar_otp_red(uuid, text)
  from public, anon, authenticated;
revoke all on function public.fn_estructura_invitar_supervisor_red(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.fn_estructura_listar_invitaciones_red(uuid)
  from public, anon, authenticated;

grant execute on function public.fn_estructura_validar_otp_red(uuid, text)
  to authenticated;
grant execute on function public.fn_estructura_invitar_supervisor_red(uuid, text, uuid)
  to authenticated;
grant execute on function public.fn_estructura_listar_invitaciones_red(uuid)
  to authenticated;

commit;