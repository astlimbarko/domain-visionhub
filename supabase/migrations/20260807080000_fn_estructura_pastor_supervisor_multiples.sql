-- VisionHub — Constructor de Estructura Organizacional: Pastor admite hasta
-- 2 (pareja pastoral, "Pastor"/"Pastora" en la UI, mismo rol PASTOR) y
-- Supervisor de la Vision en Accion admite varios (pedido del owner,
-- 2026-08-07). Antes ambas RPC desactivaban a cualquier otro vigente antes
-- de asignar uno nuevo -- efectivamente singular. Ahora se agregan sin
-- reemplazar al anterior; quitar cargo pasa a exigir la persona puntual
-- (antes vaciaba TODOS los vigentes de ese rol, correcto solo mientras eran
-- singulares).

begin;

create or replace function public.fn_estructura_asignar_pastor(
  p_iglesia_id uuid,
  p_persona_id uuid,
  p_otp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_usuario_rol_id uuid;
  v_cantidad_vigente integer;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.iglesia i
    where i.id = p_iglesia_id and i.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_IGLESIA_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'ESTRUCTURA_PASTOR_SOLO_SUPER_ADMIN: solo un Super Admin puede asignar al Pastor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  select p.usuario_id
  into v_usuario_id
  from public.persona p
  where p.id = p_persona_id
    and p.iglesia_id = p_iglesia_id
    and p.fecha_eliminacion is null;

  if v_usuario_id is null then
    raise exception 'ESTRUCTURA_PERSONA_SIN_CUENTA: la persona no tiene una cuenta de acceso vinculada'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.usuario_rol ur
    where ur.usuario_id = v_usuario_id
      and ur.iglesia_id = p_iglesia_id
      and ur.rol <> 'PASTOR'
      and ur.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_PERSONA_YA_TIENE_ROL: esta persona ya tiene otro cargo de sistema en esta iglesia; quitaselo primero desde Administracion'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_cantidad_vigente
  from public.usuario_rol ur
  where ur.iglesia_id = p_iglesia_id
    and ur.rol = 'PASTOR'
    and ur.fecha_eliminacion is null
    and ur.usuario_id <> v_usuario_id;

  if v_cantidad_vigente >= 2 then
    raise exception 'ESTRUCTURA_PASTOR_MAXIMO_DOS: ya hay 2 personas asignadas como Pastor en esta iglesia'
      using errcode = 'P0001';
  end if;

  select id
  into v_usuario_rol_id
  from public.usuario_rol
  where iglesia_id = p_iglesia_id
    and rol = 'PASTOR'
    and usuario_id = v_usuario_id
    and fecha_eliminacion is null;

  if v_usuario_rol_id is null then
    insert into public.usuario_rol (usuario_id, rol, iglesia_id, creado_por, actualizado_por)
    values (v_usuario_id, 'PASTOR', p_iglesia_id, (select auth.uid()), (select auth.uid()))
    returning id into v_usuario_rol_id;
  end if;

  update public.iglesia
  set pastor_id = p_persona_id
  where id = p_iglesia_id;

  return v_usuario_rol_id;
end;
$$;

create or replace function public.fn_estructura_asignar_supervisor(
  p_iglesia_id uuid,
  p_persona_id uuid,
  p_otp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_usuario_rol_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.iglesia i
    where i.id = p_iglesia_id and i.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_IGLESIA_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'ESTRUCTURA_SUPERVISOR_SOLO_SUPER_ADMIN: solo un Super Admin puede asignar al Supervisor desde el constructor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  select p.usuario_id
  into v_usuario_id
  from public.persona p
  where p.id = p_persona_id
    and p.iglesia_id = p_iglesia_id
    and p.fecha_eliminacion is null;

  if v_usuario_id is null then
    raise exception 'ESTRUCTURA_PERSONA_SIN_CUENTA: la persona no tiene una cuenta de acceso vinculada'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.usuario_rol ur
    where ur.usuario_id = v_usuario_id
      and ur.iglesia_id = p_iglesia_id
      and ur.rol <> 'SUPERVISOR_VISION_ACCION'
      and ur.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_PERSONA_YA_TIENE_ROL: esta persona ya tiene otro cargo de sistema en esta iglesia; quitaselo primero desde Administracion'
      using errcode = 'P0001';
  end if;

  select id
  into v_usuario_rol_id
  from public.usuario_rol
  where iglesia_id = p_iglesia_id
    and rol = 'SUPERVISOR_VISION_ACCION'
    and usuario_id = v_usuario_id
    and fecha_eliminacion is null;

  if v_usuario_rol_id is null then
    insert into public.usuario_rol (usuario_id, rol, iglesia_id, creado_por, actualizado_por)
    values (v_usuario_id, 'SUPERVISOR_VISION_ACCION', p_iglesia_id, (select auth.uid()), (select auth.uid()))
    returning id into v_usuario_rol_id;
  end if;

  update public.iglesia
  set supervisor_id = p_persona_id
  where id = p_iglesia_id;

  return v_usuario_rol_id;
end;
$$;

create or replace function public.fn_estructura_quitar_pastor(
  p_iglesia_id uuid,
  p_persona_id uuid,
  p_otp text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_otro_pastor_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'ESTRUCTURA_PASTOR_SOLO_SUPER_ADMIN: solo un Super Admin puede quitar al Pastor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  select p.usuario_id into v_usuario_id
  from public.persona p
  where p.id = p_persona_id and p.iglesia_id = p_iglesia_id;

  update public.usuario_rol
  set fecha_eliminacion = now(),
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id
    and rol = 'PASTOR'
    and usuario_id = v_usuario_id
    and fecha_eliminacion is null;

  select p.id into v_otro_pastor_id
  from public.usuario_rol ur
  join public.persona p on p.usuario_id = ur.usuario_id and p.iglesia_id = p_iglesia_id
  where ur.iglesia_id = p_iglesia_id
    and ur.rol = 'PASTOR'
    and ur.fecha_eliminacion is null
  limit 1;

  update public.iglesia
  set pastor_id = v_otro_pastor_id
  where id = p_iglesia_id
    and pastor_id = p_persona_id;
end;
$$;

create or replace function public.fn_estructura_quitar_supervisor(
  p_iglesia_id uuid,
  p_persona_id uuid,
  p_otp text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_otro_supervisor_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'ESTRUCTURA_SUPERVISOR_SOLO_SUPER_ADMIN: solo un Super Admin puede quitar al Supervisor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  select p.usuario_id into v_usuario_id
  from public.persona p
  where p.id = p_persona_id and p.iglesia_id = p_iglesia_id;

  update public.usuario_rol
  set fecha_eliminacion = now(),
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id
    and rol = 'SUPERVISOR_VISION_ACCION'
    and usuario_id = v_usuario_id
    and fecha_eliminacion is null;

  select p.id into v_otro_supervisor_id
  from public.usuario_rol ur
  join public.persona p on p.usuario_id = ur.usuario_id and p.iglesia_id = p_iglesia_id
  where ur.iglesia_id = p_iglesia_id
    and ur.rol = 'SUPERVISOR_VISION_ACCION'
    and ur.fecha_eliminacion is null
  limit 1;

  update public.iglesia
  set supervisor_id = v_otro_supervisor_id
  where id = p_iglesia_id
    and supervisor_id = p_persona_id;
end;
$$;

revoke all on function public.fn_estructura_quitar_pastor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_quitar_pastor(uuid, uuid, text) to authenticated;
revoke all on function public.fn_estructura_quitar_supervisor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_quitar_supervisor(uuid, uuid, text) to authenticated;

drop function if exists public.fn_estructura_quitar_pastor(uuid, text);
drop function if exists public.fn_estructura_quitar_supervisor(uuid, text);

commit;
