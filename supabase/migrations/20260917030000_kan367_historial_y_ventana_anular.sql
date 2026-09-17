-- VisionHub -- KAN-367 (pedido explicito del owner, 2026-09-17):
-- 1) "Anular" deja de compartir la ventana de "Editar" -- pasa a tener su
--    propia ventana corta, en HORAS (no dias), desde fecha_creacion.
-- 2) Historial de cambios de reportes de CdP (modificaciones y anulaciones),
--    visible solo para Pastor/Supervisor de la Vision en Accion via RPC --
--    nunca se expone la tabla directo al cliente.

begin;

-- ============================================================
-- 1) Config nueva: HORAS_LIMITE_ANULAR_REPORTE_CDP
-- ============================================================

insert into public.configuracion_definicion
  (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, orden)
values
  (
    'HORAS_LIMITE_ANULAR_REPORTE_CDP',
    'Horas límite para anular un reporte (Líder/Sublíder de CdP)',
    'Horas desde que se CARGÓ el reporte dentro de las cuales el Líder o Sublíder de esa Casa de Paz puede anularlo -- ventana propia, más corta que la de editar, para no facilitar el patrón de "anular y recargar".',
    'NUMERICO',
    '3',
    '1',
    '72',
    'horas',
    'CONTROL_REPORTES',
    44
  )
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  valor_min = excluded.valor_min,
  valor_max = excluded.valor_max,
  orden = excluded.orden;

-- ============================================================
-- 2) fn_puede_anular_reporte_cdp: ventana propia (horas) para CdP,
--    misma ventana larga que ya tenia (dias) para Red/Pastor/Supervisor.
-- ============================================================

create or replace function public.fn_puede_anular_reporte_cdp(p_reporte_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    (
      fn_es_super_admin()
      or (
        -- CdP: Lider/Sublider de su propia CdP, ventana corta en HORAS.
        r.fecha_creacion >= now() - (fn_criterio(r.iglesia_id, 'HORAS_LIMITE_ANULAR_REPORTE_CDP')::int * interval '1 hour')
        and (fn_es_lider_cdp(r.casa_de_paz_id) or fn_es_sublider_cdp(r.casa_de_paz_id))
      )
      or (
        -- Red/Pastor/Supervisor: misma ventana larga (dias) que ya tenian para editar.
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        and (
          exists (
            select 1 from casa_de_paz_red cdr
            where cdr.casa_de_paz_id = r.casa_de_paz_id
              and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
              and fn_es_lider_de_red(cdr.red_id)
          )
          or fn_es_pastor_en(r.iglesia_id) or fn_es_supervisor_en(r.iglesia_id)
        )
      )
    )
  from casa_de_paz_reporte r
  where r.id = p_reporte_id and r.fecha_eliminacion is null;
$$;

grant execute on function public.fn_puede_anular_reporte_cdp(uuid) to authenticated;

-- fn_anular_reporte_cdp: mismo cuerpo, unico cambio real es el gate.
create or replace function public.fn_anular_reporte_cdp(p_reporte_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reporte casa_de_paz_reporte;
begin
  select * into v_reporte from casa_de_paz_reporte where id = p_reporte_id;

  if v_reporte.id is null or v_reporte.fecha_eliminacion is not null then
    return;
  end if;

  if not fn_puede_anular_reporte_cdp(p_reporte_id) then
    raise exception 'REPORTE_ANULAR_SIN_PERMISO: no tenes permiso para anular este reporte (o ya paso la ventana para anular)'
      using errcode = 'P0001';
  end if;

  update casa_de_paz_asistencia set fecha_eliminacion = now(), eliminado_por = auth.uid()
  where reporte_id = p_reporte_id and fecha_eliminacion is null;

  update casa_de_paz_reporte set fecha_eliminacion = now(), eliminado_por = auth.uid()
  where id = p_reporte_id;
end;
$function$;

grant execute on function public.fn_anular_reporte_cdp(uuid) to authenticated;

-- ============================================================
-- 3) Historial de cambios de reportes de CdP.
-- ============================================================

create table public.casa_de_paz_reporte_historial (
  id                 uuid primary key default gen_random_uuid(),
  reporte_id         uuid not null references public.casa_de_paz_reporte(id),
  iglesia_id         uuid not null references public.iglesia(id),
  tipo               varchar(20) not null check (tipo in ('MODIFICADO', 'ANULADO')),
  snapshot_anterior  jsonb not null,
  modificado_por     uuid references auth.users(id),
  fecha_creacion     timestamptz not null default now()
);

create index idx_reporte_historial_reporte on public.casa_de_paz_reporte_historial (reporte_id, fecha_creacion desc);

-- Igual que el resto del proyecto: registro de auditoria, nunca se borra.
create trigger trg_no_delete_casa_de_paz_reporte_historial
  before delete on public.casa_de_paz_reporte_historial
  for each row execute function public.fn_bloquear_delete();

-- No hay GRANT de SELECT/INSERT directo a "authenticated" sobre esta tabla a
-- proposito -- se llena sola via trigger (SECURITY DEFINER) y se lee solo
-- via fn_historial_reporte_cdp (tambien SECURITY DEFINER, con su propio
-- gate de permiso). El cliente nunca la toca directo.

create or replace function public.fn_registrar_historial_reporte_cdp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.casa_de_paz_reporte_historial (reporte_id, iglesia_id, tipo, snapshot_anterior, modificado_por)
  values (
    old.id,
    old.iglesia_id,
    case when new.fecha_eliminacion is not null and old.fecha_eliminacion is null then 'ANULADO' else 'MODIFICADO' end,
    to_jsonb(old),
    auth.uid()
  );
  return new;
end;
$$;

create trigger trg_historial_reporte_cdp
  before update on public.casa_de_paz_reporte
  for each row
  when (old.* is distinct from new.*)
  execute function public.fn_registrar_historial_reporte_cdp();

-- RPC de lectura: solo Pastor/Supervisor de la iglesia del reporte.
create or replace function public.fn_historial_reporte_cdp(p_reporte_id uuid)
returns table (
  id uuid,
  tipo varchar,
  snapshot_anterior jsonb,
  modificado_por_nombre text,
  fecha_creacion timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_iglesia_id uuid;
begin
  -- "r." explicito a proposito: sin alias, "id" es ambiguo entre la columna
  -- de casa_de_paz_reporte y la variable de salida "id" que RETURNS TABLE
  -- crea automaticamente en el ambito de la funcion (bug real encontrado en
  -- verificacion en vivo, 2026-09-17: "column reference id is ambiguous").
  select r.iglesia_id into v_iglesia_id from casa_de_paz_reporte r where r.id = p_reporte_id;

  if v_iglesia_id is null or not (fn_es_super_admin() or fn_es_operativo_en(v_iglesia_id)) then
    raise exception 'HISTORIAL_SIN_PERMISO: se requiere ser Pastor o Supervisor de la Vision en Accion de esta iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select h.id, h.tipo, h.snapshot_anterior,
         coalesce(fn_nombre_completo(p), u.email::text, 'Cuenta eliminada') as modificado_por_nombre,
         h.fecha_creacion
  from casa_de_paz_reporte_historial h
  left join auth.users u on u.id = h.modificado_por
  left join persona p on p.usuario_id = h.modificado_por and p.fecha_eliminacion is null
  where h.reporte_id = p_reporte_id
  order by h.fecha_creacion desc;
end;
$$;

grant execute on function public.fn_historial_reporte_cdp(uuid) to authenticated;

commit;
