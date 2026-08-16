-- VisionHub -- T1 (KAN-102), ampliacion de modelo segun anuncios.txt SS40.1/40.2.
--
-- 1) Alcance multiple: anuncio.red_id (columna unica nullable) no alcanza
--    para "varias Redes" ni "Casas de Paz puntuales" (SS16-18/Caso E de
--    anuncios.txt). Se agrega anuncio.alcance_tipo ('IGLESIA'|'RED'|'CDP')
--    + 2 tablas de union (mismo patron que casa_de_paz_red) para 0..N
--    Redes o 0..N Casas de Paz por anuncio. anuncio.red_id se deja tal cual
--    (dato historico, no se borra ni se sigue escribiendo) -- la logica de
--    permisos deja de leerlo en la migracion siguiente (T2/KAN-103).
-- 2) Borrador real: anuncio.es_borrador persistido (no derivado de fechas),
--    para separar "todavia en edicion, sin decidir cuando publicar" de
--    "programado" -- ver SS24/SS26 de anuncios.txt (botones [Guardar
--    borrador] / [Publicar] separados).

begin;

alter table public.anuncio
  add column if not exists alcance_tipo text not null default 'IGLESIA',
  add column if not exists es_borrador boolean not null default false;

alter table public.anuncio
  drop constraint if exists chk_anuncio_alcance_tipo;
alter table public.anuncio
  add constraint chk_anuncio_alcance_tipo check (alcance_tipo in ('IGLESIA', 'RED', 'CDP'));

-- Backfill: el dato historico solo distinguia IGLESIA (red_id null) de una
-- sola RED (red_id puntual) -- nunca hubo alcance CDP.
update public.anuncio
set alcance_tipo = case when red_id is null then 'IGLESIA' else 'RED' end
where alcance_tipo = 'IGLESIA';

create table if not exists public.anuncio_alcance_red (
  id                  uuid primary key default gen_random_uuid(),
  anuncio_id          uuid not null references public.anuncio(id),
  red_id              uuid not null references public.red(id),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por          uuid references auth.users(id),
  actualizado_por     uuid references auth.users(id),
  fecha_eliminacion   timestamptz,
  eliminado_por       uuid references auth.users(id)
);

drop trigger if exists trg_auditoria_anuncio_alcance_red on public.anuncio_alcance_red;
create trigger trg_auditoria_anuncio_alcance_red
  before insert or update on public.anuncio_alcance_red
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_anuncio_alcance_red on public.anuncio_alcance_red;
create trigger trg_no_delete_anuncio_alcance_red
  before delete on public.anuncio_alcance_red
  for each row execute function public.fn_bloquear_delete();

create unique index if not exists uq_anuncio_alcance_red
  on public.anuncio_alcance_red (anuncio_id, red_id)
  where fecha_eliminacion is null;

create index if not exists idx_anuncio_alcance_red_anuncio
  on public.anuncio_alcance_red (anuncio_id)
  where fecha_eliminacion is null;

create table if not exists public.anuncio_alcance_cdp (
  id                  uuid primary key default gen_random_uuid(),
  anuncio_id          uuid not null references public.anuncio(id),
  casa_de_paz_id      uuid not null references public.casa_de_paz(id),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por          uuid references auth.users(id),
  actualizado_por     uuid references auth.users(id),
  fecha_eliminacion   timestamptz,
  eliminado_por       uuid references auth.users(id)
);

drop trigger if exists trg_auditoria_anuncio_alcance_cdp on public.anuncio_alcance_cdp;
create trigger trg_auditoria_anuncio_alcance_cdp
  before insert or update on public.anuncio_alcance_cdp
  for each row execute function public.fn_auditoria();

drop trigger if exists trg_no_delete_anuncio_alcance_cdp on public.anuncio_alcance_cdp;
create trigger trg_no_delete_anuncio_alcance_cdp
  before delete on public.anuncio_alcance_cdp
  for each row execute function public.fn_bloquear_delete();

create unique index if not exists uq_anuncio_alcance_cdp
  on public.anuncio_alcance_cdp (anuncio_id, casa_de_paz_id)
  where fecha_eliminacion is null;

create index if not exists idx_anuncio_alcance_cdp_anuncio
  on public.anuncio_alcance_cdp (anuncio_id)
  where fecha_eliminacion is null;

-- Backfill de las filas historicas con red_id puntual: quedan tambien
-- representadas en la tabla de union, asi toda lectura nueva puede dejar de
-- mirar anuncio.red_id sin perder datos.
insert into public.anuncio_alcance_red (anuncio_id, red_id, creado_por, actualizado_por)
select a.id, a.red_id, a.creado_por, a.creado_por
from public.anuncio a
where a.red_id is not null
  and a.fecha_eliminacion is null
  and not exists (
    select 1 from public.anuncio_alcance_red ar
    where ar.anuncio_id = a.id and ar.red_id = a.red_id and ar.fecha_eliminacion is null
  );

alter table public.anuncio_alcance_red enable row level security;
revoke all on table public.anuncio_alcance_red from public, anon, authenticated;
grant select on table public.anuncio_alcance_red to authenticated;

drop policy if exists pol_anuncio_alcance_red_select on public.anuncio_alcance_red;
create policy pol_anuncio_alcance_red_select
  on public.anuncio_alcance_red
  for select
  to authenticated
  using (
    fecha_eliminacion is null
    and exists (
      select 1 from public.anuncio a
      where a.id = anuncio_id and a.fecha_eliminacion is null
    )
  );

alter table public.anuncio_alcance_cdp enable row level security;
revoke all on table public.anuncio_alcance_cdp from public, anon, authenticated;
grant select on table public.anuncio_alcance_cdp to authenticated;

drop policy if exists pol_anuncio_alcance_cdp_select on public.anuncio_alcance_cdp;
create policy pol_anuncio_alcance_cdp_select
  on public.anuncio_alcance_cdp
  for select
  to authenticated
  using (
    fecha_eliminacion is null
    and exists (
      select 1 from public.anuncio a
      where a.id = anuncio_id and a.fecha_eliminacion is null
    )
  );

commit;
