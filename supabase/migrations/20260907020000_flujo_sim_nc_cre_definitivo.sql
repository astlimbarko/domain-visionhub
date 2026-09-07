-- VisionHub -- reescritura completa del ciclo SIM/NC/CRE de Asistentes
-- Nuevos, según spec formal del owner (2026-09-07). Reemplaza por completo
-- el diseño de 20260906030000/20260906040000/20260907000000: esas versiones
-- usaban criterios propios (AUSENCIAS_NC_SIMPATIZANTE,
-- ASISTENCIAS_RETORNO_CREYENTE) que no coincidían con lo que el owner ya
-- veía en el Panel de Supervisor -- reutiliza el criterio VISITAS_PARA_CRE
-- (categoría SSVA, "Estados SSVA" = lo que el equipo llama "Visión en
-- Acción"), que ya existía sin usar.
--
-- Regla final (documento del owner):
--   1. Persona nueva por reporte -> SIM automático.
--   2. SIM junta VISITAS_PARA_CRE asistencias (contadas desde que entró en
--      SIM -- backfill: si no tenía estado, cuenta desde su primera
--      asistencia histórica) -> NC. Aparece en Asistencia Regular.
--   3. NC falta UNA reunión (fijo, no configurable) -> vuelve a SIM. Sale de
--      Asistencia Regular. NC que sigue asistiendo se queda en NC (no pasa
--      a Creyente por asistencia continua -- solo por el camino 4).
--   4. SIM que YA fue NC alguna vez, al juntar de nuevo VISITAS_PARA_CRE
--      asistencias (desde que volvió a SIM) -> CRE, definitivo.
--   5. CRE: permanente, nunca se le vuelve a tocar el estado acá pase lo
--      que pase.
--   6. Nada de esto aplica a quien tiene membresía formal (casa_de_paz_
--      membresia, gateada por bautismo) -- excluidos por construcción.
--
-- fn_personas_de_cdp se reescribe aparte para mostrar también a los SIM
-- (ver 20260907030000).

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
  v_umbral_visitas int;
  v_estado_sim_id uuid;
  v_estado_cre_id uuid;
  v_estado_nc_id uuid;
  v_reportes_recientes uuid[];
  v_miembro record;
  v_visita record;
  v_ausencias_consecutivas int;
  v_estado_activo_id uuid;
  v_fecha_estado_actual date;
  v_asistio_este_reporte boolean;
  v_asistencias_desde_sim int;
  v_fue_nc_alguna_vez boolean;
  v_fecha_primera_asistencia date;
begin
  select r.casa_de_paz_id, r.iglesia_id
  into v_cdp_id, v_iglesia_id
  from public.casa_de_paz_reporte r
  where r.id = p_reporte_id and r.fecha_eliminacion is null;

  if v_cdp_id is null or not public.fn_puede_ver_cdp(v_cdp_id) then
    return;
  end if;

  v_umbral := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'AUSENCIAS_SIMPATIZANTE')::int, 1));
  v_umbral_visitas := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'VISITAS_PARA_CRE')::int, 2));

  select id into v_estado_sim_id from public.estado where sigla = 'SIM' and fecha_eliminacion is null;
  select id into v_estado_cre_id from public.estado where sigla = 'CRE' and fecha_eliminacion is null;
  select id into v_estado_nc_id from public.estado where sigla = 'NC' and fecha_eliminacion is null;
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

  -- Ciclo SIM<->CRE de miembros reales (sin cambios respecto a KAN-183) --
  -- personas con membresía formal, ajenas por completo al ciclo de abajo.
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

  -- Ciclo de Asistentes Nuevos (visitas sin membresía formal).
  for v_visita in
    select distinct a.persona_id
    from public.casa_de_paz_asistencia a
    join public.casa_de_paz_reporte r on r.id = a.reporte_id
    where r.casa_de_paz_id = v_cdp_id and a.fecha_eliminacion is null and r.fecha_eliminacion is null
      and not exists (
        select 1 from public.casa_de_paz_membresia cm
        where cm.persona_id = a.persona_id and cm.casa_de_paz_id = v_cdp_id
          and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null
      )
  loop
    select pe.estado_id, pe.fecha_inicio into v_estado_activo_id, v_fecha_estado_actual
    from public.persona_estado pe
    where pe.persona_id = v_visita.persona_id
      and pe.fecha_fin is null and pe.fecha_eliminacion is null
    order by pe.fecha_inicio desc
    limit 1;

    -- Nunca tuvo estado: registro de Asistente Nuevo -> SIM automático,
    -- con fecha_inicio en su primera asistencia real (no "hoy") para que el
    -- conteo de más abajo arranque desde ahí, incluyendo backfill de
    -- historial previo a este motor.
    if v_estado_activo_id is null then
      select min(r3.fecha_reunion)
      into v_fecha_primera_asistencia
      from public.casa_de_paz_asistencia a3
      join public.casa_de_paz_reporte r3 on r3.id = a3.reporte_id
      where a3.persona_id = v_visita.persona_id and r3.casa_de_paz_id = v_cdp_id
        and a3.fecha_eliminacion is null and r3.fecha_eliminacion is null;

      insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
      values (v_iglesia_id, v_visita.persona_id, v_estado_sim_id, coalesce(v_fecha_primera_asistencia, current_date), true, 'Registrado como Asistente Nuevo');

      v_estado_activo_id := v_estado_sim_id;
      v_fecha_estado_actual := coalesce(v_fecha_primera_asistencia, current_date);
    end if;

    if v_estado_activo_id = v_estado_cre_id then
      -- Creyente: permanente, no se toca nunca más.
      continue;
    end if;

    v_asistio_este_reporte := exists (
      select 1 from public.casa_de_paz_asistencia a
      where a.reporte_id = p_reporte_id and a.persona_id = v_visita.persona_id and a.fecha_eliminacion is null
    );

    if v_estado_activo_id = v_estado_nc_id then
      -- NC que sigue asistiendo se queda NC. NC que falta a la reunión ->
      -- retrocede a SIM (fijo, una sola inasistencia, no configurable).
      if not v_asistio_este_reporte then
        update public.persona_estado
        set fecha_fin = current_date
        where persona_id = v_visita.persona_id and estado_id = v_estado_nc_id
          and fecha_fin is null and fecha_eliminacion is null;

        insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
        values (v_iglesia_id, v_visita.persona_id, v_estado_sim_id, current_date, true, 'Faltó a la reunión siguiente de su Casa de Paz');
      end if;

    elsif v_estado_activo_id = v_estado_sim_id then
      -- SIM: cuenta asistencias desde que entró en este período de SIM. Si
      -- llega al umbral (VISITAS_PARA_CRE), promueve -- a NC si nunca fue
      -- NC antes, a Creyente (definitivo) si ya lo había sido.
      select count(*)
      into v_asistencias_desde_sim
      from public.casa_de_paz_asistencia a4
      join public.casa_de_paz_reporte r4 on r4.id = a4.reporte_id
      where a4.persona_id = v_visita.persona_id
        and r4.casa_de_paz_id = v_cdp_id
        and r4.fecha_reunion >= v_fecha_estado_actual
        and a4.fecha_eliminacion is null and r4.fecha_eliminacion is null;

      if v_asistencias_desde_sim >= v_umbral_visitas then
        v_fue_nc_alguna_vez := exists (
          select 1 from public.persona_estado
          where persona_id = v_visita.persona_id and estado_id = v_estado_nc_id
        );

        update public.persona_estado
        set fecha_fin = current_date
        where persona_id = v_visita.persona_id and estado_id = v_estado_sim_id
          and fecha_fin is null and fecha_eliminacion is null;

        if v_fue_nc_alguna_vez then
          insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          values (v_iglesia_id, v_visita.persona_id, v_estado_cre_id, current_date, true, 'Volvió a asistir tras haber sido Nuevo Convertido');
        else
          insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          values (v_iglesia_id, v_visita.persona_id, v_estado_nc_id, current_date, true, 'Alcanzó el mínimo de asistencias configurado');
        end if;
      end if;
    end if;
  end loop;
end;
$function$;
