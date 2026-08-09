-- VisionHub â€” KAN-135: autorizaciÃ³n exacta por Red y Casa de Paz.
-- No modifica datos. Evita lecturas de entidades hermanas mediante IDs manipulados.

begin;

create or replace function public.fn_puede_ver_red(p_red_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.red r
    where r.id = p_red_id
      and (
        public.fn_es_super_admin()
        or public.fn_es_pastor_en(r.iglesia_id)
        or public.fn_es_operativo_en(r.iglesia_id)
        or public.fn_es_lider_de_red(r.id)
        or exists (
          select 1
          from public.casa_de_paz_red cdr
          join public.casa_de_paz_cargo cc
            on cc.casa_de_paz_id = cdr.casa_de_paz_id
          join public.cargo ca on ca.id = cc.cargo_id
          where cdr.red_id = r.id
            and cdr.fecha_fin is null
            and cdr.fecha_eliminacion is null
            and cc.persona_id = public.fn_mi_persona_id()
            and ca.codigo in ('LIDER_CDP', 'SUBLIDER_CDP')
            and cc.fecha_fin is null
            and cc.fecha_eliminacion is null
        )
      )
  );
$$;

revoke all on function public.fn_puede_ver_red(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_puede_ver_red(uuid) to authenticated;

create or replace function public.fn_puede_ver_cdp(p_casa_de_paz_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.casa_de_paz cdp
    where cdp.id = p_casa_de_paz_id
      and (
        public.fn_es_super_admin()
        or public.fn_es_pastor_en(cdp.iglesia_id)
        or public.fn_es_operativo_en(cdp.iglesia_id)
        or public.fn_es_lider_cdp(cdp.id)
        or public.fn_es_sublider_cdp(cdp.id)
        or exists (
          select 1
          from public.casa_de_paz_red cdr
          where cdr.casa_de_paz_id = cdp.id
            and cdr.fecha_fin is null
            and cdr.fecha_eliminacion is null
            and public.fn_es_lider_de_red(cdr.red_id)
        )
      )
  );
$$;

revoke all on function public.fn_puede_ver_cdp(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_puede_ver_cdp(uuid) to authenticated;

create or replace function public.fn_listar_redes(p_iglesia_id uuid)
returns table(
  id uuid, nombre character varying, activo boolean, color character,
  lider_nombre text, encargado_departamentos_nombre text,
  encargado_ministerio_nombre text, cantidad_cdp bigint, incompleta boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    r.id, r.nombre, r.activo, r.color,
    (select public.fn_nombre_completo(p) from public.persona p
     join public.red_cargo rc on rc.persona_id = p.id
     join public.cargo c on c.id = rc.cargo_id
     where rc.red_id = r.id and c.codigo = 'LIDER_RED'
       and rc.fecha_fin is null and rc.fecha_eliminacion is null limit 1),
    (select public.fn_nombre_completo(p) from public.persona p
     join public.red_cargo rc on rc.persona_id = p.id
     join public.cargo c on c.id = rc.cargo_id
     where rc.red_id = r.id and c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
       and rc.fecha_fin is null and rc.fecha_eliminacion is null limit 1),
    (select public.fn_nombre_completo(p) from public.persona p
     join public.red_cargo rc on rc.persona_id = p.id
     join public.cargo c on c.id = rc.cargo_id
     where rc.red_id = r.id and c.codigo = 'ENCARGADO_MINISTERIO_RED'
       and rc.fecha_fin is null and rc.fecha_eliminacion is null limit 1),
    (select count(*) from public.casa_de_paz_red cdr
     join public.casa_de_paz c on c.id = cdr.casa_de_paz_id
     where cdr.red_id = r.id and cdr.fecha_fin is null
       and cdr.fecha_eliminacion is null and c.activo),
    coalesce(fi.falta_departamentos or fi.falta_ministerio, false)
  from public.red r
  left join public.fn_redes_incompletas(p_iglesia_id) fi on fi.red_id = r.id
  where r.iglesia_id = p_iglesia_id
    and r.fecha_eliminacion is null
    and public.fn_puede_ver_red(r.id)
  order by r.nombre;
$$;

revoke all on function public.fn_listar_redes(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_listar_redes(uuid) to authenticated;

create or replace function public.fn_listar_cdp(
  p_iglesia_id uuid,
  p_red_id uuid default null
)
returns table(
  id uuid, etiqueta text, activo boolean, modalidad public.modalidad_cdp_enum,
  red_id uuid, red_nombre character varying, lider_id uuid, lider_nombre text,
  anfitrion_id uuid, anfitrion_nombre text, sublideres_count bigint,
  miembros_count bigint, dia_reunion smallint
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id, public.fn_etiqueta_cdp(c.id), c.activo, c.modalidad, cdr.red_id, r.nombre,
    (select p.id from public.persona p
     join public.casa_de_paz_cargo cc on cc.persona_id = p.id
     join public.cargo ca on ca.id = cc.cargo_id
     where cc.casa_de_paz_id = c.id and ca.codigo = 'LIDER_CDP'
       and cc.fecha_fin is null and cc.fecha_eliminacion is null limit 1),
    (select public.fn_nombre_completo(p) from public.persona p
     join public.casa_de_paz_cargo cc on cc.persona_id = p.id
     join public.cargo ca on ca.id = cc.cargo_id
     where cc.casa_de_paz_id = c.id and ca.codigo = 'LIDER_CDP'
       and cc.fecha_fin is null and cc.fecha_eliminacion is null limit 1),
    (select p.id from public.persona p
     join public.casa_de_paz_cargo cc on cc.persona_id = p.id
     join public.cargo ca on ca.id = cc.cargo_id
     where cc.casa_de_paz_id = c.id and ca.codigo = 'ANFITRION'
       and cc.fecha_fin is null and cc.fecha_eliminacion is null limit 1),
    (select public.fn_nombre_completo(p) from public.persona p
     join public.casa_de_paz_cargo cc on cc.persona_id = p.id
     join public.cargo ca on ca.id = cc.cargo_id
     where cc.casa_de_paz_id = c.id and ca.codigo = 'ANFITRION'
       and cc.fecha_fin is null and cc.fecha_eliminacion is null limit 1),
    (select count(*) from public.casa_de_paz_cargo cc
     join public.cargo ca on ca.id = cc.cargo_id
     where cc.casa_de_paz_id = c.id and ca.codigo = 'SUBLIDER_CDP'
       and cc.fecha_fin is null and cc.fecha_eliminacion is null),
    (select count(*) from public.casa_de_paz_membresia m
     where m.casa_de_paz_id = c.id and m.fecha_fin is null
       and m.fecha_eliminacion is null),
    c.dia_reunion
  from public.casa_de_paz c
  left join public.casa_de_paz_red cdr
    on cdr.casa_de_paz_id = c.id
   and cdr.fecha_fin is null
   and cdr.fecha_eliminacion is null
  left join public.red r on r.id = cdr.red_id
  where c.iglesia_id = p_iglesia_id
    and c.fecha_eliminacion is null
    and (p_red_id is null or cdr.red_id = p_red_id)
    and public.fn_puede_ver_cdp(c.id)
  order by r.nombre nulls last, lider_nombre nulls last;
$$;

revoke all on function public.fn_listar_cdp(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_listar_cdp(uuid, uuid) to authenticated;

create or replace function public.fn_ingresos_cdp(
  p_casa_de_paz_id uuid, p_desde date, p_hasta date
)
returns table(
  tipo_codigo character varying, tipo_nombre character varying,
  moneda_codigo character, moneda_simbolo character varying, total numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.fn_puede_ver_ingresos_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE: sin acceso a los ingresos de la casa de paz %', p_casa_de_paz_id
      using errcode = 'P0001';
  end if;

  return query
  select t.codigo, t.nombre, m.codigo, m.simbolo, sum(i.monto)
  from public.finanzas_ingreso i
  join public.finanzas_tipo_ingreso t on t.id = i.tipo_ingreso_id
  join public.moneda m on m.id = i.moneda_id
  where i.casa_de_paz_id = p_casa_de_paz_id
    and i.fecha between p_desde and p_hasta
    and i.fecha_eliminacion is null
  group by t.codigo, t.nombre, m.codigo, m.simbolo, t.orden, m.orden
  order by t.orden, m.orden;
end;
$$;

revoke all on function public.fn_ingresos_cdp(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.fn_ingresos_cdp(uuid, date, date) to authenticated;

create or replace function public.fn_ingresos_comparativo(
  p_casa_de_paz_id uuid, p_desde date, p_hasta date
)
returns table(
  moneda_id uuid, moneda_codigo character, total_actual numeric,
  total_anterior numeric, variacion_pct numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.fn_puede_ver_ingresos_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE: sin acceso a los ingresos de la casa de paz %', p_casa_de_paz_id
      using errcode = 'P0001';
  end if;

  return query
  with dias as (
    select (p_hasta - p_desde) as n
  ), actual as (
    select i.moneda_id, sum(i.monto) as total
    from public.finanzas_ingreso i
    where i.casa_de_paz_id = p_casa_de_paz_id
      and i.fecha between p_desde and p_hasta
      and i.fecha_eliminacion is null
    group by i.moneda_id
  ), anterior as (
    select i.moneda_id, sum(i.monto) as total
    from public.finanzas_ingreso i, dias d
    where i.casa_de_paz_id = p_casa_de_paz_id
      and i.fecha between (p_desde - d.n - 1) and (p_desde - 1)
      and i.fecha_eliminacion is null
    group by i.moneda_id
  ), monedas as (
    select actual.moneda_id from actual
    union
    select anterior.moneda_id from anterior
  )
  select mo.moneda_id, m.codigo,
         coalesce(a.total, 0), coalesce(p.total, 0),
         case when coalesce(p.total, 0) = 0 then null
              else round(((coalesce(a.total, 0) - p.total) / p.total) * 100, 2)
         end
  from monedas mo
  join public.moneda m on m.id = mo.moneda_id
  left join actual a on a.moneda_id = mo.moneda_id
  left join anterior p on p.moneda_id = mo.moneda_id;
end;
$$;

revoke all on function public.fn_ingresos_comparativo(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.fn_ingresos_comparativo(uuid, date, date) to authenticated;

create or replace function public.fn_eventos_cdp(
  p_casa_de_paz_id uuid,
  p_desde date,
  p_hasta date,
  p_tipo_evento_id uuid default null
)
returns table(
  id uuid, titulo character varying, descripcion text,
  tipo_codigo character varying, tipo_nombre character varying,
  color character, icono character varying, fecha_inicio date, fecha_fin date,
  hora_inicio time without time zone, hora_fin time without time zone,
  es_multi_dia boolean, ambito character varying
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select cdp.iglesia_id into v_iglesia_id
  from public.casa_de_paz cdp
  where cdp.id = p_casa_de_paz_id;

  if v_iglesia_id is null or not public.fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      using errcode = 'P0001';
  end if;

  return query
  select e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         coalesce(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio,
         case when e.red_id is not null then 'RED'
              when e.casa_de_paz_id is not null then 'CDP'
              else 'IGLESIA' end::character varying
  from public.evento e
  join public.tipo_evento t on t.id = e.tipo_evento_id
  where e.fecha_eliminacion is null
    and (
      e.casa_de_paz_id = p_casa_de_paz_id
      or e.red_id = (
        select cdr.red_id
        from public.casa_de_paz_red cdr
        where cdr.casa_de_paz_id = p_casa_de_paz_id
          and cdr.fecha_fin is null
          and cdr.fecha_eliminacion is null
      )
      or (e.casa_de_paz_id is null and e.red_id is null and e.iglesia_id = v_iglesia_id)
    )
    and daterange(e.fecha_inicio, coalesce(e.fecha_fin, e.fecha_inicio), '[]')
        && daterange(p_desde, p_hasta, '[]')
    and (p_tipo_evento_id is null or e.tipo_evento_id = p_tipo_evento_id)
  order by e.fecha_inicio, e.hora_inicio nulls last;
end;
$$;

revoke all on function public.fn_eventos_cdp(uuid, date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_eventos_cdp(uuid, date, date, uuid) to authenticated;

create or replace function public.fn_cumpleanos_cdp(
  p_casa_de_paz_id uuid, p_desde date, p_hasta date
)
returns table(
  persona_id uuid, nombre text, fecha_cumpleanos date, edad_cumple integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      using errcode = 'P0001';
  end if;

  return query
  with anios as (
    select generate_series(extract(year from p_desde)::int, extract(year from p_hasta)::int) as anio
  ), miembros as (
    select p.id, p.fecha_nacimiento, public.fn_nombre_completo(p) as nombre
    from public.casa_de_paz_membresia m
    join public.persona p on p.id = m.persona_id
    where m.casa_de_paz_id = p_casa_de_paz_id
      and m.fecha_fin is null and m.fecha_eliminacion is null
      and p.fecha_nacimiento is not null and p.fecha_eliminacion is null
  ), cumples as (
    select mi.id, mi.nombre, mi.fecha_nacimiento,
      make_date(
        a.anio,
        extract(month from mi.fecha_nacimiento)::int,
        case
          when extract(month from mi.fecha_nacimiento) = 2
           and extract(day from mi.fecha_nacimiento) = 29
           and not (a.anio % 4 = 0 and (a.anio % 100 <> 0 or a.anio % 400 = 0))
          then 28
          else extract(day from mi.fecha_nacimiento)::int
        end
      ) as fecha_cumple,
      a.anio
    from miembros mi cross join anios a
  )
  select c.id, c.nombre, c.fecha_cumple,
         c.anio - extract(year from c.fecha_nacimiento)::int
  from cumples c
  where c.fecha_cumple between p_desde and p_hasta
  order by c.fecha_cumple;
end;
$$;

revoke all on function public.fn_cumpleanos_cdp(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.fn_cumpleanos_cdp(uuid, date, date) to authenticated;

drop policy if exists pol_red_select on public.red;
create policy pol_red_select on public.red for select to authenticated
using (
  public.fn_puede_ver_red(id)
  and (
    fecha_eliminacion is null
    or fecha_eliminacion >= now() - ((public.fn_criterio(iglesia_id, 'DIAS_RETENCION_RED'))::text || ' days')::interval
  )
);

drop policy if exists pol_casa_de_paz_select on public.casa_de_paz;
create policy pol_casa_de_paz_select on public.casa_de_paz for select to authenticated
using (
  public.fn_puede_ver_cdp(id)
  and (
    fecha_eliminacion is null
    or fecha_eliminacion >= now() - ((public.fn_criterio(iglesia_id, 'DIAS_RETENCION_CDP'))::text || ' days')::interval
  )
);

drop policy if exists pol_red_cargo_select on public.red_cargo;
create policy pol_red_cargo_select on public.red_cargo for select to authenticated
using (fecha_eliminacion is null and public.fn_puede_ver_red(red_id));

drop policy if exists pol_casa_de_paz_red_select on public.casa_de_paz_red;
create policy pol_casa_de_paz_red_select on public.casa_de_paz_red for select to authenticated
using (
  fecha_eliminacion is null
  and (public.fn_puede_ver_red(red_id) or public.fn_puede_ver_cdp(casa_de_paz_id))
);

drop policy if exists pol_casa_de_paz_cargo_select on public.casa_de_paz_cargo;
create policy pol_casa_de_paz_cargo_select on public.casa_de_paz_cargo for select to authenticated
using (fecha_eliminacion is null and public.fn_puede_ver_cdp(casa_de_paz_id));

drop policy if exists pol_casa_de_paz_membresia_select on public.casa_de_paz_membresia;
create policy pol_casa_de_paz_membresia_select on public.casa_de_paz_membresia for select to authenticated
using (fecha_eliminacion is null and public.fn_puede_ver_cdp(casa_de_paz_id));

drop policy if exists pol_casa_de_paz_reporte_select on public.casa_de_paz_reporte;
create policy pol_casa_de_paz_reporte_select on public.casa_de_paz_reporte for select to authenticated
using (fecha_eliminacion is null and public.fn_puede_ver_cdp(casa_de_paz_id));

drop policy if exists pol_casa_de_paz_asistencia_select on public.casa_de_paz_asistencia;
create policy pol_casa_de_paz_asistencia_select on public.casa_de_paz_asistencia for select to authenticated
using (
  fecha_eliminacion is null
  and public.fn_puede_ver_cdp((
    select r.casa_de_paz_id
    from public.casa_de_paz_reporte r
    where r.id = reporte_id
  ))
);

drop policy if exists pol_evangelismo_select on public.evangelismo;
create policy pol_evangelismo_select on public.evangelismo for select to authenticated
using (fecha_eliminacion is null and public.fn_puede_ver_cdp(casa_de_paz_id));

drop policy if exists pol_evento_select on public.evento;
create policy pol_evento_select on public.evento for select to authenticated
using (
  fecha_eliminacion is null
  and (
    public.fn_es_operativo_en_o_padre_de(iglesia_id)
    or (casa_de_paz_id is not null and public.fn_puede_ver_cdp(casa_de_paz_id))
    or (red_id is not null and public.fn_puede_ver_red(red_id))
    or (
      casa_de_paz_id is null
      and red_id is null
      and iglesia_id in (select public.fn_mis_iglesias())
    )
  )
);

commit;
