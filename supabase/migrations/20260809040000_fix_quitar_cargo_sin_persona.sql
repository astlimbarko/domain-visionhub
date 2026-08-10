-- VisionHub -- fix_quitar_cargo_sin_persona
-- Bug real (reportado 2026-08-09): "Quitar cargo" en el panel de Pastor/
-- Supervisor de Estructura Organizacional no hacia nada -- ni error, ni
-- efecto -- para cualquier persona con Membresia incompleta (sin fila en
-- `persona` todavia).
--
-- Causa: el frontend arma la lista de "actuales" con
-- `id: usuario.persona_id ?? usuario.usuario_id` (estructura.service.ts,
-- responsablesRol) -- si la persona no completo su Membresia, el id que
-- manda es el usuario_id, no un persona_id real. fn_estructura_quitar_pastor
-- y fn_estructura_quitar_supervisor solo sabian buscar por persona_id
-- (`select usuario_id from persona where id = p_persona_id`) -- al no
-- encontrar ninguna fila, v_usuario_id quedaba NULL y el UPDATE posterior
-- (WHERE usuario_id = NULL) no afectaba ninguna fila, sin lanzar excepcion
-- (los UPDATE de 0 filas no son un error en Postgres).
--
-- Fix: si el id recibido no matchea ninguna persona, probar si matchea
-- directamente un usuario_id con el cargo vigente correspondiente -- cubre
-- el caso "Membresia pendiente" sin tocar el comportamiento existente
-- cuando si hay Persona.
CREATE OR REPLACE FUNCTION public.fn_estructura_quitar_pastor(p_iglesia_id uuid, p_persona_id uuid, p_otp text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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

  -- Membresia pendiente: el frontend manda el usuario_id (no hay Persona
  -- todavia). Solo se acepta si ese usuario_id tiene efectivamente el cargo
  -- vigente en esta iglesia -- no abre una via para tocar cargos ajenos.
  if v_usuario_id is null and exists (
    select 1 from public.usuario_rol ur
    where ur.usuario_id = p_persona_id and ur.iglesia_id = p_iglesia_id
      and ur.rol = 'PASTOR' and ur.fecha_eliminacion is null
  ) then
    v_usuario_id := p_persona_id;
  end if;

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
$function$;

CREATE OR REPLACE FUNCTION public.fn_estructura_quitar_supervisor(p_iglesia_id uuid, p_persona_id uuid, p_otp text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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

  if v_usuario_id is null and exists (
    select 1 from public.usuario_rol ur
    where ur.usuario_id = p_persona_id and ur.iglesia_id = p_iglesia_id
      and ur.rol = 'SUPERVISOR_VISION_ACCION' and ur.fecha_eliminacion is null
  ) then
    v_usuario_id := p_persona_id;
  end if;

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
$function$;
