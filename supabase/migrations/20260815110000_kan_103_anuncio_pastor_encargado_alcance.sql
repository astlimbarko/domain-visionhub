-- VisionHub -- T2 (KAN-103), reescritura de permisos/RLS/CRUD de anuncios
-- sobre el modelo ampliado de T1 (20260815100000). Cambios decididos por el
-- owner el 2026-08-15 (ver anuncios.txt SS40):
--
-- 1) Paridad Pastor: PASTOR pasa a tener la misma capacidad que Supervisor
--    de la Vision en Accion para gestionar anuncios de iglesia -- corrige la
--    decision original de Matias (KAN-101, 2026-08-08) de dejarlo afuera a
--    proposito. El Supervisor sigue siendo "el brazo operativo" del Pastor
--    (mismo patron ya establecido en KAN-78/86, paridad_pastor_supervisor).
-- 2) Nuevo cargo delegado ENCARGADO_ANUNCIOS: Supervisor/Pastor puede
--    designar 0..N personas (sin importar su rol organizacional) para
--    gestionar anuncios en su nombre. Tabla propia (no departamento_cargo --
--    ese patron es de un solo titular por departamento y aca puede haber
--    varios a la vez). Si no hay nadie designado, Supervisor/Pastor
--    conservan la capacidad completa (default ya existente, sin cambios).
-- 3) Alcance multiple: toda la logica de permisos/CRUD/RLS que dependia de
--    la columna unica anuncio.red_id pasa a usar anuncio.alcance_tipo +
--    anuncio_alcance_red/anuncio_alcance_cdp (T1). anuncio.red_id queda sin
--    usar desde esta migracion en adelante (dato historico, no se borra).
-- 4) Borrador real: fn_anuncio_crear/actualizar ganan p_es_borrador; nueva
--    fn_anuncio_publicar. Un borrador nunca es destinatario-visible.
--
-- Nota de alcance de esta migracion: cubre permisos/RLS/storage (T2) y el
-- CRUD que dependia de ellos (T3), asi como el selector de capacidad (T4)
-- -- las 3 tareas comparten el mismo modelo y no se pueden separar sin dejar
-- funciones a medio migrar. El frontend (formulario/paginas) se actualiza en
-- un commit aparte para poder probarlo de punta a punta.

begin;

-- ============================================================
-- Paridad Pastor + cargo delegado Encargado de Anuncios
-- ============================================================

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
      or public.fn_es_pastor_en(p_iglesia_id)
      or exists (
        select 1 from public.usuario_rol ur
        where ur.usuario_id = (select auth.uid())
          and ur.iglesia_id = p_iglesia_id
          and ur.rol = 'SUPERVISOR_VISION_ACCION'
          and ur.fecha_eliminacion is null
      )
    );
$$;

create table if not exists public.anuncio_encargado (
  id                  uuid primary key default gen_random_uuid(),
  iglesia_id          uuid not null references public.iglesia(id),
  persona_id          uuid not null references public.persona(id),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por          uuid references auth.users(id),
  actualizado_por     uuid references auth.users(id),
  fecha_fin           date,
  fecha_eliminacion   timestamptz,
  eliminado_por       uuid references auth.users(id)
);

drop trigger if exists trg_auditoria_anuncio_encargado on public.anuncio_encargado;
create trigger trg_auditoria_anuncio_encargado
  before insert or update on public.anuncio_encargado
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_anuncio_encargado on public.anuncio_encargado;
create trigger trg_no_delete_anuncio_encargado
  before delete on public.anuncio_encargado
  for each row execute function public.fn_bloquear_delete();

create unique index if not exists uq_anuncio_encargado_vigente
  on public.anuncio_encargado (iglesia_id, persona_id)
  where fecha_fin is null and fecha_eliminacion is null;

-- Sin policies: se llega solo via las RPC de abajo (mismo patron que
-- auditoria_email_envios, KAN-172).
alter table public.anuncio_encargado enable row level security;
revoke all on table public.anuncio_encargado from public, anon, authenticated;

create or replace function private.fn_anuncio_es_encargado(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.anuncio_encargado ae
    where ae.iglesia_id = p_iglesia_id
      and ae.persona_id = public.fn_mi_persona_id()
      and ae.fecha_fin is null
      and ae.fecha_eliminacion is null
  );
$$;

revoke all on function private.fn_anuncio_es_encargado(uuid) from public, anon, authenticated;

-- Umbral de "puede gestionar anuncios de toda la iglesia": Supervisor,
-- Pastor, Super Admin, o encargado delegado -- reemplaza el uso directo de
-- fn_anuncio_es_supervisor en el resto del modulo (esa funcion queda solo
-- para distinguir el rol literal, ej. quien puede designar encargados).
create or replace function private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.fn_anuncio_es_supervisor(p_iglesia_id) or private.fn_anuncio_es_encargado(p_iglesia_id);
$$;

revoke all on function private.fn_anuncio_puede_gestionar_iglesia(uuid) from public, anon, authenticated;

create or replace function public.fn_anuncio_asignar_encargado(p_iglesia_id uuid, p_persona_id uuid, p_otp text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_es_supervisor(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_verificar_otp(p_otp) then
    raise exception 'OTP_INVALIDO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.persona p
    where p.id = p_persona_id and p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null
  ) then
    raise exception 'PERSONA_FUERA_DE_IGLESIA' using errcode = 'P0001';
  end if;

  update public.anuncio_encargado
  set fecha_fin = current_date, actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id and persona_id = p_persona_id
    and fecha_fin is null and fecha_eliminacion is null;

  insert into public.anuncio_encargado (iglesia_id, persona_id, creado_por, actualizado_por)
  values (p_iglesia_id, p_persona_id, (select auth.uid()), (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.fn_anuncio_asignar_encargado(uuid, uuid, text) from public, anon;
grant execute on function public.fn_anuncio_asignar_encargado(uuid, uuid, text) to authenticated;

create or replace function public.fn_anuncio_quitar_encargado(p_iglesia_id uuid, p_persona_id uuid, p_otp text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_es_supervisor(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if not public.fn_verificar_otp(p_otp) then
    raise exception 'OTP_INVALIDO' using errcode = 'P0001';
  end if;

  update public.anuncio_encargado
  set fecha_fin = current_date, actualizado_por = (select auth.uid())
  where iglesia_id = p_iglesia_id and persona_id = p_persona_id
    and fecha_fin is null and fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_anuncio_quitar_encargado(uuid, uuid, text) from public, anon;
grant execute on function public.fn_anuncio_quitar_encargado(uuid, uuid, text) to authenticated;

create or replace function public.fn_anuncio_listar_encargados(p_iglesia_id uuid)
returns table (id uuid, persona_id uuid, nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select ae.id, ae.persona_id, public.fn_nombre_completo(p)
  from public.anuncio_encargado ae
  join public.persona p on p.id = ae.persona_id
  where ae.iglesia_id = p_iglesia_id and ae.fecha_fin is null and ae.fecha_eliminacion is null
  order by 3;
end;
$$;

revoke all on function public.fn_anuncio_listar_encargados(uuid) from public, anon;
grant execute on function public.fn_anuncio_listar_encargados(uuid) to authenticated;

-- ============================================================
-- Alcance multiple: validadores de creacion y de fila existente
-- ============================================================

-- Valida un alcance propuesto (creacion/edicion) antes de insertar filas en
-- anuncio_alcance_red/cdp -- confirma ademas que cada red/CdP pertenece de
-- verdad a p_iglesia_id (mismo hardening de KAN-135/hardening_privilegios
-- aplicado ahora a arrays, no solo a un id suelto).
create or replace function private.fn_anuncio_puede_administrar_alcance(
  p_iglesia_id uuid,
  p_alcance_tipo text,
  p_red_ids uuid[],
  p_cdp_ids uuid[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_alcance_tipo = 'IGLESIA' then
    return private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id);
  end if;

  if p_alcance_tipo = 'RED' then
    if p_red_ids is null or cardinality(p_red_ids) = 0 then
      return false;
    end if;
    if exists (
      select 1 from unnest(p_red_ids) as rid
      where not exists (select 1 from public.red r where r.id = rid and r.iglesia_id = p_iglesia_id and r.fecha_eliminacion is null)
    ) then
      return false;
    end if;
    return private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id)
      or not exists (select 1 from unnest(p_red_ids) as rid where not public.fn_es_lider_de_red(rid));
  end if;

  if p_alcance_tipo = 'CDP' then
    if p_cdp_ids is null or cardinality(p_cdp_ids) = 0 then
      return false;
    end if;
    if exists (
      select 1 from unnest(p_cdp_ids) as cid
      where not exists (select 1 from public.casa_de_paz c where c.id = cid and c.iglesia_id = p_iglesia_id and c.fecha_eliminacion is null)
    ) then
      return false;
    end if;
    return private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id)
      or not exists (
        select 1 from unnest(p_cdp_ids) as cid
        left join public.casa_de_paz_red cdr
          on cdr.casa_de_paz_id = cid and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        where cdr.red_id is null or not public.fn_es_lider_de_red(cdr.red_id)
      );
  end if;

  return false;
end;
$$;

revoke all on function private.fn_anuncio_puede_administrar_alcance(uuid, text, uuid[], uuid[])
  from public, anon, authenticated;

-- Puede gestionar (editar/activar/eliminar/publicar) un anuncio YA
-- existente, mirando su alcance_tipo actual + las filas de union vigentes
-- (reemplaza al viejo private.fn_anuncio_puede_crear(iglesia_id, red_id)).
create or replace function private.fn_anuncio_fila_administrable(p_anuncio_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_alcance_tipo text;
begin
  select iglesia_id, alcance_tipo into v_iglesia_id, v_alcance_tipo
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null;

  if v_iglesia_id is null then
    return false;
  end if;

  if private.fn_anuncio_puede_gestionar_iglesia(v_iglesia_id) then
    return true;
  end if;

  if v_alcance_tipo = 'RED' then
    return exists (select 1 from public.anuncio_alcance_red ar where ar.anuncio_id = p_anuncio_id and ar.fecha_eliminacion is null)
      and not exists (
        select 1 from public.anuncio_alcance_red ar
        where ar.anuncio_id = p_anuncio_id and ar.fecha_eliminacion is null
          and not public.fn_es_lider_de_red(ar.red_id)
      );
  end if;

  if v_alcance_tipo = 'CDP' then
    return exists (select 1 from public.anuncio_alcance_cdp ac where ac.anuncio_id = p_anuncio_id and ac.fecha_eliminacion is null)
      and not exists (
        select 1 from public.anuncio_alcance_cdp ac
        left join public.casa_de_paz_red cdr
          on cdr.casa_de_paz_id = ac.casa_de_paz_id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        where ac.anuncio_id = p_anuncio_id and ac.fecha_eliminacion is null
          and (cdr.red_id is null or not public.fn_es_lider_de_red(cdr.red_id))
      );
  end if;

  return false;
end;
$$;

revoke all on function private.fn_anuncio_fila_administrable(uuid) from public, anon, authenticated;

-- ============================================================
-- Destinatario: recalculado sobre alcance multiple
-- ============================================================

create or replace function private.fn_anuncio_es_destinatario(p_anuncio_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_alcance_tipo text;
  v_roles text[];
  v_activo boolean;
  v_es_borrador boolean;
  v_pub timestamptz;
  v_fin timestamptz;
  v_mis_roles text[];
begin
  select iglesia_id, alcance_tipo, roles_destinatarios, activo, es_borrador, fecha_publicacion, fecha_fin
  into v_iglesia_id, v_alcance_tipo, v_roles, v_activo, v_es_borrador, v_pub, v_fin
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null;

  if v_iglesia_id is null or not v_activo or v_es_borrador then
    return false;
  end if;

  if v_pub > now() or (v_fin is not null and v_fin < now()) then
    return false;
  end if;

  if v_iglesia_id not in (select public.fn_mis_iglesias()) then
    return false;
  end if;

  if v_alcance_tipo = 'IGLESIA' then
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
  elsif v_alcance_tipo = 'RED' then
    v_mis_roles := array(
      select distinct c.codigo
      from public.red_cargo rc
      join public.cargo c on c.id = rc.cargo_id
      join public.anuncio_alcance_red ar on ar.red_id = rc.red_id
      where ar.anuncio_id = p_anuncio_id and ar.fecha_eliminacion is null
        and rc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        and rc.fecha_fin is null and rc.fecha_eliminacion is null
      union
      select distinct c.codigo
      from public.casa_de_paz_cargo cc
      join public.cargo c on c.id = cc.cargo_id
      join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cc.casa_de_paz_id
      join public.anuncio_alcance_red ar on ar.red_id = cdr.red_id
      where ar.anuncio_id = p_anuncio_id and ar.fecha_eliminacion is null
        and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        and cc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_CDP', 'SUBLIDER_CDP')
        and cc.fecha_fin is null and cc.fecha_eliminacion is null
    );
  else
    -- CDP: destinatario si tiene cargo puntual en una de las CdP elegidas, o
    -- si lidera la Red de alguna de ellas.
    v_mis_roles := array(
      select distinct c.codigo
      from public.casa_de_paz_cargo cc
      join public.cargo c on c.id = cc.cargo_id
      join public.anuncio_alcance_cdp ac on ac.casa_de_paz_id = cc.casa_de_paz_id
      where ac.anuncio_id = p_anuncio_id and ac.fecha_eliminacion is null
        and cc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_CDP', 'SUBLIDER_CDP')
        and cc.fecha_fin is null and cc.fecha_eliminacion is null
      union
      select distinct c.codigo
      from public.red_cargo rc
      join public.cargo c on c.id = rc.cargo_id
      join public.casa_de_paz_red cdr on cdr.red_id = rc.red_id
      join public.anuncio_alcance_cdp ac on ac.casa_de_paz_id = cdr.casa_de_paz_id
      where ac.anuncio_id = p_anuncio_id and ac.fecha_eliminacion is null
        and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        and rc.persona_id = public.fn_mi_persona_id()
        and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        and rc.fecha_fin is null and rc.fecha_eliminacion is null
    );
  end if;

  return v_mis_roles && v_roles;
end;
$$;

-- ============================================================
-- RLS: reemplaza el uso de fn_anuncio_puede_crear(iglesia_id, red_id)
-- ============================================================

drop policy if exists pol_anuncio_select on public.anuncio;
create policy pol_anuncio_select
  on public.anuncio
  for select
  to authenticated
  using (
    fecha_eliminacion is null
    and (
      private.fn_anuncio_fila_administrable(id)
      or private.fn_anuncio_es_destinatario(id)
    )
  );

-- Nota: el INSERT/UPDATE por PostgREST directo (sin pasar por las RPC de
-- abajo) queda acotado a quien administra toda la iglesia -- el alcance
-- granular por Red/CdP puntual solo se valida dentro de fn_anuncio_crear/
-- fn_anuncio_actualizar (misma logica que ya usaban el resto de RPC de
-- Estructura Organizacional: la RPC es el unico camino de escritura real).
drop policy if exists pol_anuncio_insert on public.anuncio;
create policy pol_anuncio_insert
  on public.anuncio
  for insert
  to authenticated
  with check (
    private.fn_anuncio_puede_gestionar_iglesia(iglesia_id)
    and autor_persona_id = public.fn_mi_persona_id()
  );

drop policy if exists pol_anuncio_update on public.anuncio;
create policy pol_anuncio_update
  on public.anuncio
  for update
  to authenticated
  using (private.fn_anuncio_fila_administrable(id))
  with check (private.fn_anuncio_fila_administrable(id));

-- ============================================================
-- Storage: mismas politicas, ahora via fila_administrable/gestionar_iglesia
-- ============================================================

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
        and (private.fn_anuncio_fila_administrable(a.id) or private.fn_anuncio_es_destinatario(a.id))
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
      private.fn_anuncio_puede_gestionar_iglesia(((storage.foldername(name))[1])::uuid)
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
      private.fn_anuncio_puede_gestionar_iglesia(((storage.foldername(name))[1])::uuid)
      or public.fn_es_lider_de_red_en_iglesia(((storage.foldername(name))[1])::uuid)
    )
  );

-- ============================================================
-- T4: capacidad del creador (agrega CdPs administrables + encargado)
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
    'puede_iglesia', private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id),
    'puede_designar_encargados', private.fn_anuncio_es_supervisor(p_iglesia_id),
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
    ),
    'casas_de_paz', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', y.id, 'nombre', y.nombre, 'red_id', y.red_id
      ) order by y.nombre), '[]'::jsonb)
      from (
        select distinct cdp.id, cdp.nombre, cdr.red_id
        from public.casa_de_paz cdp
        join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
          and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        join public.red r on r.id = cdr.red_id
        join public.red_cargo rc on rc.red_id = r.id
        join public.cargo c on c.id = rc.cargo_id and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        where cdp.iglesia_id = p_iglesia_id and cdp.fecha_eliminacion is null
          and rc.persona_id = public.fn_mi_persona_id()
          and rc.fecha_fin is null and rc.fecha_eliminacion is null
      ) y
    )
  );
end;
$$;

-- Roles disponibles como destinatarios (T4). Firma nueva: alcance explicito
-- en vez de un unico p_red_id -- DROP obligatorio (Postgres no permite
-- CREATE OR REPLACE con distinta lista de parametros), con revoke/grant
-- inmediato despues (mismo patron de KAN-135/KAN-172 de esta sesion).
drop function if exists public.fn_anuncio_roles_disponibles(uuid, uuid);

create function public.fn_anuncio_roles_disponibles(
  p_iglesia_id uuid,
  p_alcance_tipo text default 'IGLESIA',
  p_red_ids uuid[] default null,
  p_cdp_ids uuid[] default null
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_administrar_alcance(p_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id) then
    return array['LIDER_RED', 'SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
  end if;

  -- Quien no gestiona toda la iglesia solo llega aca si administra TODAS
  -- las Redes/CdP del alcance (ya validado arriba) -- Lider de Red pleno
  -- ve Supervisor de Red/CdP/Miembro, Supervisor de Red ve Lider de Red/
  -- CdP/Miembro (paridad ya existente, sin cambios de criterio).
  if exists (
    select 1 from public.red_cargo rc
    join public.cargo c on c.id = rc.cargo_id and c.codigo = 'SUBLIDER_RED'
    where rc.persona_id = public.fn_mi_persona_id()
      and rc.fecha_fin is null and rc.fecha_eliminacion is null
      and (
        (p_alcance_tipo = 'RED' and rc.red_id = any(p_red_ids))
        or (p_alcance_tipo = 'CDP' and exists (
          select 1 from public.casa_de_paz_red cdr
          where cdr.red_id = rc.red_id and cdr.casa_de_paz_id = any(p_cdp_ids)
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        ))
      )
  ) then
    return array['LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
  end if;

  return array['SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'MIEMBRO'];
end;
$$;

revoke all on function public.fn_anuncio_roles_disponibles(uuid, text, uuid[], uuid[])
  from public, anon;
grant execute on function public.fn_anuncio_roles_disponibles(uuid, text, uuid[], uuid[])
  to authenticated;

revoke all on function public.fn_anuncio_mi_capacidad(uuid) from public, anon, authenticated;
grant execute on function public.fn_anuncio_mi_capacidad(uuid) to authenticated;

-- ============================================================
-- T3: CRUD reescrito sobre alcance multiple + borrador real
-- ============================================================

drop function if exists public.fn_anuncio_crear(uuid, uuid, text, text, text, text, text[], timestamptz, timestamptz);

create function public.fn_anuncio_crear(
  p_iglesia_id uuid,
  p_alcance_tipo text,
  p_red_ids uuid[],
  p_cdp_ids uuid[],
  p_titulo text,
  p_mensaje text,
  p_imagen_path text,
  p_imagen_orientacion text,
  p_roles_destinatarios text[],
  p_fecha_publicacion timestamptz default now(),
  p_fecha_fin timestamptz default null,
  p_es_borrador boolean default false
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

  if p_alcance_tipo not in ('IGLESIA', 'RED', 'CDP') then
    raise exception 'ANUNCIO_ALCANCE_INVALIDO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_administrar_alcance(p_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids) then
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

  v_permitidos := public.fn_anuncio_roles_disponibles(p_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids);
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
    iglesia_id, alcance_tipo, autor_persona_id, titulo, mensaje, imagen_path,
    imagen_orientacion, roles_destinatarios, fecha_publicacion, fecha_fin,
    es_borrador, creado_por, actualizado_por
  ) values (
    p_iglesia_id, p_alcance_tipo, v_persona_id, v_titulo, nullif(btrim(p_mensaje), ''), p_imagen_path,
    p_imagen_orientacion, p_roles_destinatarios, coalesce(p_fecha_publicacion, now()), p_fecha_fin,
    coalesce(p_es_borrador, false), (select auth.uid()), (select auth.uid())
  )
  returning id into v_anuncio_id;

  if p_alcance_tipo = 'RED' then
    insert into public.anuncio_alcance_red (anuncio_id, red_id, creado_por, actualizado_por)
    select v_anuncio_id, rid, (select auth.uid()), (select auth.uid())
    from unnest(p_red_ids) as rid;
  elsif p_alcance_tipo = 'CDP' then
    insert into public.anuncio_alcance_cdp (anuncio_id, casa_de_paz_id, creado_por, actualizado_por)
    select v_anuncio_id, cid, (select auth.uid()), (select auth.uid())
    from unnest(p_cdp_ids) as cid;
  end if;

  return v_anuncio_id;
end;
$$;

revoke all on function public.fn_anuncio_crear(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean)
  from public, anon;
grant execute on function public.fn_anuncio_crear(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean)
  to authenticated;

drop function if exists public.fn_anuncio_actualizar(uuid, text, text, text, text, text[], timestamptz, timestamptz);

create function public.fn_anuncio_actualizar(
  p_anuncio_id uuid,
  p_alcance_tipo text,
  p_red_ids uuid[],
  p_cdp_ids uuid[],
  p_titulo text,
  p_mensaje text,
  p_imagen_path text,
  p_imagen_orientacion text,
  p_roles_destinatarios text[],
  p_fecha_publicacion timestamptz,
  p_fecha_fin timestamptz,
  p_mostrar_nuevamente boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_permitidos text[];
  v_titulo text := btrim(p_titulo);
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select iglesia_id into v_iglesia_id
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if p_alcance_tipo not in ('IGLESIA', 'RED', 'CDP') then
    raise exception 'ANUNCIO_ALCANCE_INVALIDO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_administrar_alcance(v_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids) then
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

  v_permitidos := public.fn_anuncio_roles_disponibles(v_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids);
  if not (p_roles_destinatarios <@ v_permitidos) then
    raise exception 'ANUNCIO_DESTINATARIOS_NO_PERMITIDOS' using errcode = 'P0001';
  end if;

  if p_fecha_fin is not null and p_fecha_fin < coalesce(p_fecha_publicacion, now()) then
    raise exception 'ANUNCIO_FECHAS_INVALIDAS' using errcode = 'P0001';
  end if;

  update public.anuncio set
    alcance_tipo = p_alcance_tipo,
    titulo = v_titulo,
    mensaje = nullif(btrim(p_mensaje), ''),
    imagen_path = p_imagen_path,
    imagen_orientacion = p_imagen_orientacion,
    roles_destinatarios = p_roles_destinatarios,
    fecha_publicacion = coalesce(p_fecha_publicacion, fecha_publicacion),
    fecha_fin = p_fecha_fin,
    actualizado_por = (select auth.uid())
  where id = p_anuncio_id;

  -- Reemplaza el alcance completo (baja logica de lo que ya no aplica, alta
  -- de lo nuevo) -- mas simple y menos propenso a bugs que un diff fila por
  -- fila, y el volumen por anuncio es chico (unas pocas Redes/CdP).
  update public.anuncio_alcance_red
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where anuncio_id = p_anuncio_id and fecha_eliminacion is null;

  update public.anuncio_alcance_cdp
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where anuncio_id = p_anuncio_id and fecha_eliminacion is null;

  if p_alcance_tipo = 'RED' then
    insert into public.anuncio_alcance_red (anuncio_id, red_id, creado_por, actualizado_por)
    select p_anuncio_id, rid, (select auth.uid()), (select auth.uid())
    from unnest(p_red_ids) as rid;
  elsif p_alcance_tipo = 'CDP' then
    insert into public.anuncio_alcance_cdp (anuncio_id, casa_de_paz_id, creado_por, actualizado_por)
    select p_anuncio_id, cid, (select auth.uid()), (select auth.uid())
    from unnest(p_cdp_ids) as cid;
  end if;

  -- SS29 anuncios.txt: editar un anuncio ya publicado exige elegir entre
  -- mantener las visualizaciones existentes o mostrarlo de nuevo a todos.
  if p_mostrar_nuevamente then
    update public.anuncio_visto
    set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
    where anuncio_id = p_anuncio_id and fecha_eliminacion is null;
  end if;

  return p_anuncio_id;
end;
$$;

revoke all on function public.fn_anuncio_actualizar(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean)
  from public, anon;
grant execute on function public.fn_anuncio_actualizar(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean)
  to authenticated;

-- Publica un borrador (o lo re-programa): unico camino para apagar
-- es_borrador -- separado de actualizar para que el boton [Publicar] del
-- formulario (SS26 anuncios.txt) sea una accion explicita, no un efecto
-- colateral de guardar.
create or replace function public.fn_anuncio_publicar(p_anuncio_id uuid, p_fecha_publicacion timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  update public.anuncio
  set es_borrador = false,
      fecha_publicacion = coalesce(p_fecha_publicacion, now()),
      actualizado_por = (select auth.uid())
  where id = p_anuncio_id and fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_anuncio_publicar(uuid, timestamptz) from public, anon;
grant execute on function public.fn_anuncio_publicar(uuid, timestamptz) to authenticated;

create or replace function public.fn_anuncio_toggle_activo(p_anuncio_id uuid, p_activo boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  update public.anuncio
  set activo = p_activo, actualizado_por = (select auth.uid())
  where id = p_anuncio_id and fecha_eliminacion is null;

  return p_activo;
end;
$$;

create or replace function public.fn_anuncio_eliminar(p_anuncio_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  update public.anuncio
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where id = p_anuncio_id and fecha_eliminacion is null;

  return true;
end;
$$;

-- Cambia la forma de RETURNS TABLE respecto al original (agrega
-- alcance_tipo/redes/casas_de_paz/es_borrador, saca red_id/red_nombre) --
-- exige DROP + CREATE, con revoke/grant explicito despues (mismo patron ya
-- aplicado hoy en KAN-135/KAN-172: el DROP resetea el ACL al default).
drop function if exists public.fn_mis_anuncios_gestion(uuid, uuid);

create function public.fn_mis_anuncios_gestion(p_iglesia_id uuid, p_red_id uuid default null)
returns table (
  id uuid,
  alcance_tipo text,
  redes jsonb,
  casas_de_paz jsonb,
  titulo text,
  mensaje text,
  imagen_path text,
  imagen_orientacion text,
  roles_destinatarios text[],
  activo boolean,
  es_borrador boolean,
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
    a.id, a.alcance_tipo,
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre)), '[]'::jsonb)
      from public.anuncio_alcance_red ar
      join public.red r on r.id = ar.red_id
      where ar.anuncio_id = a.id and ar.fecha_eliminacion is null
    ),
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre)), '[]'::jsonb)
      from public.anuncio_alcance_cdp ac
      join public.casa_de_paz c on c.id = ac.casa_de_paz_id
      where ac.anuncio_id = a.id and ac.fecha_eliminacion is null
    ),
    a.titulo::text, a.mensaje, a.imagen_path,
    a.imagen_orientacion::text, a.roles_destinatarios, a.activo, a.es_borrador, a.prioridad,
    a.fecha_publicacion, a.fecha_fin, public.fn_nombre_completo(p), a.fecha_creacion
  from public.anuncio a
  left join public.persona p on p.id = a.autor_persona_id
  where a.iglesia_id = p_iglesia_id
    and a.fecha_eliminacion is null
    and (
      p_red_id is null
      or exists (select 1 from public.anuncio_alcance_red ar where ar.anuncio_id = a.id and ar.red_id = p_red_id and ar.fecha_eliminacion is null)
    )
    and private.fn_anuncio_fila_administrable(a.id)
  order by a.fecha_creacion desc;
end;
$$;

revoke all on function public.fn_mis_anuncios_gestion(uuid, uuid) from public, anon;
grant execute on function public.fn_mis_anuncios_gestion(uuid, uuid) to authenticated;

commit;
