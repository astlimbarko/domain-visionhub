-- VisionHub -- KAN-280: asignar un cargo de Líder/Sublíder de Casa de Paz o
-- Líder de Red a una PERSONA YA EXISTENTE (no una invitación nueva) nunca
-- aseguraba que existiera una fila activa en usuario_rol para esa persona.
-- fn_mi_membresia_incompleta (el gate que muestra el formulario de
-- membresía) resuelve la iglesia a completar buscando justo una fila activa
-- ahí -- sin ella, alguien con membresia_completada=false queda para
-- siempre sin que el sistema le pida terminar su ficha, aunque su panel
-- funcione bien (el panel no depende de usuario_rol, viene de los cargos).
--
-- Caso real que lo disparó: mariajulietavm2020@gmail.com. Su usuario_rol
-- original (invitación del 22/08) se eliminó el 31/08 junto con el ban
-- por error (KAN-279). Cuando se le reasignó Líder de Casa de Paz el 02/09
-- vía el Constructor (persona ya existente, no invitación), nadie volvió a
-- crear esa fila -- quedó para siempre sin que le aparezca el formulario.
--
-- Alcance: solo LIDER_CDP/SUBLIDER_CDP y LIDER_RED -- son los únicos 3
-- valores de rol_sistema_enum que aplican acá (SUPER_ADMIN/PASTOR/
-- SUPERVISOR_VISION_ACCION se manejan aparte, vía fn_crear_usuario_rol).
-- SUBLIDER_RED (Supervisor de Red) y Líder de Departamento quedan FUERA a
-- propósito: rol_sistema_enum no tiene un valor para ninguno de los dos, así
-- que ninguna invitación ni asignación a esos cargos crea nunca una fila en
-- usuario_rol -- es una limitación ya existente del enum, no algo que este
-- fix pueda resolver sin agregar un valor nuevo (alcance más grande, aparte).

begin;

create or replace function private.fn_asegurar_usuario_rol_por_cargo(
  p_persona_id uuid,
  p_iglesia_id uuid,
  p_rol public.rol_sistema_enum
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
begin
  select usuario_id into v_usuario_id
  from public.persona
  where id = p_persona_id and fecha_eliminacion is null;

  if v_usuario_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.usuario_rol
    where usuario_id = v_usuario_id
      and iglesia_id = p_iglesia_id
      and rol = p_rol
      and fecha_eliminacion is null
  ) then
    insert into public.usuario_rol (usuario_id, iglesia_id, rol, creado_por)
    values (v_usuario_id, p_iglesia_id, p_rol, (select auth.uid()));
  end if;
end;
$$;

revoke all on function private.fn_asegurar_usuario_rol_por_cargo(uuid, uuid, public.rol_sistema_enum) from public, anon, authenticated;

create or replace function public.fn_asignar_cargo_cdp(p_cdp_id uuid, p_persona_id uuid, p_codigo text, p_cargo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_red_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_cdp_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: la casa de paz no existe' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
    RAISE EXCEPTION 'CARGO_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo = 'LIDER_CDP' AND v_red_id IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_id, 'CAMBIAR_LIDER_CDP',
        jsonb_build_object('cdp_id', p_cdp_id, 'persona_id', p_persona_id, 'codigo', p_codigo, 'cargo_id', p_cargo_id),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de cambio de Líder de Casa de Paz',
        'El Supervisor pidió designar un nuevo Líder para una Casa de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  IF p_codigo = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = p_cdp_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_cdp_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  -- KAN-280: LIDER_CDP y SUBLIDER_CDP son los 2 valores de rol_sistema_enum
  -- que aplican acá (ANFITRION no es un rol de acceso, no tiene valor en
  -- ese enum -- no corresponde crearle usuario_rol).
  IF p_codigo IN ('LIDER_CDP', 'SUBLIDER_CDP') THEN
    PERFORM private.fn_asegurar_usuario_rol_por_cargo(p_persona_id, v_iglesia_id, p_codigo::rol_sistema_enum);
  END IF;

  RETURN v_id;
END;
$function$;

create or replace function private.fn_estructura_asignar_cargo_red(p_red_id uuid, p_persona_id uuid, p_codigo text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_existente_id uuid;
  v_nuevo_id uuid;
  v_vigentes_count integer;
begin
  if p_codigo not in ('LIDER_RED', 'SUBLIDER_RED') then
    raise exception 'ESTRUCTURA_CARGO_RED_INVALIDO'
      using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id
    and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.persona p
    where p.id = p_persona_id
      and p.iglesia_id = v_iglesia_id
      and p.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_PERSONA_FUERA_DE_IGLESIA'
      using errcode = 'P0001';
  end if;

  select c.id
  into v_cargo_id
  from public.cargo c
  where c.codigo = p_codigo
    and c.activo
    and c.fecha_eliminacion is null;

  if v_cargo_id is null then
    raise exception 'ESTRUCTURA_CARGO_RED_NO_DISPONIBLE'
      using errcode = 'P0001';
  end if;

  select rc.id
  into v_existente_id
  from public.red_cargo rc
  where rc.red_id = p_red_id
    and rc.cargo_id = v_cargo_id
    and rc.persona_id = p_persona_id
    and rc.fecha_fin is null
    and rc.fecha_eliminacion is null
  order by rc.fecha_inicio, rc.id
  limit 1;

  if v_existente_id is not null then
    -- KAN-280: el cargo ya existía, pero usuario_rol podía haberse perdido
    -- igual (caso Maria) -- se asegura de todas formas antes de devolver.
    if p_codigo = 'LIDER_RED' then
      perform private.fn_asegurar_usuario_rol_por_cargo(p_persona_id, v_iglesia_id, 'LIDER_RED'::public.rol_sistema_enum);
    end if;
    return v_existente_id;
  end if;

  if p_codigo = 'LIDER_RED' then
    update public.red_cargo rc
    set fecha_fin = current_date,
        actualizado_por = (select auth.uid())
    where rc.red_id = p_red_id
      and rc.cargo_id = v_cargo_id
      and rc.fecha_fin is null
      and rc.fecha_eliminacion is null;
  else
    -- SUBLIDER_RED (Supervisor de Red): hasta 2 vigentes simultáneos.
    select count(*)
    into v_vigentes_count
    from public.red_cargo rc
    where rc.red_id = p_red_id
      and rc.cargo_id = v_cargo_id
      and rc.fecha_fin is null
      and rc.fecha_eliminacion is null;

    if v_vigentes_count >= 2 then
      raise exception 'ESTRUCTURA_SUPERVISOR_RED_LIMITE: ya hay 2 Supervisores de Red vigentes en esta Red, quitá uno primero'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.red_cargo (
    iglesia_id, red_id, persona_id, cargo_id, fecha_inicio,
    creado_por, actualizado_por
  ) values (
    v_iglesia_id, p_red_id, p_persona_id, v_cargo_id, current_date,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_nuevo_id;

  -- KAN-280: SUBLIDER_RED queda afuera a propósito -- rol_sistema_enum no
  -- tiene ese valor (ver nota arriba del archivo).
  if p_codigo = 'LIDER_RED' then
    perform private.fn_asegurar_usuario_rol_por_cargo(p_persona_id, v_iglesia_id, 'LIDER_RED'::public.rol_sistema_enum);
  end if;

  return v_nuevo_id;
end;
$function$;

commit;
