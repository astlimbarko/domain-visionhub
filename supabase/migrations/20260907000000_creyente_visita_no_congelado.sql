-- VisionHub -- corrección del ciclo automático de visitas (2026-09-06):
-- Creyente alcanzado por el camino de "Asistentes Nuevos" NO debía quedar
-- congelado -- el owner probó en vivo y esperaba que, si esa persona deja de
-- asistir, salga de "Asistencia Regular" igual que Nuevo Convertido.
-- Corregido (2026-09-07): Creyente por este camino ahora retrocede a
-- Simpatizante con el mismo umbral configurable de ausencias que ya usa
-- Nuevo Convertido (AUSENCIAS_NC_SIMPATIZANTE) -- no se agrega un criterio
-- nuevo, el pedido fue "igual que NC".
--
-- Sigue sin tocar a las personas que llegaron por el formulario público de
-- membresía (esas ya son miembro real desde el día 1, casa_de_paz_membresia
-- con es_principal=true -- el bucle de visitas las excluye por construcción,
-- ver el "not exists" sobre casa_de_paz_membresia más abajo) ni al ciclo de
-- miembros reales (KAN-183, sin cambios).

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
  v_umbral_nc_sim int;
  v_umbral_ret_cre int;
  v_estado_sim_id uuid;
  v_estado_cre_id uuid;
  v_estado_nc_id uuid;
  v_reportes_recientes uuid[];
  v_reportes_recientes_nc_sim uuid[];
  v_reportes_recientes_ret_cre uuid[];
  v_miembro record;
  v_visita record;
  v_ausencias_consecutivas int;
  v_asistencias_consecutivas int;
  v_estado_activo_id uuid;
  v_asistio_este_reporte boolean;
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
  v_umbral_nc_sim := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'AUSENCIAS_NC_SIMPATIZANTE')::int, 1));
  v_umbral_ret_cre := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'ASISTENCIAS_RETORNO_CREYENTE')::int, 1));

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

  -- Ciclo SIM<->CRE de miembros reales (sin cambios respecto a KAN-183).
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

  -- Ciclo de Asistentes Nuevos (visitas sin membresía): SIM/nada -> NC (2
  -- asistencias históricas, fijo) -> Simpatizante (ausencia, configurable) o
  -- Creyente (asistencia tras haber sido NC alguna vez, configurable). A
  -- diferencia de la versión anterior, Creyente por este camino YA NO queda
  -- congelado: si falta, retrocede a Simpatizante con el mismo umbral que
  -- Nuevo Convertido (2026-09-07, corrección pedida por el owner tras
  -- probarlo en vivo).
  if v_estado_nc_id is not null then
    select array_agg(id order by fecha_reunion desc, fecha_creacion desc)
    into v_reportes_recientes_nc_sim
    from (
      select id, fecha_reunion, fecha_creacion
      from public.casa_de_paz_reporte
      where casa_de_paz_id = v_cdp_id and fecha_eliminacion is null
      order by fecha_reunion desc, fecha_creacion desc
      limit v_umbral_nc_sim
    ) x;

    select array_agg(id order by fecha_reunion desc, fecha_creacion desc)
    into v_reportes_recientes_ret_cre
    from (
      select id, fecha_reunion, fecha_creacion
      from public.casa_de_paz_reporte
      where casa_de_paz_id = v_cdp_id and fecha_eliminacion is null
      order by fecha_reunion desc, fecha_creacion desc
      limit v_umbral_ret_cre
    ) x;

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
      select pe.estado_id into v_estado_activo_id
      from public.persona_estado pe
      where pe.persona_id = v_visita.persona_id
        and pe.fecha_fin is null and pe.fecha_eliminacion is null
      order by pe.fecha_inicio desc
      limit 1;

      v_asistio_este_reporte := exists (
        select 1 from public.casa_de_paz_asistencia a
        where a.reporte_id = p_reporte_id and a.persona_id = v_visita.persona_id and a.fecha_eliminacion is null
      );

      if v_estado_activo_id = v_estado_nc_id
         or v_estado_activo_id = v_estado_cre_id
         or (v_estado_activo_id = v_estado_sim_id and exists (
              select 1 from public.persona_estado where persona_id = v_visita.persona_id and estado_id = v_estado_nc_id
            )) then

        if v_asistio_este_reporte then
          if v_estado_activo_id is distinct from v_estado_cre_id
             and v_reportes_recientes_ret_cre is not null and array_length(v_reportes_recientes_ret_cre, 1) >= v_umbral_ret_cre then
            select count(*)
            into v_asistencias_consecutivas
            from unnest(v_reportes_recientes_ret_cre) as rid
            where exists (
              select 1 from public.casa_de_paz_asistencia a3
              where a3.reporte_id = rid and a3.persona_id = v_visita.persona_id and a3.fecha_eliminacion is null
            );

            if v_asistencias_consecutivas >= v_umbral_ret_cre then
              update public.persona_estado
              set fecha_fin = current_date
              where persona_id = v_visita.persona_id and fecha_fin is null and fecha_eliminacion is null;

              insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
              values (v_iglesia_id, v_visita.persona_id, v_estado_cre_id, current_date, true, 'Volvió a asistir tras haber sido Nuevo Convertido');
            end if;
          end if;
        elsif v_estado_activo_id = v_estado_nc_id or v_estado_activo_id = v_estado_cre_id then
          if v_reportes_recientes_nc_sim is not null and array_length(v_reportes_recientes_nc_sim, 1) >= v_umbral_nc_sim then
            select count(*)
            into v_ausencias_consecutivas
            from unnest(v_reportes_recientes_nc_sim) as rid
            where not exists (
              select 1 from public.casa_de_paz_asistencia a2
              where a2.reporte_id = rid and a2.persona_id = v_visita.persona_id and a2.fecha_eliminacion is null
            );

            if v_ausencias_consecutivas >= v_umbral_nc_sim then
              update public.persona_estado
              set fecha_fin = current_date
              where persona_id = v_visita.persona_id and estado_id = v_estado_activo_id
                and fecha_fin is null and fecha_eliminacion is null;

              insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
              values (v_iglesia_id, v_visita.persona_id, v_estado_sim_id, current_date, true, 'Faltó a la(s) última(s) reunión(es) de su Casa de Paz');
            end if;
          end if;
        end if;

      elsif v_asistio_este_reporte and (v_estado_activo_id is null or v_estado_activo_id = v_estado_sim_id) then
        -- Nunca fue NC: umbral fijo de 2 asistencias históricas (2026-09-06,
        -- no configurable a pedido del owner).
        select count(*)
        into v_total_asistencias
        from public.casa_de_paz_asistencia a4
        join public.casa_de_paz_reporte r4 on r4.id = a4.reporte_id
        where a4.persona_id = v_visita.persona_id
          and r4.casa_de_paz_id = v_cdp_id
          and a4.fecha_eliminacion is null and r4.fecha_eliminacion is null;

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
