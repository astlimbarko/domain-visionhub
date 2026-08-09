-- VisionHub -- KAN-78: Vista del lienzo segun rol (Lider/Supervisor de Red).
--
-- El frontend ya va a dejar entrar a Lider de Red y Supervisor de Red
-- (cargo LIDER_RED/SUBLIDER_RED, misma paridad de
-- 91_fn_es_lider_de_red_incluye_sublider.sql) al lienzo de Estructura
-- Organizacional, con su propia Red editable y el resto de solo lectura.
-- Sin este cambio, cada mutacion sobre SU PROPIA Red fallaba igual con
-- SIN_PERMISO: el Constructor de Estructura Organizacional (lienzo) solo
-- autorizaba a SUPER_ADMIN/SUPERVISOR via private.fn_estructura_puede_administrar
-- -- nunca reconocia a Lider de Red, ni siquiera para su propia Red.
--
-- Se agrega un chequeo alterno acotado a la Red (fn_es_lider_de_red, el mismo
-- helper que ya usa el flujo existente de asignacion de cargos de Casa de Paz
-- -- fn_asignar_cargo_cdp, 58_solicitudes_estructura.sql -- para reconocer a
-- Lider/Supervisor de Red sobre las CdP de su propia Red) solo en las
-- operaciones que corresponden a "administrar mi propia Red": renombrar o
-- cambiar color, designar/quitar Lider y Supervisor de Red (desde base de
-- datos o sobre una cuenta ya existente), crear Casas de Paz dentro de ella,
-- y el aviso por correo de esa designacion.
--
-- Deliberadamente fuera de este alcance (siguen exclusivas de
-- Supervisor/Super Admin, sin cambios): crear una Red nueva, eliminar/
-- reactivar/borrar definitivamente una Red, y la proteccion OTP global de la
-- iglesia -- son acciones estructurales que exceden "mi propia Red". Tambien
-- queda fuera (documentado en el ticket, no en esta migracion): invitar por
-- correo a una persona SIN CUENTA registrada para Lider/Supervisor de Red
-- (fn_puede_invitar_lider) -- ese camino sigue exclusivo de
-- Supervisor/Super Admin; el camino de "Desde base de datos" (la persona ya
-- existe) que se corrige aca es el uso real mas comun.

begin;

create or replace function private.fn_estructura_puede_administrar_red(
  p_iglesia_id uuid,
  p_red_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.fn_estructura_puede_administrar(p_iglesia_id)
    or (p_red_id is not null and public.fn_es_lider_de_red(p_red_id));
$$;

revoke all on function private.fn_estructura_puede_administrar_red(uuid, uuid)
  from public, anon, authenticated;

-- fn_estructura_actualizar_red: renombrar/cambiar color de la propia Red.
create or replace function public.fn_estructura_actualizar_red(
  p_red_id uuid,
  p_nombre text,
  p_color text,
  p_otp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_nombre text := btrim(p_nombre);
  v_color text := upper(btrim(p_color));
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 100 then
    raise exception 'ESTRUCTURA_RED_NOMBRE_INVALIDO'
      using errcode = 'P0001';
  end if;

  if v_color is null or v_color !~ '^#[0-9A-F]{6}$' then
    raise exception 'ESTRUCTURA_RED_COLOR_INVALIDO'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  update public.red
  set nombre = v_nombre,
      color = v_color,
      actualizado_por = (select auth.uid())
  where id = p_red_id;

  return p_red_id;
end;
$$;

-- fn_estructura_asignar_cargo_red (wrapper publico con OTP): designar Lider
-- o Supervisor de Red desde base de datos, dentro de la propia Red.
create or replace function public.fn_estructura_asignar_cargo_red(
  p_red_id uuid,
  p_persona_id uuid,
  p_codigo text,
  p_otp text default null
)
returns uuid
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
  where r.id = p_red_id and r.fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  return private.fn_estructura_asignar_cargo_red(
    p_red_id, p_persona_id, p_codigo
  );
end;
$$;

-- fn_estructura_quitar_cargo_red: quitar el cargo de Lider/Supervisor de la
-- propia Red.
create or replace function public.fn_estructura_quitar_cargo_red(
  p_red_id uuid,
  p_codigo text,
  p_otp text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_cantidad integer;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_codigo not in ('LIDER_RED', 'SUBLIDER_RED') then
    raise exception 'ESTRUCTURA_CARGO_RED_INVALIDO'
      using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  select c.id into v_cargo_id
  from public.cargo c
  where c.codigo = p_codigo
    and c.activo
    and c.fecha_eliminacion is null;

  update public.red_cargo rc
  set fecha_fin = current_date,
      actualizado_por = (select auth.uid())
  where rc.red_id = p_red_id
    and rc.cargo_id = v_cargo_id
    and rc.fecha_fin is null
    and rc.fecha_eliminacion is null;

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

-- fn_estructura_crear_cdp: crear una Casa de Paz dentro de la propia Red.
create or replace function public.fn_estructura_crear_cdp(
  p_red_id uuid,
  p_lider_persona_id uuid default null,
  p_otp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cdp_id uuid;
  v_cargo_lider_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  if p_lider_persona_id is not null and not exists (
    select 1
    from public.persona p
    where p.id = p_lider_persona_id
      and p.iglesia_id = v_iglesia_id
      and p.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_PERSONA_FUERA_DE_IGLESIA' using errcode = 'P0001';
  end if;

  insert into public.casa_de_paz (iglesia_id, nombre, creado_por, actualizado_por)
  values (v_iglesia_id, null, (select auth.uid()), (select auth.uid()))
  returning id into v_cdp_id;

  insert into public.casa_de_paz_red (
    iglesia_id, casa_de_paz_id, red_id, fecha_inicio, creado_por, actualizado_por
  ) values (
    v_iglesia_id, v_cdp_id, p_red_id, current_date, (select auth.uid()), (select auth.uid())
  );

  if p_lider_persona_id is not null then
    select c.id
    into v_cargo_lider_id
    from public.cargo c
    where c.codigo = 'LIDER_CDP'
      and c.activo
      and c.fecha_eliminacion is null;

    if v_cargo_lider_id is null then
      raise exception 'ESTRUCTURA_CARGO_CDP_NO_DISPONIBLE' using errcode = 'P0001';
    end if;

    insert into public.casa_de_paz_cargo (
      iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio,
      creado_por, actualizado_por
    ) values (
      v_iglesia_id, v_cdp_id, p_lider_persona_id, v_cargo_lider_id, current_date,
      (select auth.uid()), (select auth.uid())
    );
  end if;

  return v_cdp_id;
end;
$$;

-- fn_estructura_datos_notificacion_cargo_red: aviso por correo (REQ-ASG-7) al
-- designar Lider/Supervisor de la propia Red -- mismo chequeo que la
-- asignacion real, si no la designacion funciona pero el correo queda mudo
-- para Lider de Red.
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
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
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

commit;
