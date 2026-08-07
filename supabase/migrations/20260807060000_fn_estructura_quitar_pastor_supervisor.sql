-- VisionHub — gap real reportado por el owner (2026-08-07): no existia
-- forma de vaciar el cargo de Pastor/Supervisor desde el constructor, solo
-- asignar/cambiar. Mismos chequeos que fn_estructura_asignar_pastor/
-- supervisor (solo Super Admin, respeta el switch de OTP).

begin;

create or replace function public.fn_estructura_quitar_pastor(p_iglesia_id uuid, p_otp text default null::text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
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

  update public.usuario_rol
  set fecha_eliminacion = now(),
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id
    and rol = 'PASTOR'
    and fecha_eliminacion is null;

  update public.iglesia
  set pastor_id = null
  where id = p_iglesia_id;
end;
$function$;

revoke all on function public.fn_estructura_quitar_pastor(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_quitar_pastor(uuid, text) to authenticated;

create or replace function public.fn_estructura_quitar_supervisor(p_iglesia_id uuid, p_otp text default null::text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
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

  update public.usuario_rol
  set fecha_eliminacion = now(),
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id
    and rol = 'SUPERVISOR_VISION_ACCION'
    and fecha_eliminacion is null;

  update public.iglesia
  set supervisor_id = null
  where id = p_iglesia_id;
end;
$function$;

revoke all on function public.fn_estructura_quitar_supervisor(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_quitar_supervisor(uuid, text) to authenticated;

commit;
