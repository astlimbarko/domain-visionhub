-- VisionHub -- KAN-182: 3 restricciones nuevas para el Constructor.
--
-- 1) Lider/Supervisor de Red ya no puede editar la entidad Red (nombre/
--    color) -- solo Pastor/Supervisor/Super Admin (o el operativo de la
--    iglesia madre, para satelites). Crear/gestionar Casas de Paz dentro de
--    su Red sigue disponible (fn_estructura_crear_cdp sigue usando el check
--    mas amplio, fn_estructura_puede_administrar_red).
-- 2) Para ese mismo nivel de rol (ni Pastor, ni Supervisor, ni Super Admin),
--    la proteccion OTP pasa a ser obligatoria SIEMPRE, sin importar el
--    switch por iglesia (que solo Pastor/Supervisor/Super Admin pueden ver
--    o tocar desde el panel).
-- 3) Auditoria de quien hizo cada asignacion/baja de cargo de Red/CdP --
--    creado_por/actualizado_por existian en ambas tablas pero no se
--    completaban ni desde las RPC de asignar (fn_asignar_cargo_cdp/red)
--    ni desde la baja directa por PostgREST (quitarCargoCdp/Red en
--    casas-de-paz.service.ts). Un trigger cubre ambos caminos de una vez,
--    sin tener que tocar cada funcion por separado.

begin;

-- 1) Editar nombre/color de Red: quita el fallback de Lider de Red.
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
as $function$
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

  -- KAN-182: ya no acepta fn_estructura_puede_administrar_red (que incluye
  -- a Lider de Red) -- editar nombre/color queda exclusivo de
  -- Pastor/Supervisor/Super Admin (o el operativo de la iglesia madre).
  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
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
$function$;

-- 2) OTP obligatorio siempre para quien no es Pastor/Supervisor/Super Admin.
create or replace function private.fn_estructura_exigir_otp(p_iglesia_id uuid, p_codigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_otp_requerido boolean;
  v_obligatorio boolean;
begin
  select eo.otp_requerido
  into v_otp_requerido
  from public.estructura_organigrama eo
  where eo.iglesia_id = p_iglesia_id;

  -- KAN-182: Lider/Supervisor de Red (ni Pastor, ni Supervisor, ni Super
  -- Admin) siempre necesitan OTP, sin importar el switch de la iglesia --
  -- ese switch solo lo pueden ver/tocar los roles de nivel superior.
  v_obligatorio := coalesce(v_otp_requerido, false)
    or not (
      public.fn_es_super_admin()
      or public.fn_es_pastor_en(p_iglesia_id)
      or public.fn_es_operativo_en(p_iglesia_id)
    );

  if v_obligatorio
     and not public.fn_verificar_otp(p_codigo) then
    raise exception 'OTP_ESTRUCTURA_INVALIDO'
      using errcode = 'P0001';
  end if;
end;
$function$;

-- 3) Auditoria: quien creo/modifico cada cargo de Red/CdP -- cubre tanto
-- las RPC de asignar (fn_asignar_cargo_cdp/red, que insertaban sin
-- creado_por) como la baja directa por PostgREST (quitarCargoCdp/Red,
-- update de solo fecha_fin sin actualizado_por).
create or replace function private.fn_cargo_auditar_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.actualizado_por := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.actualizado_por := auth.uid();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_red_cargo_auditar_actor on public.red_cargo;
create trigger trg_red_cargo_auditar_actor
  before insert or update on public.red_cargo
  for each row execute function private.fn_cargo_auditar_actor();

drop trigger if exists trg_casa_de_paz_cargo_auditar_actor on public.casa_de_paz_cargo;
create trigger trg_casa_de_paz_cargo_auditar_actor
  before insert or update on public.casa_de_paz_cargo
  for each row execute function private.fn_cargo_auditar_actor();

commit;
