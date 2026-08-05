-- VisionHub — Constructor de Estructura Organizacional: asignar Pastor.
-- Aditiva: reutiliza usuario_rol/persona/iglesia y el trigger existente
-- trg_validar_rol (fn_validar_asignacion_rol) que ya exige Super Admin para
-- el rol PASTOR. No modifica flujos históricos ni RPC de otros paneles.
-- El Pastor es singular por iglesia (a diferencia de Supervisor de Red, que
-- admite plural): asignar uno nuevo reemplaza al anterior de forma atómica,
-- un solo OTP, respetando el switch OTP propio del módulo.

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

  -- Desactiva cualquier otro PASTOR vigente de esta iglesia (singular).
  update public.usuario_rol
  set fecha_eliminacion = now(),
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id
    and rol = 'PASTOR'
    and fecha_eliminacion is null
    and usuario_id <> v_usuario_id;

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

revoke all on function public.fn_estructura_asignar_pastor(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_asignar_pastor(uuid, uuid, text)
  to authenticated;

commit;
