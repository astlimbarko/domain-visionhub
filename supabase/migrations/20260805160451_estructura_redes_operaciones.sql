-- VisionHub — Constructor de Estructura Organizacional: operaciones de Redes.
-- Aditiva: reutiliza red/red_cargo y no modifica los flujos históricos.

begin;

create schema if not exists private;

-- Autorización común no expuesta por Data API. Incluye la administración de
-- una iglesia satélite desde el Supervisor de su iglesia madre.
create or replace function private.fn_estructura_puede_administrar(
  p_iglesia_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      public.fn_es_super_admin()
      or public.fn_es_operativo_en(p_iglesia_id)
      or exists (
        select 1
        from public.iglesia i
        where i.id = p_iglesia_id
          and i.tipo = 'SATELITE'::public.iglesia_tipo_enum
          and i.fecha_eliminacion is null
          and i.iglesia_padre_id is not null
          and public.fn_es_operativo_en(i.iglesia_padre_id)
      )
    );
$$;

revoke all on function private.fn_estructura_puede_administrar(uuid)
  from public, anon, authenticated;

create or replace function private.fn_estructura_exigir_otp(
  p_iglesia_id uuid,
  p_codigo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_otp_requerido boolean;
begin
  select eo.otp_requerido
  into v_otp_requerido
  from public.estructura_organigrama eo
  where eo.iglesia_id = p_iglesia_id;

  if coalesce(v_otp_requerido, false)
     and not public.fn_verificar_otp(p_codigo) then
    raise exception 'OTP_ESTRUCTURA_INVALIDO'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.fn_estructura_exigir_otp(uuid, text)
  from public, anon, authenticated;

-- El constructor muestra un único Líder y un único Supervisor de Red. La base
-- permanece abierta: no se agrega una restricción UNIQUE global y otros flujos
-- pueden conservar el modelo plural existente.
create or replace function private.fn_estructura_asignar_cargo_red(
  p_red_id uuid,
  p_persona_id uuid,
  p_codigo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_existente_id uuid;
  v_nuevo_id uuid;
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

  update public.red_cargo rc
  set fecha_fin = current_date,
      actualizado_por = (select auth.uid())
  where rc.red_id = p_red_id
    and rc.cargo_id = v_cargo_id
    and rc.fecha_fin is null
    and rc.fecha_eliminacion is null
    and (v_existente_id is null or rc.id <> v_existente_id);

  if v_existente_id is not null then
    return v_existente_id;
  end if;

  insert into public.red_cargo (
    iglesia_id, red_id, persona_id, cargo_id, fecha_inicio,
    creado_por, actualizado_por
  ) values (
    v_iglesia_id, p_red_id, p_persona_id, v_cargo_id, current_date,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_nuevo_id;

  return v_nuevo_id;
end;
$$;

revoke all on function private.fn_estructura_asignar_cargo_red(uuid, uuid, text)
  from public, anon, authenticated;

create or replace function public.fn_estructura_configurar_otp(
  p_iglesia_id uuid,
  p_requerido boolean,
  p_otp text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  insert into public.estructura_organigrama (iglesia_id, creado_por)
  values (p_iglesia_id, (select auth.uid()))
  on conflict (iglesia_id) do nothing;

  select eo.otp_requerido
  into v_anterior
  from public.estructura_organigrama eo
  where eo.iglesia_id = p_iglesia_id
  for update;

  if v_anterior = p_requerido then
    return p_requerido;
  end if;

  -- Desactivar una protección ya habilitada siempre exige un código válido.
  if v_anterior and not p_requerido
     and not public.fn_verificar_otp(p_otp) then
    raise exception 'OTP_ESTRUCTURA_INVALIDO'
      using errcode = 'P0001';
  end if;

  update public.estructura_organigrama
  set otp_requerido = p_requerido,
      actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id;

  insert into public.estructura_otp_auditoria (
    iglesia_id, usuario_id, valor_anterior, valor_nuevo
  ) values (
    p_iglesia_id, (select auth.uid()), v_anterior, p_requerido
  );

  return p_requerido;
end;
$$;

create or replace function public.fn_estructura_crear_red(
  p_iglesia_id uuid,
  p_nombre text,
  p_color text,
  p_lider_persona_id uuid default null,
  p_supervisor_persona_id uuid default null,
  p_otp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(p_nombre);
  v_color text := upper(btrim(p_color));
  v_red_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.iglesia i
    where i.id = p_iglesia_id and i.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_IGLESIA_NO_ENCONTRADA'
      using errcode = 'P0001';
  end if;

  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 100 then
    raise exception 'ESTRUCTURA_RED_NOMBRE_INVALIDO'
      using errcode = 'P0001';
  end if;

  if v_color is null or v_color !~ '^#[0-9A-F]{6}$' then
    raise exception 'ESTRUCTURA_RED_COLOR_INVALIDO'
      using errcode = 'P0001';
  end if;

  insert into public.estructura_organigrama (iglesia_id, creado_por)
  values (p_iglesia_id, (select auth.uid()))
  on conflict (iglesia_id) do nothing;

  perform private.fn_estructura_exigir_otp(p_iglesia_id, p_otp);

  insert into public.red (
    iglesia_id, nombre, color, activo, creado_por, actualizado_por
  ) values (
    p_iglesia_id, v_nombre, v_color, true,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_red_id;

  if p_lider_persona_id is not null then
    perform private.fn_estructura_asignar_cargo_red(
      v_red_id, p_lider_persona_id, 'LIDER_RED'
    );
  end if;

  if p_supervisor_persona_id is not null then
    perform private.fn_estructura_asignar_cargo_red(
      v_red_id, p_supervisor_persona_id, 'SUBLIDER_RED'
    );
  end if;

  return v_red_id;
end;
$$;

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
$$;

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

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  return private.fn_estructura_asignar_cargo_red(
    p_red_id, p_persona_id, p_codigo
  );
end;
$$;

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

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
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

-- Índices de los accesos del constructor y de todas las FK nuevas creadas en
-- los cimientos. Son parciales cuando el dominio usa baja lógica.
create index if not exists idx_red_iglesia_vigente
  on public.red (iglesia_id, activo)
  where fecha_eliminacion is null;

create index if not exists idx_red_cargo_vigente_red_cargo
  on public.red_cargo (red_id, cargo_id)
  where fecha_fin is null and fecha_eliminacion is null;

create index if not exists idx_estructura_organigrama_creado_por
  on public.estructura_organigrama (creado_por)
  where creado_por is not null;

create index if not exists idx_estructura_organigrama_actualizado_por
  on public.estructura_organigrama (actualizado_por)
  where actualizado_por is not null;

create index if not exists idx_estructura_nodo_creado_por
  on public.estructura_nodo_posicion (creado_por)
  where creado_por is not null;

create index if not exists idx_estructura_nodo_actualizado_por
  on public.estructura_nodo_posicion (actualizado_por)
  where actualizado_por is not null;

create index if not exists idx_estructura_nodo_eliminado_por
  on public.estructura_nodo_posicion (eliminado_por)
  where eliminado_por is not null;

create index if not exists idx_estructura_otp_auditoria_usuario
  on public.estructura_otp_auditoria (usuario_id);

revoke all on function public.fn_estructura_configurar_otp(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.fn_estructura_crear_red(uuid, text, text, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fn_estructura_actualizar_red(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.fn_estructura_asignar_cargo_red(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.fn_estructura_quitar_cargo_red(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.fn_estructura_configurar_otp(uuid, boolean, text)
  to authenticated;
grant execute on function public.fn_estructura_crear_red(uuid, text, text, uuid, uuid, text)
  to authenticated;
grant execute on function public.fn_estructura_actualizar_red(uuid, text, text, text)
  to authenticated;
grant execute on function public.fn_estructura_asignar_cargo_red(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.fn_estructura_quitar_cargo_red(uuid, text, text)
  to authenticated;

commit;
