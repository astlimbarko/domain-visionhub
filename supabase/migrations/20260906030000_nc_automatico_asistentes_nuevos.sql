-- VisionHub -- promoción automática a "Nuevo Convertido" (NC) para
-- Asistentes Nuevos con 2 o más asistencias a la misma Casa de Paz.
--
-- Pedido del owner (2026-09-06): a diferencia de convertirse en miembro
-- regular (casa_de_paz_membresia, gateado por bautismo -- ver
-- SugerenciaMiembroRegular.tsx / agregarMiembroRegularCdp, que sigue siendo
-- 100% manual y NO se toca acá), el estado de la persona SÍ debe pasar solo
-- a Nuevo Convertido (NC) apenas junta 2 asistencias a esa CdP, sin
-- preguntarle a nadie. Umbral fijo en 2 (mismo valor que ya usa
-- SugerenciaMiembroRegular) -- explícitamente no configurable por ahora.
--
-- Se engancha en la misma función que ya recalcula SIM<->CRE por
-- asistencia/ausencia (fn_recalcular_estados_cdp_reporte, KAN-183), que ya se
-- llama desde el frontend después de guardar cada reporte -- no hace falta
-- ningún cambio de frontend ni un nuevo punto de invocación.
--
-- Solo aplica a "visitas" (personas que asistieron a este reporte pero no
-- son miembro principal vigente de esta CdP) sin estado o en Simpatizante
-- (orden <= 1): nunca retrocede a alguien que ya esté en NC o más adelante.

create or replace function public.fn_recalcular_estados_cdp_reporte(p_reporte_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cdp_id uuid;
  v_iglesia_id uuid;
  v_umbral int;
  v_estado_sim_id uuid;
  v_estado_cre_id uuid;
  v_estado_nc_id uuid;
  v_reportes_recientes uuid[];
  v_miembro record;
  v_visita record;
  v_ausencias_consecutivas int;
  v_estado_activo_id uuid;
  v_estado_orden_actual int;
  v_total_asistencias int;
begin
  select r.casa_de_paz_id, r.iglesia_id
  into v_cdp_id, v_iglesia_id
  from public.casa_de_paz_reporte r
  where r.id = p_reporte_id and r.fecha_eliminacion is null;

  if v_cdp_id is null or not public.fn_puede_ver_cdp(v_cdp_id) then
    return;
  end if;

  v_umbral := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'AUSENCIAS_SIMPATIZANTE')::int, 1));

  select id into v_estado_sim_id from public.estado where sigla = 'SIM' and fecha_eliminacion is null;
  select id into v_estado_cre_id from public.estado where sigla = 'CRE' and fecha_eliminacion is null;
  if v_estado_sim_id is null or v_estado_cre_id is null then
    return;
  end if;

  select array_agg(id order by fecha_reunion desc, fecha_creacion desc)
  into v_reportes_recientes
  from (
    select id, fecha_reunion, fecha_creacion
    from public.casa_de_paz_reporte
    where casa_de_paz_id = v_cdp_id and fecha_eliminacion is null
    order by fecha_reunion desc, fecha_creacion desc
    limit v_umbral
  ) x;

  for v_miembro in
    select cm.persona_id
    from public.casa_de_paz_membresia cm
    where cm.casa_de_paz_id = v_cdp_id
      and cm.es_principal
      and cm.fecha_fin is null
      and cm.fecha_eliminacion is null
  loop
    if exists (
      select 1 from public.casa_de_paz_asistencia a
      where a.reporte_id = p_reporte_id and a.persona_id = v_miembro.persona_id
        and a.fecha_eliminacion is null
    ) then
      -- Asistio a este reporte: si estaba como Simpatizante, vuelve a ser
      -- Creyente automaticamente.
      select pe.estado_id into v_estado_activo_id
      from public.persona_estado pe
      where pe.persona_id = v_miembro.persona_id
        and pe.fecha_fin is null and pe.fecha_eliminacion is null
      order by pe.fecha_inicio desc
      limit 1;

      if v_estado_activo_id = v_estado_sim_id then
        update public.persona_estado
        set fecha_fin = current_date
        where persona_id = v_miembro.persona_id
          and estado_id = v_estado_sim_id
          and fecha_fin is null and fecha_eliminacion is null;

        insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
        values (v_iglesia_id, v_miembro.persona_id, v_estado_cre_id, current_date, true, 'Volvió a asistir a su Casa de Paz');
      end if;
    elsif v_reportes_recientes is not null and array_length(v_reportes_recientes, 1) >= v_umbral then
      -- No asistio a este reporte: cuenta ausencias consecutivas en los
      -- ultimos v_umbral reportes de la CdP (el actual incluido).
      select count(*)
      into v_ausencias_consecutivas
      from unnest(v_reportes_recientes) as rid
      where not exists (
        select 1 from public.casa_de_paz_asistencia a
        where a.reporte_id = rid and a.persona_id = v_miembro.persona_id
          and a.fecha_eliminacion is null
      );

      if v_ausencias_consecutivas >= v_umbral then
        select pe.estado_id into v_estado_activo_id
        from public.persona_estado pe
        where pe.persona_id = v_miembro.persona_id
          and pe.fecha_fin is null and pe.fecha_eliminacion is null
        order by pe.fecha_inicio desc
        limit 1;

        if v_estado_activo_id is distinct from v_estado_sim_id then
          update public.persona_estado
          set fecha_fin = current_date
          where persona_id = v_miembro.persona_id
            and fecha_fin is null and fecha_eliminacion is null;

          insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          values (v_iglesia_id, v_miembro.persona_id, v_estado_sim_id, current_date, true, 'Ausente en la(s) última(s) reunión(es) de su Casa de Paz');
        end if;
      end if;
    end if;
  end loop;

  -- Promocion automatica a Nuevo Convertido (NC) para Asistentes Nuevos
  -- (visitas sin membresia) con 2 o mas asistencias historicas a esta CdP.
  select id into v_estado_nc_id from public.estado where sigla = 'NC' and fecha_eliminacion is null;

  if v_estado_nc_id is not null then
    for v_visita in
      select distinct a.persona_id
      from public.casa_de_paz_asistencia a
      where a.reporte_id = p_reporte_id and a.fecha_eliminacion is null
        and not exists (
          select 1 from public.casa_de_paz_membresia cm
          where cm.persona_id = a.persona_id and cm.casa_de_paz_id = v_cdp_id
            and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null
        )
    loop
      select e.orden, pe.estado_id
      into v_estado_orden_actual, v_estado_activo_id
      from public.persona_estado pe
      join public.estado e on e.id = pe.estado_id
      where pe.persona_id = v_visita.persona_id
        and pe.fecha_fin is null and pe.fecha_eliminacion is null
      order by pe.fecha_inicio desc
      limit 1;

      -- Sin estado (nunca tuvo) o Simpatizante (orden 1): candidato a
      -- promocion. Ya en NC (orden 2) o mas adelante no se toca -- nunca
      -- retrocede.
      if v_estado_orden_actual is null or v_estado_orden_actual <= 1 then
        select count(*)
        into v_total_asistencias
        from public.casa_de_paz_asistencia a2
        join public.casa_de_paz_reporte r2 on r2.id = a2.reporte_id
        where a2.persona_id = v_visita.persona_id
          and r2.casa_de_paz_id = v_cdp_id
          and a2.fecha_eliminacion is null and r2.fecha_eliminacion is null;

        if v_total_asistencias >= 2 then
          update public.persona_estado
          set fecha_fin = current_date
          where persona_id = v_visita.persona_id
            and fecha_fin is null and fecha_eliminacion is null;

          insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          values (v_iglesia_id, v_visita.persona_id, v_estado_nc_id, current_date, true, 'Alcanzó 2 o más asistencias a la Casa de Paz');
        end if;
      end if;
    end loop;
  end if;
end;
$function$;
