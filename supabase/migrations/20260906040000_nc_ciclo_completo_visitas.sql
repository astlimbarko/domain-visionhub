-- VisionHub -- ciclo completo de estado automático para "Asistentes Nuevos"
-- (visitas sin membresía, la membresía formal sigue atada al bautismo y es
-- manual -- SugerenciaMiembroRegular no se toca).
--
-- Pedido del owner (2026-09-06), a continuación de la promoción automática a
-- Nuevo Convertido (NC) con 2 asistencias (20260906030000):
--   - NC + falta a la siguiente reunión (umbral configurable, categoría CDP,
--     mismo motor que AUSENCIAS_SIMPATIZANTE) -> retrocede a Simpatizante.
--   - Una vez que la persona YA fue NC alguna vez, la próxima vez que asista
--     (aunque haya bajado a Simpatizante en el medio) pasa DIRECTO a
--     Creyente -- no vuelve a pasar por NC. Umbral de asistencias también
--     configurable.
--   - Creyente por este camino queda congelado: no se le vuelve a tocar el
--     estado automáticamente acá. Si en algún momento consigue membresía
--     real (bautismo), pasa a regirse por el ciclo de miembros existente
--     (fn_recalcular_estados_cdp_reporte ya cubre SIM<->CRE para miembros).
--
-- Además, "Asistencia Regular" del reporte (obtenerMiembrosCdp en el
-- frontend) se amplía para incluir a estas visitas ya NC/Creyente, sin
-- crear membresía formal -- fn_visitas_regulares_cdp nueva, consumida desde
-- reporte.service.ts.

begin;

insert into public.configuracion_definicion
  (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, modulo, orden)
values
  (
    'AUSENCIAS_NC_SIMPATIZANTE',
    'Ausencias para retroceder de Nuevo Convertido a Simpatizante',
    'Reuniones consecutivas de la Casa de Paz en las que un Asistente Nuevo clasificado como Nuevo Convertido no registra asistencia antes de retroceder automáticamente a Simpatizante.',
    'NUMERICO', '1', 1, 12, 'reuniones', 'CDP', 1, 93
  ),
  (
    'ASISTENCIAS_RETORNO_CREYENTE',
    'Asistencias para pasar a Creyente tras haber sido Nuevo Convertido',
    'Reuniones consecutivas a las que debe asistir un Asistente Nuevo que alguna vez fue Nuevo Convertido (aunque haya retrocedido a Simpatizante) antes de clasificarlo automáticamente como Creyente, de forma definitiva.',
    'NUMERICO', '1', 1, 12, 'reuniones', 'CDP', 1, 94
  )
on conflict (codigo) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, tipo = excluded.tipo,
  valor_defecto = excluded.valor_defecto, valor_min = excluded.valor_min, valor_max = excluded.valor_max,
  unidad = excluded.unidad, categoria = excluded.categoria, modulo = excluded.modulo, orden = excluded.orden;

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
  -- Creyente (asistencia tras haber sido NC alguna vez, configurable,
  -- definitivo).
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

      if v_estado_activo_id = v_estado_cre_id then
        -- Creyente por este camino: congelado, no se toca acá.
        null;

      elsif v_estado_activo_id = v_estado_nc_id
         or (v_estado_activo_id = v_estado_sim_id and exists (
              select 1 from public.persona_estado where persona_id = v_visita.persona_id and estado_id = v_estado_nc_id
            )) then
        if v_asistio_este_reporte then
          if v_reportes_recientes_ret_cre is not null and array_length(v_reportes_recientes_ret_cre, 1) >= v_umbral_ret_cre then
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
        elsif v_estado_activo_id = v_estado_nc_id then
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
              where persona_id = v_visita.persona_id and estado_id = v_estado_nc_id
                and fecha_fin is null and fecha_eliminacion is null;

              insert into public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
              values (v_iglesia_id, v_visita.persona_id, v_estado_sim_id, current_date, true, 'Faltó a la(s) última(s) reunión(es) tras ser Nuevo Convertido');
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

-- Roster de "visitas" (sin membresía formal) que ya alcanzaron NC/Creyente,
-- para sumarlas a "Asistencia Regular" del reporte sin crear membresía --
-- consumido desde obtenerMiembrosCdp (reporte.service.ts). Mismo permiso de
-- lectura que ya exige el reporte (fn_puede_ver_cdp).
create or replace function public.fn_visitas_regulares_cdp(p_casa_de_paz_id uuid)
returns table(persona_id uuid, nombre_completo text, tiene_fecha_nacimiento boolean, edad int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_orden_nc int;
begin
  if not fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  select orden into v_orden_nc from estado where sigla = 'NC' and fecha_eliminacion is null;
  if v_orden_nc is null then
    return;
  end if;

  return query
  select p.id, fn_nombre_completo(p), p.fecha_nacimiento is not null,
         case when p.fecha_nacimiento is null then null
              else extract(year from age(p.fecha_nacimiento))::int end
  from persona p
  join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
  join estado e on e.id = pe.estado_id
  where p.fecha_eliminacion is null
    and e.orden >= v_orden_nc
    and exists (
      select 1 from casa_de_paz_asistencia a
      join casa_de_paz_reporte r on r.id = a.reporte_id
      where a.persona_id = p.id and r.casa_de_paz_id = p_casa_de_paz_id
        and a.fecha_eliminacion is null and r.fecha_eliminacion is null
    )
    and not exists (
      select 1 from casa_de_paz_membresia cm
      where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id
        and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null
    );
end;
$$;

grant execute on function public.fn_visitas_regulares_cdp(uuid) to authenticated;

commit;
