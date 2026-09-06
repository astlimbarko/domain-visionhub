-- KAN-281/282/283: Departamento de Evangelismo, reutilizando el panel
-- iglesia-completa que ya usa el Supervisor de la Vision en Accion
-- (fn_evangelismo_red, fn_tasa_evangelismo_red, fn_metas_cdp_red,
-- fn_asignar_meta_red). Mismo patron que fn_es_lider_afirmacion_en: wrapper
-- de 1 linea sobre fn_es_lider_departamento, ya generica.

create or replace function public.fn_es_lider_evangelismo_en(p_iglesia_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select fn_es_lider_departamento(p_iglesia_id, 'EVANGELISMO');
$function$;

drop function if exists public.fn_mis_iglesias_detalle();

create or replace function public.fn_mis_iglesias_detalle()
returns table(
  id uuid, nombre character varying, ciudad character varying,
  es_operativo boolean, es_pastor boolean,
  es_lider_afirmacion boolean, es_lider_evangelismo boolean,
  es_lider_jovenes boolean, es_encargado_matrimonios boolean
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id), fn_es_pastor_en(i.id),
         fn_es_lider_afirmacion_en(i.id), fn_es_lider_evangelismo_en(i.id),
         fn_es_lider_jovenes_en(i.id), fn_es_encargado_matrimonios_en(i.id)
  from iglesia i
  where i.id in (select fn_mis_iglesias())
    and i.activo
    and i.fecha_eliminacion is null
  order by i.nombre;
$function$;

-- Las 3 RPC de lectura del panel de Evangelismo por Red: mismo chequeo de
-- siempre + el nuevo rol de Departamento (alcance iglesia completa, no una
-- Red puntual -- por eso se chequea contra v_iglesia_id, no p_red_id).
create or replace function public.fn_evangelismo_red(p_red_id uuid, p_desde date, p_hasta date)
returns table(id uuid, casa_de_paz_id uuid, casa_de_paz_etiqueta text, persona_id uuid, nombre_completo text, fecha date, domicilio text, tipo_evangelismo_nombre character varying, tipo_evangelismo_color character)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare v_iglesia_id uuid;
begin
  select red.iglesia_id into v_iglesia_id from red where red.id = p_red_id;
  if v_iglesia_id is null or v_iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id using errcode = 'P0001';
  end if;
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id)) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id using errcode = 'P0001';
  end if;

  return query
  select ev.id, ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id), ev.persona_id, fn_nombre_completo(p),
         ev.fecha, ev.domicilio, te.nombre, te.color
  from evangelismo ev
  join casa_de_paz_red cdr on cdr.casa_de_paz_id = ev.casa_de_paz_id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
  join casa_de_paz c on c.id = ev.casa_de_paz_id and c.activo and c.fecha_eliminacion is null
  join persona p on p.id = ev.persona_id
  left join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
  where cdr.red_id = p_red_id
    and ev.fecha_eliminacion is null
    and ev.fecha between p_desde and p_hasta
  order by ev.fecha desc;
end;
$function$;

create or replace function public.fn_tasa_evangelismo_red(p_red_id uuid, p_desde date, p_hasta date)
returns table(evangelizados bigint, meta_total integer, cdp_con_meta integer, cdp_total integer, tasa numeric)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare v_iglesia_id uuid;
begin
  select red.iglesia_id into v_iglesia_id from red where red.id = p_red_id;
  if v_iglesia_id is null or v_iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id using errcode = 'P0001';
  end if;
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id)) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id using errcode = 'P0001';
  end if;

  return query
  with cdps as (
    select c.id from casa_de_paz c
    join casa_de_paz_red cdr on cdr.casa_de_paz_id = c.id
    where cdr.red_id = p_red_id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
      and c.activo and c.fecha_eliminacion is null
  ),
  conteo as (
    select count(*) as n from evangelismo e
    where e.casa_de_paz_id in (select id from cdps) and e.fecha between p_desde and p_hasta and e.fecha_eliminacion is null
  ),
  metas as (
    select m.meta, m.origen from cdps cross join lateral fn_meta_efectiva(cdps.id, current_date) m
  )
  select c.n,
         coalesce(sum(metas.meta) filter (where metas.origen is distinct from 'ASIGNADA_RED'), 0)::integer as meta_total,
         count(metas.meta)::integer as cdp_con_meta,
         (select count(*) from cdps)::integer as cdp_total,
         case when coalesce(sum(metas.meta) filter (where metas.origen is distinct from 'ASIGNADA_RED'), 0) = 0 then null
              else round((c.n::numeric / sum(metas.meta) filter (where metas.origen is distinct from 'ASIGNADA_RED')) * 100, 2) end as tasa
  from conteo c left join metas on true
  group by c.n;
end;
$function$;

create or replace function public.fn_metas_cdp_red(p_red_id uuid)
returns table(casa_de_paz_id uuid, etiqueta text, meta integer, origen character varying)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare v_iglesia_id uuid;
begin
  select red.iglesia_id into v_iglesia_id from red where red.id = p_red_id;
  if v_iglesia_id is null or v_iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id using errcode = 'P0001';
  end if;
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id)) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id using errcode = 'P0001';
  end if;

  return query
  select c.id, fn_etiqueta_cdp(c.id), m.meta, m.origen
  from casa_de_paz c
  join casa_de_paz_red cdr on cdr.casa_de_paz_id = c.id
  left join lateral fn_meta_efectiva(c.id, current_date) m on true
  where cdr.red_id = p_red_id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
    and c.activo and c.fecha_eliminacion is null
  order by fn_etiqueta_cdp(c.id);
end;
$function$;

-- Asignar meta (por Red o "a todas"): mismo permiso de escritura, mas el
-- Lider de Departamento de Evangelismo.
create or replace function public.fn_asignar_meta_red(p_red_id uuid, p_meta integer, p_fecha_inicio date, p_fecha_fin date, p_observaciones text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_iglesia_id uuid;
  v_persona_id uuid := fn_mi_persona_id();
  v_nueva_id uuid;
begin
  select iglesia_id into v_iglesia_id from red where id = p_red_id and fecha_eliminacion is null;
  if v_iglesia_id is null then
    raise exception 'RED_INEXISTENTE: la red % no existe', p_red_id using errcode = 'P0001';
  end if;

  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id)) then
    raise exception 'META_SIN_PERMISO: no tenes permiso para asignar la meta de esta red'
      using errcode = 'P0001';
  end if;

  update meta_evangelismo_asignada
  set fecha_eliminacion = now(), eliminado_por = auth.uid()
  where red_id = p_red_id
    and fecha_eliminacion is null
    and daterange(fecha_inicio, fecha_fin, '[]') && daterange(p_fecha_inicio, p_fecha_fin, '[]');

  insert into meta_evangelismo_asignada (iglesia_id, red_id, asignador_id, meta, fecha_inicio, fecha_fin, observaciones)
  values (v_iglesia_id, p_red_id, v_persona_id, p_meta, p_fecha_inicio, p_fecha_fin, nullif(btrim(coalesce(p_observaciones, '')), ''))
  returning id into v_nueva_id;

  return v_nueva_id;
end;
$function$;

-- fn_puede_ver_red / fn_puede_ver_cdp: listado basico de Redes/CdP (nombre,
-- lider vigente, calendario) -- blast radius acotado (fn_listar_redes,
-- fn_listar_cdp, fn_cargo_vigente_*, fn_eventos_cdp, fn_cumpleanos_cdp; no
-- tocan Personas/Finanzas, que tienen su propio chequeo aparte). Sin esto
-- EvangelismoSupervisorVista no puede ni listar las Redes/CdP de la iglesia
-- para el nuevo rol de Departamento.
create or replace function public.fn_puede_ver_cdp(p_casa_de_paz_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.casa_de_paz cdp
    where cdp.id = p_casa_de_paz_id
      and (
        public.fn_es_super_admin()
        or public.fn_es_pastor_en(cdp.iglesia_id)
        or public.fn_es_operativo_en(cdp.iglesia_id)
        or public.fn_es_lider_departamento(cdp.iglesia_id, 'EVANGELISMO')
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
$function$;

create or replace function public.fn_puede_ver_red(p_red_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.red r
    where r.id = p_red_id
      and (
        public.fn_es_super_admin()
        or public.fn_es_pastor_en(r.iglesia_id)
        or public.fn_es_operativo_en(r.iglesia_id)
        or public.fn_es_lider_departamento(r.iglesia_id, 'EVANGELISMO')
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
$function$;

-- Mismo permiso reflejado en la RLS de la tabla (pol_meta_asignada_insert
-- ya documentaba "mismo permiso que la RPC" -- se mantienen sincronizadas).
drop policy if exists pol_meta_asignada_insert on public.meta_evangelismo_asignada;
create policy pol_meta_asignada_insert on public.meta_evangelismo_asignada
  for insert
  with check (
    (iglesia_id in (select fn_mis_iglesias()))
    and (
      (casa_de_paz_id is not null and fn_es_rol_superior_de_cdp(casa_de_paz_id))
      or (red_id is not null and (fn_es_lider_de_red(red_id) or fn_es_operativo_en(iglesia_id) or fn_es_lider_evangelismo_en(iglesia_id)))
    )
  );
