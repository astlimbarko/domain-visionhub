-- KAN-479: los chips de KPI en Membresia de Afirmacion (Total/Hombres/
-- Mujeres/Estado/Estado civil/Con profesion/Bautizados/Efesios/Ministerio/
-- Cargos de censo/Edad) siempre mostraban el total global de la iglesia/CdP,
-- sin importar que filtros estuvieran activos en la tabla de abajo. Se pide
-- que sea un filtro facetado en cascada: al tocar un chip, los DEMAS chips
-- recalculan su numero solo dentro del subconjunto ya filtrado.
--
-- Regla aplicada: cada uno de los 9 conteos (total+sexo, por_estado,
-- con_profesion, por_estado_civil, bautizados, por_efesio, con_ministerio,
-- cargos de censo, por_edad) NO se filtra por su PROPIA categoria -- solo
-- aplica los filtros de las OTRAS categorias. Asi el chip activo sigue
-- comparandose contra un total que tiene sentido (ej. si activas "Hombres",
-- el bloque sexo/total sigue mostrando ambos sexos sin auto-filtrarse, pero
-- "Con profesion"/"Bautizados"/"Edad" etc. ya se recalculan solo entre esos
-- hombres).
--
-- Red, Casa de Paz, Via de registro y Cumpleanos no tienen chip propio en
-- esta pantalla (son filtros de columna/tabla, no chips de KPI) -- se tratan
-- como filtros "base", siempre aplicados, nunca excluidos.
--
-- Se elimina el overload viejo de 1 solo parametro (sin p_casa_de_paz_id),
-- huerfano desde 20260917080000_kan386_membresia_scoped_cdp.sql -- nada en
-- el frontend lo llama (obtenerEstadisticasPersonasAfirmacion siempre pasa
-- los 2 parametros).

DROP FUNCTION IF EXISTS public.fn_afirmacion_estadisticas_personas(uuid);

CREATE OR REPLACE FUNCTION public.fn_afirmacion_estadisticas_personas(
  p_iglesia_id uuid,
  p_casa_de_paz_id uuid DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_red_id uuid DEFAULT NULL,
  p_estado_id uuid DEFAULT NULL,
  p_sexo sexo_enum DEFAULT NULL,
  p_via_registro text DEFAULT NULL,
  p_con_profesion boolean DEFAULT NULL,
  p_estado_civil text DEFAULT NULL,
  p_bautizado boolean DEFAULT NULL,
  p_cumpleanos_periodo text DEFAULT NULL,
  p_efesio_tipo text DEFAULT NULL,
  p_con_ministerio boolean DEFAULT NULL,
  p_cargo_censo text DEFAULT NULL,
  p_rango_edad text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_total int;
  v_hombres int;
  v_mujeres int;
  v_por_estado jsonb;
  v_con_profesion int;
  v_por_estado_civil jsonb;
  v_bautizados int;
  v_por_efesio jsonb;
  v_con_ministerio int;
  v_cargo_ministro int;
  v_cargo_anciano int;
  v_cargo_diacono int;
  v_por_edad jsonb;
begin
  if not (
    fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()
    or (p_casa_de_paz_id is not null and fn_puede_ver_cdp(p_casa_de_paz_id))
  ) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  -- 1) total / hombres / mujeres -- excluye el filtro de sexo (es su propio chip)
  select count(*),
         count(*) filter (where p.sexo = 'M'),
         count(*) filter (where p.sexo = 'F')
  into v_total, v_hombres, v_mujeres
  from persona p
  left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
  left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
    and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
    and (p_red_id is null or exists (
      select 1 from casa_de_paz_membresia cm2
      join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
      where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
    ))
    and (p_via_registro is null or (
      select case
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
        else null
      end
      from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
      where pl.persona_id = p.id and pl.fecha_eliminacion is null
      order by pl.fecha_creacion desc limit 1
    ) = p_via_registro)
    and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
    and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
      (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
      or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
      or (p_cumpleanos_periodo = 'SEMANA' and exists (
            select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
            where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
          ))
    )))
    and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
    and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
    and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
    and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
    and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
    and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
    and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
      (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
      or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
      or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
      or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
      or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
    )));

  -- 2) por_estado (SIM/CRE/etc) -- excluye el filtro de estado
  select jsonb_object_agg(coalesce(e.sigla, 'SIN_ESTADO'), conteo)
  into v_por_estado
  from (
    select pe.estado_id, count(*) as conteo
    from persona p
    left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
    left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
    left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
      and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
      and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
      and (p_red_id is null or exists (
        select 1 from casa_de_paz_membresia cm2
        join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
        where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
      ))
      and (p_via_registro is null or (
        select case
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
          else null
        end
        from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
        where pl.persona_id = p.id and pl.fecha_eliminacion is null
        order by pl.fecha_creacion desc limit 1
      ) = p_via_registro)
      and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
      and (p_sexo is null or p.sexo = p_sexo)
      and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
        (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
        or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
        or (p_cumpleanos_periodo = 'SEMANA' and exists (
              select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
              where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
            ))
      )))
      and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
      and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
      and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
      and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
      and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
      and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
      and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
        (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
        or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
        or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
        or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
        or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
      )))
    group by pe.estado_id
  ) c
  left join estado e on e.id = c.estado_id;

  -- 3) con_profesion -- excluye el filtro de con_profesion
  select count(*) filter (where d.ocupacion is not null and btrim(d.ocupacion) <> '')
  into v_con_profesion
  from persona p
  left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
  left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
  left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
    and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
    and (p_red_id is null or exists (
      select 1 from casa_de_paz_membresia cm2
      join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
      where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
    ))
    and (p_via_registro is null or (
      select case
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
        else null
      end
      from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
      where pl.persona_id = p.id and pl.fecha_eliminacion is null
      order by pl.fecha_creacion desc limit 1
    ) = p_via_registro)
    and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
    and (p_sexo is null or p.sexo = p_sexo)
    and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
    and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
      (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
      or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
      or (p_cumpleanos_periodo = 'SEMANA' and exists (
            select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
            where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
          ))
    )))
    and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
    and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
    and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
    and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
    and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
    and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
      (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
      or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
      or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
      or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
      or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
    )));

  -- 4) por_estado_civil -- excluye el filtro de estado_civil
  select jsonb_object_agg(coalesce(d.estado_civil::text, 'SIN_ESTADO_CIVIL'), conteo)
  into v_por_estado_civil
  from (
    select d.estado_civil, count(*) as conteo
    from persona p
    left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
    left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
      and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
      and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
      and (p_red_id is null or exists (
        select 1 from casa_de_paz_membresia cm2
        join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
        where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
      ))
      and (p_via_registro is null or (
        select case
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
          else null
        end
        from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
        where pl.persona_id = p.id and pl.fecha_eliminacion is null
        order by pl.fecha_creacion desc limit 1
      ) = p_via_registro)
      and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
      and (p_sexo is null or p.sexo = p_sexo)
      and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
      and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
        (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
        or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
        or (p_cumpleanos_periodo = 'SEMANA' and exists (
              select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
              where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
            ))
      )))
      and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
      and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
      and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
      and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
      and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
      and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
        (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
        or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
        or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
        or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
        or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
      )))
    group by d.estado_civil
  ) d;

  -- 5) bautizados -- excluye el filtro de bautizado
  select count(*) filter (where coalesce(d.bautizado, false))
  into v_bautizados
  from persona p
  left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
  left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
    and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
    and (p_red_id is null or exists (
      select 1 from casa_de_paz_membresia cm2
      join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
      where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
    ))
    and (p_via_registro is null or (
      select case
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
        else null
      end
      from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
      where pl.persona_id = p.id and pl.fecha_eliminacion is null
      order by pl.fecha_creacion desc limit 1
    ) = p_via_registro)
    and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
    and (p_sexo is null or p.sexo = p_sexo)
    and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
    and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
      (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
      or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
      or (p_cumpleanos_periodo = 'SEMANA' and exists (
            select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
            where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
          ))
    )))
    and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
    and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
    and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
    and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
    and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
    and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
      (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
      or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
      or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
      or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
      or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
    )));

  -- 6) por_efesio -- excluye el filtro de efesio_tipo
  select jsonb_object_agg(pcm.efesio_tipo, conteo)
  into v_por_efesio
  from (
    select pcm.efesio_tipo, count(*) as conteo
    from persona p
    join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
    left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
      and pcm.efesio_tipo is not null
      and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
      and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
      and (p_red_id is null or exists (
        select 1 from casa_de_paz_membresia cm2
        join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
        where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
      ))
      and (p_via_registro is null or (
        select case
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
          else null
        end
        from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
        where pl.persona_id = p.id and pl.fecha_eliminacion is null
        order by pl.fecha_creacion desc limit 1
      ) = p_via_registro)
      and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
      and (p_sexo is null or p.sexo = p_sexo)
      and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
      and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
        (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
        or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
        or (p_cumpleanos_periodo = 'SEMANA' and exists (
              select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
              where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
            ))
      )))
      and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
      and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
      and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
      and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
      and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
      and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
        (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
        or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
        or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
        or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
        or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
      )))
    group by pcm.efesio_tipo
  ) pcm;

  -- 7) con_ministerio -- excluye el filtro de con_ministerio
  select count(*) filter (where exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null))
  into v_con_ministerio
  from persona p
  left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
  left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
    and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
    and (p_red_id is null or exists (
      select 1 from casa_de_paz_membresia cm2
      join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
      where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
    ))
    and (p_via_registro is null or (
      select case
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
        else null
      end
      from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
      where pl.persona_id = p.id and pl.fecha_eliminacion is null
      order by pl.fecha_creacion desc limit 1
    ) = p_via_registro)
    and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
    and (p_sexo is null or p.sexo = p_sexo)
    and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
    and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
      (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
      or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
      or (p_cumpleanos_periodo = 'SEMANA' and exists (
            select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
            where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
          ))
    )))
    and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
    and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
    and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
    and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
    and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
    and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
      (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
      or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
      or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
      or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
      or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
    )));

  -- 8) cargos de censo (ministro/anciano/diacono) -- excluye el filtro de cargo_censo
  select
    count(*) filter (where coalesce(pcm.cargo_ministro, false)),
    count(*) filter (where coalesce(pcm.cargo_anciano, false)),
    count(*) filter (where coalesce(pcm.cargo_diacono, false))
  into v_cargo_ministro, v_cargo_anciano, v_cargo_diacono
  from persona p
  left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
  left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
    and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
    and (p_red_id is null or exists (
      select 1 from casa_de_paz_membresia cm2
      join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
      where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
    ))
    and (p_via_registro is null or (
      select case
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
        when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
        else null
      end
      from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
      where pl.persona_id = p.id and pl.fecha_eliminacion is null
      order by pl.fecha_creacion desc limit 1
    ) = p_via_registro)
    and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
    and (p_sexo is null or p.sexo = p_sexo)
    and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
    and (p_cumpleanos_periodo is null or (p.fecha_nacimiento is not null and (
      (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
      or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
      or (p_cumpleanos_periodo = 'SEMANA' and exists (
            select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
            where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
          ))
    )))
    and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
    and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
    and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
    and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
    and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
    and (p_rango_edad is null or (p.fecha_nacimiento is not null and (
      (p_rango_edad = 'NINOS' and extract(year from age(p.fecha_nacimiento)) between 0 and 11)
      or (p_rango_edad = 'ADOLESCENTES' and extract(year from age(p.fecha_nacimiento)) between 12 and 17)
      or (p_rango_edad = 'JOVENES' and extract(year from age(p.fecha_nacimiento)) between 18 and 30)
      or (p_rango_edad = 'ADULTOS' and extract(year from age(p.fecha_nacimiento)) between 31 and 59)
      or (p_rango_edad = 'MAYORES' and extract(year from age(p.fecha_nacimiento)) >= 60)
    )));

  -- 9) por_edad -- excluye el filtro de rango_edad
  select jsonb_object_agg(rango, conteo)
  into v_por_edad
  from (
    select
      case
        when extract(year from age(p.fecha_nacimiento)) between 0 and 11 then 'NINOS'
        when extract(year from age(p.fecha_nacimiento)) between 12 and 17 then 'ADOLESCENTES'
        when extract(year from age(p.fecha_nacimiento)) between 18 and 30 then 'JOVENES'
        when extract(year from age(p.fecha_nacimiento)) between 31 and 59 then 'ADULTOS'
        else 'MAYORES'
      end as rango,
      count(*) as conteo
    from persona p
    left join persona_detalle d on d.persona_id = p.id and d.fecha_eliminacion is null
    left join persona_censo_membresia pcm on pcm.persona_id = p.id and pcm.fecha_eliminacion is null
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
      and p.fecha_nacimiento is not null
      and not exists (select 1 from evangelismo ev join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null)
      and (p_casa_de_paz_id is null or exists (select 1 from casa_de_paz_membresia cm where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null))
      and (p_red_id is null or exists (
        select 1 from casa_de_paz_membresia cm2
        join casa_de_paz_red cdr2 on cdr2.casa_de_paz_id = cm2.casa_de_paz_id and cdr2.fecha_fin is null and cdr2.fecha_eliminacion is null
        where cm2.persona_id = p.id and cm2.es_principal and cm2.fecha_fin is null and cm2.fecha_eliminacion is null and cdr2.red_id = p_red_id
      ))
      and (p_via_registro is null or (
        select case
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is not null then 'URL'
          when ml.codigo = 'INVITACION_PERSONAL' and pl.casa_paz_url_id is null then 'FORMULARIO'
          else null
        end
        from persona_llegada pl join motivo_llegada ml on ml.id = pl.motivo_llegada_id
        where pl.persona_id = p.id and pl.fecha_eliminacion is null
        order by pl.fecha_creacion desc limit 1
      ) = p_via_registro)
      and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%' or p.ci ilike '%' || p_texto || '%' or p.correo ilike '%' || p_texto || '%')
      and (p_sexo is null or p.sexo = p_sexo)
      and (p_estado_id is null or exists (select 1 from persona_estado pe2 where pe2.persona_id = p.id and pe2.fecha_fin is null and pe2.fecha_eliminacion is null and pe2.estado_id = p_estado_id))
      and (p_cumpleanos_periodo is null or (
        (p_cumpleanos_periodo = 'DIA' and extract(month from p.fecha_nacimiento) = extract(month from current_date) and extract(day from p.fecha_nacimiento) = extract(day from current_date))
        or (p_cumpleanos_periodo = 'MES' and extract(month from p.fecha_nacimiento) = extract(month from current_date))
        or (p_cumpleanos_periodo = 'SEMANA' and exists (
              select 1 from generate_series(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 6, interval '1 day') as dia(d)
              where extract(month from dia.d) = extract(month from p.fecha_nacimiento) and extract(day from dia.d) = extract(day from p.fecha_nacimiento)
            ))
      ))
      and (p_con_profesion is null or (d.ocupacion is not null and btrim(d.ocupacion) <> '') = p_con_profesion)
      and (p_estado_civil is null or d.estado_civil::text = p_estado_civil)
      and (p_bautizado is null or coalesce(d.bautizado, false) = p_bautizado)
      and (p_efesio_tipo is null or pcm.efesio_tipo = p_efesio_tipo)
      and (p_con_ministerio is null or exists (select 1 from ministerio_persona mp where mp.persona_id = p.id and mp.fecha_fin is null and mp.fecha_eliminacion is null) = p_con_ministerio)
      and (p_cargo_censo is null or (p_cargo_censo = 'MINISTRO' and coalesce(pcm.cargo_ministro, false)) or (p_cargo_censo = 'ANCIANO' and coalesce(pcm.cargo_anciano, false)) or (p_cargo_censo = 'DIACONO' and coalesce(pcm.cargo_diacono, false)))
    group by 1
  ) e;

  return jsonb_build_object(
    'total', v_total,
    'hombres', v_hombres,
    'mujeres', v_mujeres,
    'por_estado', coalesce(v_por_estado, '{}'::jsonb),
    'con_profesion', v_con_profesion,
    'por_estado_civil', coalesce(v_por_estado_civil, '{}'::jsonb),
    'bautizados', v_bautizados,
    'por_efesio', coalesce(v_por_efesio, '{}'::jsonb),
    'con_ministerio', v_con_ministerio,
    'cargo_ministro', v_cargo_ministro,
    'cargo_anciano', v_cargo_anciano,
    'cargo_diacono', v_cargo_diacono,
    'por_edad', coalesce(v_por_edad, '{}'::jsonb)
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_estadisticas_personas(uuid, uuid, text, uuid, uuid, sexo_enum, text, boolean, text, boolean, text, text, boolean, text, text) TO authenticated;
