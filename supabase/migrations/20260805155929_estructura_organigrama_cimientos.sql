-- VisionHub — Estructura organizacional, cimientos
-- Secuencia lógica posterior a harness/11-esquema-bd/sql/97_.
-- Aditiva e idempotente: no elimina ni reasigna datos existentes.

begin;

-- 1. Colores institucionales de los cuatro departamentos.
alter table public.departamento
  add column if not exists color text;

update public.departamento
set color = case upper(codigo)
  when 'EVANGELISMO' then '#F5C518'
  when 'AFIRMACION' then '#0071E3'
  when 'DISCIPULADO' then '#FF3B30'
  when 'ENVIO' then '#8E8E93'
end
where upper(codigo) in ('EVANGELISMO', 'AFIRMACION', 'DISCIPULADO', 'ENVIO')
  and color is distinct from case upper(codigo)
    when 'EVANGELISMO' then '#F5C518'
    when 'AFIRMACION' then '#0071E3'
    when 'DISCIPULADO' then '#FF3B30'
    when 'ENVIO' then '#8E8E93'
  end;

alter table public.departamento
  alter column color set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.departamento'::regclass
      and conname = 'chk_departamento_color'
  ) then
    alter table public.departamento
      add constraint chk_departamento_color
      check (color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end
$$;

-- 2. Configuración y versión canónica: exactamente una fila por iglesia.
create table if not exists public.estructura_organigrama (
  iglesia_id uuid primary key references public.iglesia(id),
  otp_requerido boolean not null default false,
  version bigint not null default 0 check (version >= 0),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id)
);

drop trigger if exists trg_auditoria_estructura_organigrama
  on public.estructura_organigrama;
create trigger trg_auditoria_estructura_organigrama
  before insert or update on public.estructura_organigrama
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_estructura_organigrama
  on public.estructura_organigrama;
create trigger trg_no_delete_estructura_organigrama
  before delete on public.estructura_organigrama
  for each row execute function public.fn_bloquear_delete();

-- 3. Posiciones compartidas, normalizadas y ajustadas a cuadrícula de 16 px.
create table if not exists public.estructura_nodo_posicion (
  id bigint generated always as identity primary key,
  iglesia_id uuid not null references public.iglesia(id),
  nodo_clave text not null,
  tipo_nodo text not null,
  entidad_id uuid,
  posicion_x integer not null,
  posicion_y integer not null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  fecha_eliminacion timestamptz,
  eliminado_por uuid references auth.users(id),
  constraint chk_estructura_nodo_clave
    check (nodo_clave ~ '^[a-z0-9:_-]+$'),
  constraint chk_estructura_nodo_tipo
    check (tipo_nodo in (
      'PASTOR_SLOT',
      'SUPERVISOR_SLOT',
      'GRUPO_DEPARTAMENTOS',
      'DEPARTAMENTO',
      'GRUPO_REDES',
      'RED',
      'CASA_DE_PAZ'
    )),
  constraint chk_estructura_nodo_cuadricula
    check (mod(posicion_x, 16) = 0 and mod(posicion_y, 16) = 0)
);

create unique index if not exists uq_estructura_nodo_clave_vigente
  on public.estructura_nodo_posicion (iglesia_id, nodo_clave)
  where fecha_eliminacion is null;

create index if not exists idx_estructura_nodo_posicion_iglesia_tipo
  on public.estructura_nodo_posicion (iglesia_id, tipo_nodo);

create index if not exists idx_estructura_nodo_posicion_entidad
  on public.estructura_nodo_posicion (entidad_id)
  where entidad_id is not null;

drop trigger if exists trg_auditoria_estructura_nodo_posicion
  on public.estructura_nodo_posicion;
create trigger trg_auditoria_estructura_nodo_posicion
  before insert or update on public.estructura_nodo_posicion
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_estructura_nodo_posicion
  on public.estructura_nodo_posicion;
create trigger trg_no_delete_estructura_nodo_posicion
  before delete on public.estructura_nodo_posicion
  for each row execute function public.fn_bloquear_delete();

-- 4. Auditoría inmutable de cada cambio del switch OTP.
create table if not exists public.estructura_otp_auditoria (
  id bigint generated always as identity primary key,
  iglesia_id uuid not null references public.iglesia(id),
  usuario_id uuid not null references auth.users(id),
  valor_anterior boolean not null,
  valor_nuevo boolean not null,
  fecha_creacion timestamptz not null default now(),
  constraint chk_estructura_otp_cambio
    check (valor_anterior is distinct from valor_nuevo)
);

create index if not exists idx_estructura_otp_auditoria_iglesia_fecha
  on public.estructura_otp_auditoria (iglesia_id, fecha_creacion desc);

-- 5. RLS y privilegios mínimos. El frontend solo lee estas tablas; las
-- escrituras se habilitarán exclusivamente mediante RPC transaccionales.
alter table public.estructura_organigrama enable row level security;
alter table public.estructura_nodo_posicion enable row level security;
alter table public.estructura_otp_auditoria enable row level security;

revoke all on table public.estructura_organigrama
  from public, anon, authenticated;
revoke all on table public.estructura_nodo_posicion
  from public, anon, authenticated;
revoke all on table public.estructura_otp_auditoria
  from public, anon, authenticated;

grant select on table public.estructura_organigrama to authenticated;
grant select on table public.estructura_nodo_posicion to authenticated;
grant select on table public.estructura_otp_auditoria to authenticated;

drop policy if exists pol_estructura_organigrama_select
  on public.estructura_organigrama;
create policy pol_estructura_organigrama_select
  on public.estructura_organigrama
  for select
  to authenticated
  using (
    (select public.fn_es_super_admin())
    or (select public.fn_es_operativo_en(iglesia_id))
    or exists (
      select 1
      from public.iglesia i
      where i.id = iglesia_id
        and i.tipo = 'SATELITE'::public.iglesia_tipo_enum
        and i.fecha_eliminacion is null
        and i.iglesia_padre_id is not null
        and public.fn_es_operativo_en(i.iglesia_padre_id)
    )
  );

drop policy if exists pol_estructura_nodo_posicion_select
  on public.estructura_nodo_posicion;
create policy pol_estructura_nodo_posicion_select
  on public.estructura_nodo_posicion
  for select
  to authenticated
  using (
    fecha_eliminacion is null
    and (
      (select public.fn_es_super_admin())
      or (select public.fn_es_operativo_en(iglesia_id))
      or exists (
        select 1
        from public.iglesia i
        where i.id = iglesia_id
          and i.tipo = 'SATELITE'::public.iglesia_tipo_enum
          and i.fecha_eliminacion is null
          and i.iglesia_padre_id is not null
          and public.fn_es_operativo_en(i.iglesia_padre_id)
      )
    )
  );

drop policy if exists pol_estructura_otp_auditoria_select
  on public.estructura_otp_auditoria;
create policy pol_estructura_otp_auditoria_select
  on public.estructura_otp_auditoria
  for select
  to authenticated
  using (
    (select public.fn_es_super_admin())
    or (select public.fn_es_operativo_en(iglesia_id))
    or exists (
      select 1
      from public.iglesia i
      where i.id = iglesia_id
        and i.tipo = 'SATELITE'::public.iglesia_tipo_enum
        and i.fecha_eliminacion is null
        and i.iglesia_padre_id is not null
        and public.fn_es_operativo_en(i.iglesia_padre_id)
    )
  );

-- 6. Persistencia transaccional y optimista del layout. La escritura directa
-- permanece revocada: solo esta RPC puede insertar o mover posiciones.
create or replace function public.fn_estructura_guardar_posiciones(
  p_iglesia_id uuid,
  p_nodos jsonb,
  p_version_esperada bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_actual bigint;
  v_nodo jsonb;
  v_nodo_clave text;
  v_tipo_nodo text;
  v_entidad_id uuid;
  v_x integer;
  v_y integer;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  if not (
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
  ) then
    raise exception 'SIN_PERMISO';
  end if;

  if jsonb_typeof(p_nodos) <> 'array'
     or jsonb_array_length(p_nodos) > 1000 then
    raise exception 'ESTRUCTURA_NODOS_INVALIDOS';
  end if;

  insert into public.estructura_organigrama (iglesia_id, creado_por)
  values (p_iglesia_id, auth.uid())
  on conflict (iglesia_id) do nothing;

  select eo.version
  into v_version_actual
  from public.estructura_organigrama eo
  where eo.iglesia_id = p_iglesia_id
  for update;

  if v_version_actual is distinct from p_version_esperada then
    raise exception 'ESTRUCTURA_LAYOUT_DESACTUALIZADO';
  end if;

  for v_nodo in select value from jsonb_array_elements(p_nodos)
  loop
    v_nodo_clave := v_nodo ->> 'nodo_clave';
    v_tipo_nodo := v_nodo ->> 'tipo_nodo';
    v_entidad_id := nullif(v_nodo ->> 'entidad_id', '')::uuid;
    v_x := (v_nodo ->> 'posicion_x')::integer;
    v_y := (v_nodo ->> 'posicion_y')::integer;

    if v_nodo_clave is null
       or v_nodo_clave !~ '^[a-z0-9:_-]+$'
       or v_tipo_nodo not in (
         'PASTOR_SLOT', 'SUPERVISOR_SLOT', 'GRUPO_DEPARTAMENTOS',
         'DEPARTAMENTO', 'GRUPO_REDES', 'RED', 'CASA_DE_PAZ'
       )
       or mod(v_x, 16) <> 0
       or mod(v_y, 16) <> 0 then
      raise exception 'ESTRUCTURA_NODO_INVALIDO';
    end if;

    insert into public.estructura_nodo_posicion (
      iglesia_id, nodo_clave, tipo_nodo, entidad_id,
      posicion_x, posicion_y, creado_por, actualizado_por
    ) values (
      p_iglesia_id, v_nodo_clave, v_tipo_nodo, v_entidad_id,
      v_x, v_y, auth.uid(), auth.uid()
    )
    on conflict (iglesia_id, nodo_clave)
      where fecha_eliminacion is null
    do update set
      tipo_nodo = excluded.tipo_nodo,
      entidad_id = excluded.entidad_id,
      posicion_x = excluded.posicion_x,
      posicion_y = excluded.posicion_y,
      actualizado_por = auth.uid();
  end loop;

  update public.estructura_organigrama
  set version = version + 1,
      actualizado_por = auth.uid()
  where iglesia_id = p_iglesia_id
  returning version into v_version_actual;

  return v_version_actual;
end;
$$;

revoke all on function public.fn_estructura_guardar_posiciones(uuid, jsonb, bigint)
  from public, anon;
grant execute on function public.fn_estructura_guardar_posiciones(uuid, jsonb, bigint)
  to authenticated;

commit;

-- Reversión manual, solo antes de que existan datos funcionales:
-- drop table public.estructura_otp_auditoria;
-- drop table public.estructura_nodo_posicion;
-- drop table public.estructura_organigrama;
-- alter table public.departamento drop constraint chk_departamento_color;
-- alter table public.departamento drop column color;
