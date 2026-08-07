-- VisionHub — Constructor de Estructura Organizacional: asignar Supervisor
-- de la Visión en Acción.
-- Aditiva: mismo patrón que fn_estructura_asignar_pastor
-- (20260805194500). Decisión explícita del owner (2026-08-05):
-- 1) Solo Super Admin asigna/cambia Supervisor desde este módulo -- coincide
--    con la regla ya existente en trg_validar_rol (fn_validar_asignacion_rol),
--    que exige Super Admin o Pastor para el rol SUPERVISOR_VISION_ACCION; el
--    Pastor no tiene acceso a este módulo (REQ-PER-4), así que en la práctica
--    queda en Super Admin. No se modifica el trigger global.
-- 2) "Cambiar" reemplaza al Supervisor principal mostrado (como Pastor),
--    aunque la base sigue permitiendo varios Supervisores vigentes (REQ-PER-7)
--    para otros flujos que no pasen por esta RPC.

begin;

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

  -- Reemplaza al Supervisor principal mostrado en el organigrama. La base
  -- permite varios Supervisores (REQ-PER-7); esta RPC desactiva los que
  -- existieran para dejar uno solo como principal vía este módulo.
  update public.usuario_rol
  set fecha_eliminacion = now(),
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id
    and rol = 'SUPERVISOR_VISION_ACCION'
    and fecha_eliminacion is null
    and usuario_id <> v_usuario_id;

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

revoke all on function public.fn_estructura_asignar_supervisor(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_asignar_supervisor(uuid, uuid, text)
  to authenticated;

commit;
