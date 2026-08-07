-- VisionHub — BORRADOR NO APLICAR
-- Constructor de Estructura Organizacional — cimientos de datos
-- Revisado contra Supabase productivo en modo lectura: 2026-08-04.
-- Este archivo documenta el contrato propuesto. La migración ejecutable se
-- creará con Supabase CLI después de la aprobación del owner.

begin;

-- ============================================================
-- 1. Color institucional de los cuatro departamentos
-- ============================================================

alter table public.departamento
  add column if not exists color text;

update public.departamento
set color = case upper(codigo)
  when 'EVANGELISMO' then '#F5C518'
  when 'AFIRMACION' then '#0071E3'
  when 'DISCIPULADO' then '#FF3B30'
  when 'ENVIO' then '#8E8E93'
  else color
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
      check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end
$$;

-- ============================================================
-- 2. Configuración y versión canónica, una fila por iglesia
-- ============================================================

create table public.estructura_organigrama (
  iglesia_id uuid primary key references public.iglesia(id),
  otp_requerido boolean not null default false,
  version bigint not null default 0 check (version >= 0),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id)
);

create trigger trg_auditoria_estructura_organigrama
  before insert or update on public.estructura_organigrama
  for each row execute function public.fn_auditoria();

-- No hay DELETE funcional para el organigrama canónico.
create trigger trg_no_delete_estructura_organigrama
  before delete on public.estructura_organigrama
  for each row execute function public.fn_bloquear_delete();

-- ============================================================
-- 3. Posiciones compartidas, normalizadas y ajustadas a 16 px
-- ============================================================

create table public.estructura_nodo_posicion (
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

create unique index uq_estructura_nodo_clave_vigente
  on public.estructura_nodo_posicion (iglesia_id, nodo_clave)
  where fecha_eliminacion is null;

create index idx_estructura_nodo_posicion_iglesia_tipo
  on public.estructura_nodo_posicion (iglesia_id, tipo_nodo);

create index idx_estructura_nodo_posicion_entidad
  on public.estructura_nodo_posicion (entidad_id)
  where entidad_id is not null;

create trigger trg_auditoria_estructura_nodo_posicion
  before insert or update on public.estructura_nodo_posicion
  for each row execute function public.fn_auditoria();

create trigger trg_no_delete_estructura_nodo_posicion
  before delete on public.estructura_nodo_posicion
  for each row execute function public.fn_bloquear_delete();

-- ============================================================
-- 4. Auditoría inmutable del switch OTP
-- ============================================================

create table public.estructura_otp_auditoria (
  id bigint generated always as identity primary key,
  iglesia_id uuid not null references public.iglesia(id),
  usuario_id uuid not null references auth.users(id),
  valor_anterior boolean not null,
  valor_nuevo boolean not null,
  fecha_creacion timestamptz not null default now(),
  constraint chk_estructura_otp_cambio
    check (valor_anterior is distinct from valor_nuevo)
);

create index idx_estructura_otp_auditoria_iglesia_fecha
  on public.estructura_otp_auditoria (iglesia_id, fecha_creacion desc);

-- ============================================================
-- 5. RLS y privilegios: lectura autorizada, escritura solo por RPC
-- ============================================================

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

create schema if not exists private;

create or replace function private.fn_puede_administrar_estructura(
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
      (select public.fn_es_super_admin())
      or (select public.fn_es_operativo_en(p_iglesia_id))
      or exists (
        select 1
        from public.iglesia i
        where i.id = p_iglesia_id
          and i.tipo = 'SATELITE'::public.iglesia_tipo_enum
          and i.fecha_eliminacion is null
          and i.iglesia_padre_id is not null
          and (select public.fn_es_operativo_en(i.iglesia_padre_id))
      )
    );
$$;

revoke all on function private.fn_puede_administrar_estructura(uuid)
  from public, anon, authenticated;

-- La función se ubica en un esquema privado/no expuesto, usa search_path vacío
-- y comprueba que exista un auth.uid() antes de evaluar autorización.
-- Regla funcional:
--   Super Admin
--   OR Supervisor de la iglesia abierta
--   OR, solo si la abierta es SATELITE, Supervisor de su iglesia madre directa.
-- Una iglesia HIJA nunca hereda administración de la madre.

create policy pol_estructura_organigrama_select
  on public.estructura_organigrama
  for select
  to authenticated
  using (private.fn_puede_administrar_estructura(iglesia_id));

create policy pol_estructura_nodo_posicion_select
  on public.estructura_nodo_posicion
  for select
  to authenticated
  using (private.fn_puede_administrar_estructura(iglesia_id)
    and fecha_eliminacion is null);

create policy pol_estructura_otp_auditoria_select
  on public.estructura_otp_auditoria
  for select
  to authenticated
  using (private.fn_puede_administrar_estructura(iglesia_id));

-- INSERT/UPDATE se realizarán exclusivamente mediante RPC transaccionales con:
--   * autorización repetida dentro de la función;
--   * search_path = '' y nombres de esquema explícitos;
--   * control optimista por estructura_organigrama.version;
--   * OTP condicionado únicamente por otp_requerido del organigrama;
--   * EXECUTE revocado a PUBLIC/anon y concedido solo a authenticated.

rollback;

-- El ROLLBACK es intencional: este archivo es un borrador de revisión y no una
-- migración ejecutable. No debe copiarse directamente a producción.
