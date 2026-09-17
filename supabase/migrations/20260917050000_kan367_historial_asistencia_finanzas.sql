-- VisionHub -- KAN-367 (pedido explicito del owner, 2026-09-17):
-- El historial de cambios (20260917030000) solo capturaba los campos propios
-- de casa_de_paz_reporte (tema, disertador, testimonios, comentarios) -- no
-- asistencia ni finanzas, que son justo lo que mas le preocupa a Supervision
-- poder auditar (ej. caso Viviana). Se extiende el snapshot para incluir
-- tambien la asistencia y los ingresos (ofrenda + diezmos por persona) tal
-- como estaban ANTES del cambio.

begin;

-- ============================================================
-- 1) fn_anular_reporte_cdp: reordenar los 2 UPDATE -- el de
--    casa_de_paz_reporte (que dispara el trigger de historial) va PRIMERO,
--    para que el snapshot capture la asistencia todavia sin dar de baja.
--    Antes el orden era al reves y el snapshot de un ANULADO quedaba vacio
--    en asistencia (ya se habia soft-eliminado un paso antes).
-- ============================================================

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

  update casa_de_paz_reporte set fecha_eliminacion = now(), eliminado_por = auth.uid()
  where id = p_reporte_id;

  update casa_de_paz_asistencia set fecha_eliminacion = now(), eliminado_por = auth.uid()
  where reporte_id = p_reporte_id and fecha_eliminacion is null;
end;
$function$;

grant execute on function public.fn_anular_reporte_cdp(uuid) to authenticated;

-- ============================================================
-- 2) fn_registrar_historial_reporte_cdp: snapshot enriquecido.
--    Se ejecuta BEFORE UPDATE de casa_de_paz_reporte -- en el flujo normal de
--    edicion (actualizarReporte en el frontend) ese UPDATE es el PRIMERO que
--    corre, antes de tocar casa_de_paz_asistencia/finanzas_ingreso, asi que
--    en ambos casos (editar y anular, ya reordenado arriba) esas tablas
--    todavia reflejan el estado ANTERIOR en el momento en que se arma el
--    snapshot.
-- ============================================================

create or replace function public.fn_registrar_historial_reporte_cdp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_asistencia jsonb;
  v_ingresos   jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'persona_id', a.persona_id,
           'es_visita', a.es_visita,
           'es_menor', a.es_menor,
           'nombre_completo', fn_nombre_completo(p)
         ) order by fn_nombre_completo(p)), '[]'::jsonb)
    into v_asistencia
    from casa_de_paz_asistencia a
    join persona p on p.id = a.persona_id
    where a.reporte_id = old.id and a.fecha_eliminacion is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', ti.codigo,
           'persona_id', fi.persona_id,
           'nombre_completo', fn_nombre_completo(p),
           'monto', fi.monto
         ) order by ti.codigo, fn_nombre_completo(p)), '[]'::jsonb)
    into v_ingresos
    from finanzas_ingreso fi
    join finanzas_tipo_ingreso ti on ti.id = fi.tipo_ingreso_id
    left join persona p on p.id = fi.persona_id
    where fi.reporte_id = old.id and fi.fecha_eliminacion is null;

  insert into public.casa_de_paz_reporte_historial (reporte_id, iglesia_id, tipo, snapshot_anterior, modificado_por)
  values (
    old.id,
    old.iglesia_id,
    case when new.fecha_eliminacion is not null and old.fecha_eliminacion is null then 'ANULADO' else 'MODIFICADO' end,
    jsonb_build_object(
      'reporte', to_jsonb(old),
      'asistencia', v_asistencia,
      'ingresos', v_ingresos
    ),
    auth.uid()
  );
  return new;
end;
$$;

commit;
