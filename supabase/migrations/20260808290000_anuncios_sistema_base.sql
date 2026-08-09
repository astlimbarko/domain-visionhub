-- VisionHub -- KAN-101: Sistema de anuncios por roles y redes.
-- Base completa: T1 (modelo de datos), T2 (permisos/RLS), T3 (gestion/CRUD),
-- T4 (selector de destinatarios), T7 (registro de visualizacion).
--
-- Reglas de creacion (de la descripcion del epico, sin inventar nada nuevo):
--   * Supervisor de la Vision en Accion (usuario_rol.rol = 'SUPERVISOR_VISION_ACCION',
--     o SUPER_ADMIN): anuncios de TODA la iglesia (red_id NULL), destinatarios
--     posibles Lider de Red / Supervisor de Red / Lider de CdP / Sublider de CdP /
--     Miembros (futuro).
--   * Lider de Red (cargo LIDER_RED en red_cargo): solo para SU Red, destinatarios
--     Supervisor de Red / Lider de CdP / Sublider de CdP / Miembros (futuro).
--   * Supervisor de Red (cargo SUBLIDER_RED -- "Supervisor de la Red en Accion",
--     ver harness 90_supervisor_red_en_accion.sql, mismo cargo, paridad completa
--     con Lider de Red): solo para SU Red, destinatarios Lider de Red / Lider de
--     CdP / Sublider de CdP / Miembros (futuro).
--   * Lider de CdP, Sublider de CdP y Miembro NO pueden crear anuncios.
--
-- Decision del equipo (Matias, 2026-08-08, ver comentario en KAN-101): el rol
-- PASTOR queda deliberadamente FUERA de la capacidad de crear anuncios de
-- iglesia aunque fn_es_operativo_en() lo trate igual que a Supervisor en el
-- resto del sistema -- el epico es textual ("Supervisor de la Vision en
-- Accion"), asi que se escribio un chequeo propio (private.fn_anuncio_es_supervisor)
-- en vez de reusar fn_es_operativo_en. SUPER_ADMIN si mantiene el bypass
-- universal ya establecido en todo el resto del sistema.
--
-- T5 (modal al ingresar) y T6 (cola de pendientes) quedan con su LOGICA DE
-- DATOS ya resuelta aca (fn_anuncios_pendientes, fn_anuncio_marcar_mostrado,
-- fn_anuncio_cerrar) pero el enganche real en PrivateLayout.tsx queda
-- pendiente a proposito -- ver comentario en KAN-106/KAN-107.

begin;

create schema if not exists private;

-- ============================================================
-- T1: Modelo de datos
-- ============================================================

create table if not exists public.anuncio (
  id                    uuid primary key default gen_random_uuid(),
  iglesia_id            uuid not null references public.iglesia(id),
  red_id                uuid references public.red(id),
  autor_persona_id      uuid not null references public.persona(id),
  titulo                varchar(150) not null,
  mensaje               text,
  imagen_path           text not null,
  imagen_orientacion    varchar(10) not null,
  roles_destinatarios   text[] not null,
  activo                boolean not null default true,
  prioridad             smallint not null default 0,
  fecha_publicacion     timestamptz not null default now(),
  fecha_fin             timestamptz,
  fecha_creacion        timestamptz not null default now(),
  fecha_actualizacion   timestamptz,
  creado_por            uuid references auth.users(id),
  actualizado_por       uuid references auth.users(id),
  fecha_eliminacion     timestamptz,
  eliminado_por         uuid references auth.users(id),
  constraint chk_anuncio_orientacion check (imagen_orientacion in ('CUADRADA', 'VERTICAL')),
  constraint chk_anuncio_roles check (
    cardinality(roles_destinatarios) > 0
    and roles_destinatarios <@ array['LIDER_RED', 'SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO']::text[]
  ),
  constraint chk_anuncio_fechas check (fecha_fin is null or fecha_fin >= fecha_publicacion)
);

drop trigger if exists trg_auditoria_anuncio on public.anuncio;
create trigger trg_auditoria_anuncio
  before insert or update on public.anuncio
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_anuncio on public.anuncio;
create trigger trg_no_delete_anuncio
  before delete on public.anuncio
  for each row execute function public.fn_bloquear_delete();

create index if not exists idx_anuncio_iglesia_activo
  on public.anuncio (iglesia_id)
  where activo and fecha_eliminacion is null;

create index if not exists idx_anuncio_red
  on public.anuncio (red_id)
  where fecha_eliminacion is null;

create table if not exists public.anuncio_visto (
  id                    uuid primary key default gen_random_uuid(),
  anuncio_id            uuid not null references public.anuncio(id),
  persona_id            uuid not null references public.persona(id),
  estado                varchar(10) not null default 'MOSTRADO',
  fecha_mostrado        timestamptz not null default now(),
  fecha_cierre          timestamptz,
  fecha_creacion        timestamptz not null default now(),
  fecha_actualizacion   timestamptz,
  creado_por            uuid references auth.users(id),
  actualizado_por       uuid references auth.users(id),
  fecha_eliminacion     timestamptz,
  eliminado_por         uuid references auth.users(id),
  constraint chk_anuncio_visto_estado check (estado in ('MOSTRADO', 'CERRADO'))
);

drop trigger if exists trg_auditoria_anuncio_visto on public.anuncio_visto;
create trigger trg_auditoria_anuncio_visto
  before insert or update on public.anuncio_visto
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_anuncio_visto on public.anuncio_visto;
create trigger trg_no_delete_anuncio_visto
  before delete on public.anuncio_visto
  for each row execute function public.fn_bloquear_delete();

create unique index if not exists uq_anuncio_visto_persona
  on public.anuncio_visto (anuncio_id, persona_id)
  where fecha_eliminacion is null;

-- ============================================================
-- T2: Permisos (helpers privados)
-- ============================================================

-- Supervisor de la Vision en Accion (o SUPER_ADMIN) para una iglesia puntual.
-- Deliberadamente NO usa fn_es_operativo_en (que tambien incluye a PASTOR) --
-- ver nota de decision al inicio del archivo.
create or replace function private.fn_anuncio_es_supervisor(p_iglesia_id uuid)
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
      or exists (
        select 1 from public.usuario_rol ur
        where ur.usuario_id = (select auth.uid())
          and ur.iglesia_id = p_iglesia_id
          and ur.rol = 'SUPERVISOR_VISION_ACCION'
          and ur.fecha_eliminacion is null
      )
    );
$$;

revoke all on function private.fn_anuncio_es_supervisor(uuid)
  from public, anon, authenticated;

-- Puede gestionar (crear/editar/activar/eliminar) un anuncio con este alcance:
-- p_red_id NULL = anuncio de toda la iglesia (solo Supervisor/Super Admin);
-- p_red_id puntual = esa Red (Supervisor/Super Admin, o Lider/Supervisor de
-- esa Red via fn_es_lider_de_red -- que ya reconoce LIDER_RED y SUBLIDER_RED).
create or replace function private.fn_anuncio_puede_crear(p_iglesia_id uuid, p_red_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when p_red_id is null then private.fn_anuncio_es_supervisor(p_iglesia_id)
      else private.fn_anuncio_es_supervisor(p_iglesia_id) or public.fn_es_lider_de_red(p_red_id)
    end;
$$;

revoke all on function private.fn_anuncio_puede_crear(uuid, uuid)
  from public, anon, authenticated;

-- Es destinatario del anuncio p_anuncio_id: activo, dentro de la ventana de
-- publicacion, en una iglesia accesible, y con un cargo (LIDER_RED/SUBLIDER_RED
-- a nivel Red, o LIDER_CDP/SUBLIDER_CDP dentro de esa Red o de toda la
-- iglesia si el anuncio es global) que este en roles_destinatarios.
create or replace function private.fn_anuncio_es_destinatario(p_anuncio_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_red_id uuid;
  v_iglesia_id uuid;
  v_roles text[];
  v_activo boolean;
  v_pub timestamptz;
  v_fin timestamptz;
  v_mis_roles text[];
begin
  select red_id, iglesia_id, roles_destinatarios, activo, fecha_publicacion, fecha_fin
  into v_red_id, v_iglesia_id, v_roles, v_activo, v_pub, v_fin
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null;

  if v_iglesia_id is null or not v_activo then
    return false;
  end if;

  if v_pub > now() or (v_fin is not null and v_fin < now()) then
    return false;
  end if;

  if v_iglesia_id not in (select public.fn_mis_iglesias()) then
    return false;
  end if;

  if v_red_id is null then
    v_mis_roles := array(
      select distinct c.codigo
      from public.red_cargo rc
      join public.cargo c on c.id = rc.cargo_id
      join public.red r on r.id = rc.red_id
      where r.iglesia_id = v_iglesia_id and rc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        and rc.fecha_fin is null and rc.fecha_eliminacion is null
      union
      select distinct c.codigo
      from public.casa_de_paz_cargo cc
      join public.cargo c on c.id = cc.cargo_id
      join public.casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
      where cdp.iglesia_id = v_iglesia_id and cc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_CDP', 'SUBLIDER_CDP')
        and cc.fecha_fin is null and cc.fecha_eliminacion is null
    );
  else
    v_mis_roles := array(
      select distinct c.codigo
      from public.red_cargo rc
      join public.cargo c on c.id = rc.cargo_id
      where rc.red_id = v_red_id and rc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        and rc.fecha_fin is null and rc.fecha_eliminacion is null
      union
      select distinct c.codigo
      from public.casa_de_paz_cargo cc
      join public.cargo c on c.id = cc.cargo_id
      join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cc.casa_de_paz_id
      where cdr.red_id = v_red_id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        and cc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_CDP', 'SUBLIDER_CDP')
        and cc.fecha_fin is null and cc.fecha_eliminacion is null
    );
  end if;

  return v_mis_roles && v_roles;
end;
$$;

revoke all on function private.fn_anuncio_es_destinatario(uuid)
  from public, anon, authenticated;

-- ============================================================
-- T2: RLS
-- ============================================================

alter table public.anuncio enable row level security;
revoke all on table public.anuncio from public, anon, authenticated;
grant select, insert, update on table public.anuncio to authenticated;

drop policy if exists pol_anuncio_select on public.anuncio;
create policy pol_anuncio_select
  on public.anuncio
  for select
  to authenticated
  using (
    fecha_eliminacion is null
    and (
      private.fn_anuncio_puede_crear(iglesia_id, red_id)
      or private.fn_anuncio_es_destinatario(id)
    )
  );

drop policy if exists pol_anuncio_insert on public.anuncio;
create policy pol_anuncio_insert
  on public.anuncio
  for insert
  to authenticated
  with check (
    private.fn_anuncio_puede_crear(iglesia_id, red_id)
    and autor_persona_id = public.fn_mi_persona_id()
  );

drop policy if exists pol_anuncio_update on public.anuncio;
create policy pol_anuncio_update
  on public.anuncio
  for update
  to authenticated
  using (private.fn_anuncio_puede_crear(iglesia_id, red_id))
  with check (private.fn_anuncio_puede_crear(iglesia_id, red_id));

alter table public.anuncio_visto enable row level security;
revoke all on table public.anuncio_visto from public, anon, authenticated;
grant select, insert, update on table public.anuncio_visto to authenticated;

drop policy if exists pol_anuncio_visto_select on public.anuncio_visto;
create policy pol_anuncio_visto_select
  on public.anuncio_visto
  for select
  to authenticated
  using (persona_id = public.fn_mi_persona_id());

drop policy if exists pol_anuncio_visto_insert on public.anuncio_visto;
create policy pol_anuncio_visto_insert
  on public.anuncio_visto
  for insert
  to authenticated
  with check (persona_id = public.fn_mi_persona_id());

drop policy if exists pol_anuncio_visto_update on public.anuncio_visto;
create policy pol_anuncio_visto_update
  on public.anuncio_visto
  for update
  to authenticated
  using (persona_id = public.fn_mi_persona_id())
  with check (persona_id = public.fn_mi_persona_id());

-- ============================================================
-- T4: selector de destinatarios + capacidad del creador
-- ============================================================

create or replace function public.fn_anuncio_mi_capacidad(p_iglesia_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_iglesia_id not in (select public.fn_mis_iglesias()) then
    raise exception 'IGLESIA_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'puede_iglesia', private.fn_anuncio_es_supervisor(p_iglesia_id),
    'redes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'nombre', x.nombre, 'color', x.color, 'es_sublider', x.es_sublider
      ) order by x.nombre), '[]'::jsonb)
      from (
        select distinct on (r.id) r.id, r.nombre, r.color, (c.codigo = 'SUBLIDER_RED') as es_sublider
        from public.red r
        join public.red_cargo rc on rc.red_id = r.id
        join public.cargo c on c.id = rc.cargo_id and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        where r.iglesia_id = p_iglesia_id and rc.persona_id = public.fn_mi_persona_id()
          and rc.fecha_fin is null and rc.fecha_eliminacion is null
        order by r.id, (c.codigo = 'LIDER_RED') desc
      ) x
    )
  );
end;
$$;

revoke all on function public.fn_anuncio_mi_capacidad(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_mi_capacidad(uuid) to authenticated;

-- Roles disponibles como destinatarios segun quien crea (T4). Levanta
-- SIN_PERMISO si el llamante no puede crear en ese alcance -- el frontend la
-- usa tanto para poblar el selector como para validar antes de mostrar el
-- formulario.
create or replace function public.fn_anuncio_roles_disponibles(p_iglesia_id uuid, p_red_id uuid default null)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_es_sublider boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_red_id is null then
    if not private.fn_anuncio_es_supervisor(p_iglesia_id) then
      raise exception 'SIN_PERMISO' using errcode = 'P0001';
    end if;
    return array['LIDER_RED', 'SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
  end if;

  if private.fn_anuncio_es_supervisor(p_iglesia_id) then
    return array['LIDER_RED', 'SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
  end if;

  select (c.codigo = 'SUBLIDER_RED')
  into v_es_sublider
  from public.red_cargo rc
  join public.cargo c on c.id = rc.cargo_id
  where rc.red_id = p_red_id and rc.persona_id = public.fn_mi_persona_id()
    and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
    and rc.fecha_fin is null and rc.fecha_eliminacion is null
  order by (c.codigo = 'LIDER_RED') desc
  limit 1;

  if v_es_sublider is null then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if v_es_sublider then
    return array['LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
  else
    return array['SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
  end if;
end;
$$;

revoke all on function public.fn_anuncio_roles_disponibles(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_roles_disponibles(uuid, uuid) to authenticated;

-- ============================================================
-- T3: gestion de anuncios (CRUD via RPC)
-- ============================================================

create or replace function public.fn_anuncio_crear(
  p_iglesia_id uuid,
  p_red_id uuid,
  p_titulo text,
  p_mensaje text,
  p_imagen_path text,
  p_imagen_orientacion text,
  p_roles_destinatarios text[],
  p_fecha_publicacion timestamptz default now(),
  p_fecha_fin timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona_id uuid;
  v_permitidos text[];
  v_anuncio_id uuid;
  v_titulo text := btrim(p_titulo);
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_crear(p_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if v_titulo is null or char_length(v_titulo) < 2 or char_length(v_titulo) > 150 then
    raise exception 'ANUNCIO_TITULO_INVALIDO' using errcode = 'P0001';
  end if;

  if p_imagen_orientacion not in ('CUADRADA', 'VERTICAL') then
    raise exception 'ANUNCIO_ORIENTACION_INVALIDA' using errcode = 'P0001';
  end if;

  if p_imagen_path is null or btrim(p_imagen_path) = '' then
    raise exception 'ANUNCIO_IMAGEN_REQUERIDA' using errcode = 'P0001';
  end if;

  if p_roles_destinatarios is null or cardinality(p_roles_destinatarios) = 0 then
    raise exception 'ANUNCIO_DESTINATARIOS_REQUERIDOS' using errcode = 'P0001';
  end if;

  v_permitidos := public.fn_anuncio_roles_disponibles(p_iglesia_id, p_red_id);
  if not (p_roles_destinatarios <@ v_permitidos) then
    raise exception 'ANUNCIO_DESTINATARIOS_NO_PERMITIDOS' using errcode = 'P0001';
  end if;

  if p_fecha_fin is not null and p_fecha_fin < coalesce(p_fecha_publicacion, now()) then
    raise exception 'ANUNCIO_FECHAS_INVALIDAS' using errcode = 'P0001';
  end if;

  v_persona_id := public.fn_mi_persona_id();
  if v_persona_id is null then
    raise exception 'ANUNCIO_SIN_PERSONA' using errcode = 'P0001';
  end if;

  insert into public.anuncio (
    iglesia_id, red_id, autor_persona_id, titulo, mensaje, imagen_path,
    imagen_orientacion, roles_destinatarios, fecha_publicacion, fecha_fin,
    creado_por, actualizado_por
  ) values (
    p_iglesia_id, p_red_id, v_persona_id, v_titulo, nullif(btrim(p_mensaje), ''), p_imagen_path,
    p_imagen_orientacion, p_roles_destinatarios, coalesce(p_fecha_publicacion, now()), p_fecha_fin,
    (select auth.uid()), (select auth.uid())
  )
  returning id into v_anuncio_id;

  return v_anuncio_id;
end;
$$;

revoke all on function public.fn_anuncio_crear(uuid, uuid, text, text, text, text, text[], timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_crear(uuid, uuid, text, text, text, text, text[], timestamptz, timestamptz)
  to authenticated;

create or replace function public.fn_anuncio_actualizar(
  p_anuncio_id uuid,
  p_titulo text,
  p_mensaje text,
  p_imagen_path text,
  p_imagen_orientacion text,
  p_roles_destinatarios text[],
  p_fecha_publicacion timestamptz,
  p_fecha_fin timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_red_id uuid;
  v_permitidos text[];
  v_titulo text := btrim(p_titulo);
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select iglesia_id, red_id into v_iglesia_id, v_red_id
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_crear(v_iglesia_id, v_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if v_titulo is null or char_length(v_titulo) < 2 or char_length(v_titulo) > 150 then
    raise exception 'ANUNCIO_TITULO_INVALIDO' using errcode = 'P0001';
  end if;

  if p_imagen_orientacion not in ('CUADRADA', 'VERTICAL') then
    raise exception 'ANUNCIO_ORIENTACION_INVALIDA' using errcode = 'P0001';
  end if;

  if p_imagen_path is null or btrim(p_imagen_path) = '' then
    raise exception 'ANUNCIO_IMAGEN_REQUERIDA' using errcode = 'P0001';
  end if;

  if p_roles_destinatarios is null or cardinality(p_roles_destinatarios) = 0 then
    raise exception 'ANUNCIO_DESTINATARIOS_REQUERIDOS' using errcode = 'P0001';
  end if;

  v_permitidos := public.fn_anuncio_roles_disponibles(v_iglesia_id, v_red_id);
  if not (p_roles_destinatarios <@ v_permitidos) then
    raise exception 'ANUNCIO_DESTINATARIOS_NO_PERMITIDOS' using errcode = 'P0001';
  end if;

  if p_fecha_fin is not null and p_fecha_fin < coalesce(p_fecha_publicacion, now()) then
    raise exception 'ANUNCIO_FECHAS_INVALIDAS' using errcode = 'P0001';
  end if;

  update public.anuncio set
    titulo = v_titulo,
    mensaje = nullif(btrim(p_mensaje), ''),
    imagen_path = p_imagen_path,
    imagen_orientacion = p_imagen_orientacion,
    roles_destinatarios = p_roles_destinatarios,
    fecha_publicacion = coalesce(p_fecha_publicacion, fecha_publicacion),
    fecha_fin = p_fecha_fin,
    actualizado_por = (select auth.uid())
  where id = p_anuncio_id;

  return p_anuncio_id;
end;
$$;

revoke all on function public.fn_anuncio_actualizar(uuid, text, text, text, text, text[], timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_actualizar(uuid, text, text, text, text, text[], timestamptz, timestamptz)
  to authenticated;

create or replace function public.fn_anuncio_toggle_activo(p_anuncio_id uuid, p_activo boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_red_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select iglesia_id, red_id into v_iglesia_id, v_red_id
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_crear(v_iglesia_id, v_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  update public.anuncio
  set activo = p_activo, actualizado_por = (select auth.uid())
  where id = p_anuncio_id;

  return p_activo;
end;
$$;

revoke all on function public.fn_anuncio_toggle_activo(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_toggle_activo(uuid, boolean) to authenticated;

-- Baja logica: igual patron que fn_eliminar_cdp -- el trigger bloquea el
-- DELETE fisico, esto marca fecha_eliminacion/eliminado_por.
create or replace function public.fn_anuncio_eliminar(p_anuncio_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_red_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select iglesia_id, red_id into v_iglesia_id, v_red_id
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_crear(v_iglesia_id, v_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  update public.anuncio
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where id = p_anuncio_id;

  return true;
end;
$$;

revoke all on function public.fn_anuncio_eliminar(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_eliminar(uuid) to authenticated;

-- Listado para la pantalla de gestion (T3): incluye inactivos/vencidos --
-- fn_anuncio_puede_crear ya acota el scope (propia Red o iglesia completa
-- para Supervisor/Super Admin).
create or replace function public.fn_mis_anuncios_gestion(p_iglesia_id uuid, p_red_id uuid default null)
returns table (
  id uuid,
  red_id uuid,
  red_nombre text,
  titulo text,
  mensaje text,
  imagen_path text,
  imagen_orientacion text,
  roles_destinatarios text[],
  activo boolean,
  prioridad smallint,
  fecha_publicacion timestamptz,
  fecha_fin timestamptz,
  autor_nombre text,
  fecha_creacion timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_iglesia_id not in (select public.fn_mis_iglesias()) then
    raise exception 'IGLESIA_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return query
  select
    a.id, a.red_id, r.nombre::text, a.titulo::text, a.mensaje, a.imagen_path,
    a.imagen_orientacion::text, a.roles_destinatarios, a.activo, a.prioridad,
    a.fecha_publicacion, a.fecha_fin, public.fn_nombre_completo(p), a.fecha_creacion
  from public.anuncio a
  left join public.red r on r.id = a.red_id
  left join public.persona p on p.id = a.autor_persona_id
  where a.iglesia_id = p_iglesia_id
    and a.fecha_eliminacion is null
    and (p_red_id is null or a.red_id = p_red_id)
    and private.fn_anuncio_puede_crear(a.iglesia_id, a.red_id)
  order by a.fecha_creacion desc;
end;
$$;

revoke all on function public.fn_mis_anuncios_gestion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_mis_anuncios_gestion(uuid, uuid) to authenticated;

-- ============================================================
-- T7: registro de visualizacion (tambien la base de datos de T5/T6)
-- ============================================================

-- Cola de anuncios pendientes del usuario actual (T5/T6): activos, dentro de
-- ventana, donde es destinatario, y sin un registro CERRADO todavia. Orden
-- por prioridad desc y luego fecha de publicacion asc -- el mas simple y
-- predecible posible, sin expiracion mas alla de fecha_fin (no la pidio el
-- ticket). Es la funcion detras del hook reusable useAnunciosPendientes().
create or replace function public.fn_anuncios_pendientes()
returns table (
  id uuid,
  iglesia_id uuid,
  red_id uuid,
  titulo text,
  mensaje text,
  imagen_path text,
  imagen_orientacion text,
  prioridad smallint,
  fecha_publicacion timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  return query
  select a.id, a.iglesia_id, a.red_id, a.titulo::text, a.mensaje, a.imagen_path,
         a.imagen_orientacion::text, a.prioridad, a.fecha_publicacion
  from public.anuncio a
  where a.fecha_eliminacion is null
    and a.activo
    and a.fecha_publicacion <= now()
    and (a.fecha_fin is null or a.fecha_fin >= now())
    and a.iglesia_id in (select public.fn_mis_iglesias())
    and private.fn_anuncio_es_destinatario(a.id)
    and not exists (
      select 1 from public.anuncio_visto v
      where v.anuncio_id = a.id and v.persona_id = public.fn_mi_persona_id()
        and v.estado = 'CERRADO' and v.fecha_eliminacion is null
    )
  order by a.prioridad desc, a.fecha_publicacion asc;
end;
$$;

revoke all on function public.fn_anuncios_pendientes()
  from public, anon, authenticated;
grant execute on function public.fn_anuncios_pendientes() to authenticated;

create or replace function public.fn_anuncio_marcar_mostrado(p_anuncio_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_es_destinatario(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  v_persona_id := public.fn_mi_persona_id();

  insert into public.anuncio_visto (anuncio_id, persona_id, estado, fecha_mostrado, creado_por, actualizado_por)
  values (p_anuncio_id, v_persona_id, 'MOSTRADO', now(), (select auth.uid()), (select auth.uid()))
  on conflict (anuncio_id, persona_id) where fecha_eliminacion is null
  do nothing;
end;
$$;

revoke all on function public.fn_anuncio_marcar_mostrado(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_marcar_mostrado(uuid) to authenticated;

-- Cierra el anuncio para el usuario actual (click en X). Un anuncio cerrado
-- no vuelve a aparecerle -- fn_anuncios_pendientes ya lo excluye.
create or replace function public.fn_anuncio_cerrar(p_anuncio_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  v_persona_id := public.fn_mi_persona_id();
  if v_persona_id is null then
    raise exception 'ANUNCIO_SIN_PERSONA' using errcode = 'P0001';
  end if;

  insert into public.anuncio_visto (
    anuncio_id, persona_id, estado, fecha_mostrado, fecha_cierre, creado_por, actualizado_por
  ) values (
    p_anuncio_id, v_persona_id, 'CERRADO', now(), now(), (select auth.uid()), (select auth.uid())
  )
  on conflict (anuncio_id, persona_id) where fecha_eliminacion is null
  do update set estado = 'CERRADO', fecha_cierre = now(), actualizado_por = (select auth.uid());
end;
$$;

revoke all on function public.fn_anuncio_cerrar(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_anuncio_cerrar(uuid) to authenticated;

-- ============================================================
-- Storage: bucket privado + politicas (decision de producto, ver comentario
-- en KAN-101: bucket nuevo "anuncios", privado, 5MB max, jpeg/png/webp;
-- convencion de path {iglesia_id}/{uuid}.{ext} para poder resolver permisos
-- por carpeta sin depender de que la fila `anuncio` ya exista al subir).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anuncios', 'anuncios', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists pol_storage_anuncios_select on storage.objects;
create policy pol_storage_anuncios_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'anuncios'
    and exists (
      select 1 from public.anuncio a
      where a.imagen_path = storage.objects.name
        and a.fecha_eliminacion is null
        and (private.fn_anuncio_puede_crear(a.iglesia_id, a.red_id) or private.fn_anuncio_es_destinatario(a.id))
    )
  );

drop policy if exists pol_storage_anuncios_insert on storage.objects;
create policy pol_storage_anuncios_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'anuncios'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      private.fn_anuncio_es_supervisor(((storage.foldername(name))[1])::uuid)
      or public.fn_es_lider_de_red_en_iglesia(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists pol_storage_anuncios_delete on storage.objects;
create policy pol_storage_anuncios_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'anuncios'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      private.fn_anuncio_es_supervisor(((storage.foldername(name))[1])::uuid)
      or public.fn_es_lider_de_red_en_iglesia(((storage.foldername(name))[1])::uuid)
    )
  );

commit;
