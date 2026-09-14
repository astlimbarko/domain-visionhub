-- VisionHub -- KAN-367 (Fase 3): escape para Pastor / Supervisor de la
-- Vision en Accion, para editar un reporte de CdP fuera de la ventana
-- normal (30 dias desde fecha_creacion) -- pedido explicito del owner,
-- 2026-09-14: "que el sistema le pida explicaciones y que le pida editar
-- con codigo OTP".
--
-- Diseno: en vez de duplicar todo el flujo de actualizarReporte (reporte +
-- asistencia + ingresos + evangelizados), se agrega una autorizacion
-- puntual, de corta duracion, que fn_puede_editar_reporte_cdp reconoce como
-- una via mas -- una vez autorizado, todo el resto de la maquinaria de
-- edicion existente (RLS de casa_de_paz_reporte/asistencia,
-- fn_registrar_ingresos_reporte) ya funciona sola, porque todos consultan
-- la misma funcion.

begin;

create table if not exists public.reporte_autorizacion_edicion (
  id             uuid primary key default gen_random_uuid(),
  reporte_id     uuid not null references public.casa_de_paz_reporte(id),
  autorizado_por uuid not null references auth.users(id),
  justificacion  text not null,
  fecha_creacion timestamptz not null default now()
);

create index if not exists idx_reporte_autorizacion_edicion_reporte
  on public.reporte_autorizacion_edicion (reporte_id, autorizado_por, fecha_creacion desc);

-- Registro de auditoria: nunca se borra ni se modifica (mismo criterio que
-- el resto del proyecto -- trg_no_delete/fn_bloquear_delete).
create trigger trg_no_delete_reporte_autorizacion_edicion
  before delete on public.reporte_autorizacion_edicion
  for each row execute function public.fn_bloquear_delete();

alter table public.reporte_autorizacion_edicion enable row level security;

-- Solo lectura de las propias autorizaciones (o de Pastor/Supervisor en su
-- iglesia, para poder auditar) -- la escritura es exclusiva de
-- fn_autorizar_edicion_reporte_fuera_ventana (SECURITY DEFINER).
create policy pol_reporte_autorizacion_edicion_select on public.reporte_autorizacion_edicion for select
using (
  autorizado_por = auth.uid()
  or exists (
    select 1 from casa_de_paz_reporte r
    where r.id = reporte_autorizacion_edicion.reporte_id
      and (fn_es_pastor_en(r.iglesia_id) or fn_es_supervisor_en(r.iglesia_id))
  )
);

create or replace function public.fn_autorizar_edicion_reporte_fuera_ventana(
  p_reporte_id uuid,
  p_justificacion text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_iglesia_id uuid;
begin
  select iglesia_id into v_iglesia_id from casa_de_paz_reporte
  where id = p_reporte_id and fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'REPORTE_INEXISTENTE: el reporte no existe o fue eliminado' using errcode = 'P0001';
  end if;

  if not (fn_es_pastor_en(v_iglesia_id) or fn_es_supervisor_en(v_iglesia_id)) then
    raise exception 'REPORTE_SOLO_PASTOR_SUPERVISOR: solo Pastor o Supervisor de la Vision en Accion puede editar un reporte fuera de la ventana normal'
      using errcode = 'P0001';
  end if;

  if p_justificacion is null or btrim(p_justificacion) = '' then
    raise exception 'REPORTE_JUSTIFICACION_OBLIGATORIA: se requiere un motivo para editar fuera de la ventana normal'
      using errcode = 'P0001';
  end if;

  if not fn_verificar_otp(p_pin) then
    raise exception 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      using errcode = 'P0001';
  end if;

  insert into reporte_autorizacion_edicion (reporte_id, autorizado_por, justificacion)
  values (p_reporte_id, auth.uid(), btrim(p_justificacion));
end;
$function$;

grant execute on function public.fn_autorizar_edicion_reporte_fuera_ventana(uuid, text, text) to authenticated;

-- fn_puede_editar_reporte_cdp: se agrega la 4ta via -- autorizacion vigente
-- (15 minutos, tiempo suficiente para completar la edicion en pantalla) de
-- Pastor/Supervisor sobre ESE reporte puntual.
create or replace function public.fn_puede_editar_reporte_cdp(p_reporte_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    (
      fn_es_super_admin()
      or (
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_CDP')::int
        and (fn_es_lider_cdp(r.casa_de_paz_id) or fn_es_sublider_cdp(r.casa_de_paz_id))
      )
      or (
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        and exists (
          select 1 from casa_de_paz_red cdr
          where cdr.casa_de_paz_id = r.casa_de_paz_id
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
            and fn_es_lider_de_red(cdr.red_id)
        )
      )
      or (
        r.fecha_creacion::date >= current_date - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        and (fn_es_pastor_en(r.iglesia_id) or fn_es_supervisor_en(r.iglesia_id))
      )
      or exists (
        select 1 from reporte_autorizacion_edicion a
        where a.reporte_id = r.id
          and a.autorizado_por = auth.uid()
          and a.fecha_creacion >= now() - interval '15 minutes'
      )
    )
  from casa_de_paz_reporte r
  where r.id = p_reporte_id and r.fecha_eliminacion is null;
$$;

grant execute on function public.fn_puede_editar_reporte_cdp(uuid) to authenticated;

-- fn_puede_solicitar_edicion_fuera_ventana: para que el frontend sepa si
-- mostrarle a este usuario la opcion de "pedir autorizacion" cuando
-- fn_puede_editar_reporte_cdp da false (evita ofrecerle el flujo de OTP a
-- un Lider/Sublider de CdP o Lider de Red, que no tienen este escape).
create or replace function public.fn_puede_solicitar_edicion_fuera_ventana(p_reporte_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select fn_es_pastor_en(r.iglesia_id) or fn_es_supervisor_en(r.iglesia_id)
  from casa_de_paz_reporte r
  where r.id = p_reporte_id and r.fecha_eliminacion is null;
$$;

grant execute on function public.fn_puede_solicitar_edicion_fuera_ventana(uuid) to authenticated;

commit;
