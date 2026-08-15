-- VisionHub -- KAN-183: clasificacion automatica de "Simpatizante" por
-- ausencias consecutivas en la misma Casa de Paz.
--
-- Decision del owner (2026-08-15): umbral configurable desde el panel del
-- Supervisor (categoria CDP, igual motor que DIAS_RETENCION_*), default 1
-- ausencia consecutiva. Si la persona vuelve a asistir despues de haber
-- quedado como Simpatizante, pasa automaticamente a Creyente (no queda
-- como reversion manual).
--
-- El estado "Simpatizante" (sigla SIM) y "Creyente" (sigla CRE) ya existen
-- en el catalogo `estado` (seed original) -- no hace falta crearlos.
-- persona_estado.es_automatico ya existia justo para distinguir cambios de
-- estado hechos por el sistema de los hechos a mano.

begin;

insert into public.configuracion_definicion
  (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, modulo, orden)
values
  (
    'AUSENCIAS_SIMPATIZANTE',
    'Ausencias consecutivas para pasar a Simpatizante',
    'Reuniones consecutivas de su propia Casa de Paz en las que una persona no registra asistencia antes de clasificarla automáticamente como Simpatizante. Si vuelve a asistir, pasa de nuevo a Creyente.',
    'NUMERICO', '1', 1, 12, 'reuniones', 'CDP', 1, 92
  )
on conflict (codigo) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, tipo = excluded.tipo,
  valor_defecto = excluded.valor_defecto, valor_min = excluded.valor_min, valor_max = excluded.valor_max,
  unidad = excluded.unidad, categoria = excluded.categoria, modulo = excluded.modulo, orden = excluded.orden;

-- Se llama una vez por reporte guardado (reporte.service.ts, justo despues
-- de guardar el reporte y su asistencia), best-effort desde el frontend --
-- un fallo acá no debe revertir un reporte ya guardado bien.
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
  v_reportes_recientes uuid[];
  v_miembro record;
  v_ausencias_consecutivas int;
  v_estado_activo_id uuid;
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
end;
$function$;

revoke all on function public.fn_recalcular_estados_cdp_reporte(uuid) from public, anon;
grant execute on function public.fn_recalcular_estados_cdp_reporte(uuid) to authenticated;

commit;
