-- KAN-339: Super Admin (solo lectura) + Pastor/Supervisor (control total) en
-- Afirmacion y Evangelismo. Diseno cerrado en
-- harness/15-gestion-administrativa/technical-design.md #12.
--
-- Patron identico al ya usado en KAN-281 para Evangelismo
-- (20260905010000_kan281_departamento_evangelismo.sql): se suma el chequeo
-- correcto a cada funcion existente, sin inventar un concepto de "modo" en
-- runtime. Auditado contra el estado REAL de la base (pg_get_functiondef),
-- no contra migraciones viejas -- varias de estas funciones ya tenian
-- fn_es_operativo_en/fn_es_pastor_en sumados en pasadas anteriores y otras
-- no, por eso el patron no es uniforme entre ellas.
--
-- Afirmacion, RPC de LECTURA: se suma fn_es_super_admin() (nunca se suma a
-- escritura -- esa es la barrera real de "solo lectura", ver REQ-339-4).
-- Afirmacion, RPC de LECTURA/ESCRITURA que le faltaba Pastor: se suma
-- fn_es_pastor_en() para que quede al mismo nivel que Supervisor
-- (fn_es_operativo_en), que ya lo tenia en algunas.
-- Evangelismo: Pastor/Supervisor ya tenian control total (KAN-281) -- solo
-- se suma fn_es_super_admin() a las RPC de lectura.

-- ─── Afirmacion: lectura ────────────────────────────────────────────────────

create or replace function public.fn_afirmacion_config_registro_url(p_iglesia_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  return fn_config_bool(p_iglesia_id, 'REGISTRO_URL_ACTIVO');
end;
$function$;

create or replace function public.fn_afirmacion_estadisticas_personas(p_iglesia_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_total int;
  v_por_estado jsonb;
  v_hombres int;
  v_mujeres int;
  v_con_profesion int;
  v_por_estado_civil jsonb;
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  select count(*),
         count(*) filter (where sexo = 'M'),
         count(*) filter (where sexo = 'F')
  into v_total, v_hombres, v_mujeres
  from persona p
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto;

  select jsonb_object_agg(coalesce(e.sigla, 'SIN_ESTADO'), conteo)
  into v_por_estado
  from (
    select pe.estado_id, count(*) as conteo
    from persona p
    left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    group by pe.estado_id
  ) c
  left join estado e on e.id = c.estado_id;

  select count(*) filter (where d.ocupacion is not null and trim(d.ocupacion) <> '')
  into v_con_profesion
  from persona p
  left join persona_detalle d on d.persona_id = p.id
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto;

  select jsonb_object_agg(coalesce(d.estado_civil::text, 'SIN_ESTADO_CIVIL'), conteo)
  into v_por_estado_civil
  from (
    select d.estado_civil, count(*) as conteo
    from persona p
    left join persona_detalle d on d.persona_id = p.id
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    group by d.estado_civil
  ) d;

  return jsonb_build_object(
    'total', v_total,
    'hombres', v_hombres,
    'mujeres', v_mujeres,
    'por_estado', coalesce(v_por_estado, '{}'::jsonb),
    'con_profesion', v_con_profesion,
    'por_estado_civil', coalesce(v_por_estado_civil, '{}'::jsonb)
  );
end;
$function$;

create or replace function public.fn_afirmacion_estadisticas_registro(p_iglesia_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_por_url int;
  v_por_formulario int;
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  select
    count(*) filter (where pl.casa_paz_url_id is not null),
    count(*) filter (where pl.casa_paz_url_id is null)
  into v_por_url, v_por_formulario
  from persona_llegada pl
  join motivo_llegada ml on ml.id = pl.motivo_llegada_id
  where pl.iglesia_id = p_iglesia_id
    and pl.fecha_eliminacion is null
    and ml.codigo = 'INVITACION_PERSONAL';

  return jsonb_build_object(
    'por_url', coalesce(v_por_url, 0),
    'por_formulario', coalesce(v_por_formulario, 0)
  );
end;
$function$;

create or replace function public.fn_listar_casa_paz_url_afirmacion(p_iglesia_id uuid)
 returns table(url_id uuid, slug character varying, estado estado_url_enum, lider_cdp_nombre text, casa_de_paz_id uuid, casa_de_paz_etiqueta text, red_id uuid, red_nombre character varying, lider_red_nombre text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select
    cpu.id, cpu.slug, cpu.estado,
    fn_nombre_completo(pl), cpu.casa_de_paz_id, fn_etiqueta_cdp(cpu.casa_de_paz_id),
    r.id, r.nombre,
    (select fn_nombre_completo(prl)
     from red_cargo rcl join cargo cl on cl.id = rcl.cargo_id join persona prl on prl.id = rcl.persona_id
     where rcl.red_id = r.id and cl.codigo = 'LIDER_RED'
       and rcl.fecha_fin is null and rcl.fecha_eliminacion is null
     limit 1)
  from casa_paz_url cpu
  join casa_de_paz_cargo cc on cc.id = cpu.casa_de_paz_cargo_id
  join cargo cc_cargo on cc_cargo.id = cc.cargo_id
  join casa_de_paz cdp on cdp.id = cpu.casa_de_paz_id
  join persona pl on pl.id = cpu.persona_id
  left join casa_de_paz_red cdr on cdr.casa_de_paz_id = cpu.casa_de_paz_id
       and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
  left join red r on r.id = cdr.red_id
  where cpu.iglesia_id = p_iglesia_id
    and cpu.fecha_eliminacion is null
    and cc_cargo.codigo = 'LIDER_CDP'
    and cc.fecha_fin is null and cc.fecha_eliminacion is null
    and cdp.activo and cdp.fecha_eliminacion is null
  order by r.nombre nulls last, fn_nombre_completo(pl.*);
end;
$function$;

create or replace function public.fn_listar_casas_de_paz_afirmacion(p_iglesia_id uuid)
 returns table(casa_de_paz_id uuid, casa_de_paz_etiqueta text, activo boolean, red_id uuid, red_nombre character varying, lider_red_nombre text, lider_cdp_nombre text, tiene_lider_vigente boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    cdp.activo,
    r.id,
    r.nombre,
    (select fn_nombre_completo(prl)
     from red_cargo rcl join cargo cl on cl.id = rcl.cargo_id join persona prl on prl.id = rcl.persona_id
     where rcl.red_id = r.id and cl.codigo = 'LIDER_RED'
       and rcl.fecha_fin is null and rcl.fecha_eliminacion is null
     limit 1),
    (select fn_nombre_completo(pcdp)
     from casa_de_paz_cargo ccl join cargo ccg on ccg.id = ccl.cargo_id join persona pcdp on pcdp.id = ccl.persona_id
     where ccl.casa_de_paz_id = cdp.id and ccg.codigo = 'LIDER_CDP'
       and ccl.fecha_fin is null and ccl.fecha_eliminacion is null
     limit 1),
    exists (
      select 1 from casa_de_paz_cargo ccl join cargo ccg on ccg.id = ccl.cargo_id
      where ccl.casa_de_paz_id = cdp.id and ccg.codigo = 'LIDER_CDP'
        and ccl.fecha_fin is null and ccl.fecha_eliminacion is null
    )
  from casa_de_paz cdp
  left join casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
       and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
  left join red r on r.id = cdr.red_id
  where cdp.iglesia_id = p_iglesia_id
    and cdp.fecha_eliminacion is null
  order by r.nombre nulls last, fn_etiqueta_cdp(cdp.id);
end;
$function$;

create or replace function public.fn_listar_lideres_cdp_afirmacion(p_iglesia_id uuid)
 returns table(casa_de_paz_cargo_id uuid, persona_id uuid, lider_nombre text, casa_de_paz_id uuid, cdp_etiqueta text, red_id uuid, red_nombre character varying, zona character varying)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select
    cc.id, cc.persona_id, fn_nombre_completo(p), cc.casa_de_paz_id, fn_etiqueta_cdp(cc.casa_de_paz_id),
    r.id, r.nombre,
    (select d.zona from direccion_asignacion da join direccion d on d.id = da.direccion_id
     where da.casa_de_paz_id = cc.casa_de_paz_id and da.activo and da.fecha_eliminacion is null limit 1)
  from casa_de_paz_cargo cc
  join cargo c on c.id = cc.cargo_id
  join persona p on p.id = cc.persona_id
  join casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
  left join casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
  left join red r on r.id = cdr.red_id
  where cc.iglesia_id = p_iglesia_id
    and c.codigo = 'LIDER_CDP'
    and cc.fecha_fin is null and cc.fecha_eliminacion is null
    and cdp.activo and cdp.fecha_eliminacion is null
  order by fn_nombre_completo(p);
end;
$function$;

create or replace function public.fn_listar_redes_afirmacion(p_iglesia_id uuid)
 returns table(id uuid, nombre character varying)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select r.id, r.nombre
  from red r
  where r.iglesia_id = p_iglesia_id and r.activo and r.fecha_eliminacion is null
  order by r.nombre;
end;
$function$;

-- ─── Afirmacion: escritura -- se suma Pastor (paridad con Supervisor), NUNCA
--     Super Admin (esa es la barrera real de "solo lectura") ────────────────

create or replace function public.fn_registrar_persona_afirmacion(p_datos jsonb, p_casa_de_paz_cargo_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cargo        casa_de_paz_cargo;
  v_iglesia_id   uuid;
  v_persona_id   uuid;
begin
  select cc.* into v_cargo
  from casa_de_paz_cargo cc
  join cargo c on c.id = cc.cargo_id
  join casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
  where cc.id = p_casa_de_paz_cargo_id
    and c.codigo = 'LIDER_CDP'
    and cc.fecha_fin is null and cc.fecha_eliminacion is null
    and cdp.activo and cdp.fecha_eliminacion is null;

  if not found then
    raise exception 'AFIRMACION_LIDER_CDP_INVALIDO: el lider de casa de paz elegido no tiene un cargo vigente'
      using errcode = 'P0001';
  end if;

  v_iglesia_id := v_cargo.iglesia_id;

  if not (fn_es_lider_afirmacion_en(v_iglesia_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id)) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  insert into persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  values (v_iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  returning id into v_persona_id;

  insert into persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  values (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  insert into persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso, invitado_por_id)
  values (v_iglesia_id, v_persona_id,
          (select id from motivo_llegada where codigo = 'INVITACION_PERSONAL'),
          current_date, v_cargo.persona_id);

  insert into casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  values (v_iglesia_id, v_cargo.casa_de_paz_id, v_persona_id, true, current_date);

  -- KAN-123: campos ampliados, incluye Ministerios.
  perform fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, p_datos);

  -- Celular (nuevo): no-op si p_datos->>'telefono' viene NULL/vacio.
  perform fn_guardar_telefono_membresia(v_persona_id, v_iglesia_id, p_datos->>'telefono');

  return jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (select fn_nombre_completo(p) from persona p where p.id = v_persona_id),
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_cargo.casa_de_paz_id)
  );
end;
$function$;

create or replace function public.fn_set_estado_casa_paz_url(p_ids uuid[], p_estado estado_url_enum)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_url casa_paz_url;
  v_es_lider_cdp_vigente boolean;
  v_actualizadas int := 0;
  v_omitidas jsonb := '[]'::jsonb;
begin
  foreach v_id in array p_ids loop
    select * into v_url from casa_paz_url where id = v_id and fecha_eliminacion is null;

    if not found then
      v_omitidas := v_omitidas || jsonb_build_object('id', v_id, 'motivo', 'NO_ENCONTRADA');
      continue;
    end if;

    if not (fn_es_lider_afirmacion_en(v_url.iglesia_id) or fn_es_operativo_en(v_url.iglesia_id) or fn_es_pastor_en(v_url.iglesia_id)) then
      v_omitidas := v_omitidas || jsonb_build_object('id', v_id, 'motivo', 'SIN_PERMISO');
      continue;
    end if;

    select exists (
      select 1 from casa_de_paz_cargo cc join cargo c on c.id = cc.cargo_id
      join casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
      where cc.id = v_url.casa_de_paz_cargo_id and c.codigo = 'LIDER_CDP'
        and cc.fecha_fin is null and cc.fecha_eliminacion is null
        and cdp.activo and cdp.fecha_eliminacion is null
    ) into v_es_lider_cdp_vigente;

    if not v_es_lider_cdp_vigente then
      v_omitidas := v_omitidas || jsonb_build_object('id', v_id, 'motivo', 'LIDER_CDP_NO_VIGENTE');
      continue;
    end if;

    if v_url.estado = p_estado then
      continue; -- idempotente: ya esta en el estado pedido, no cuenta como error ni se reescribe
    end if;

    update casa_paz_url set estado = p_estado where id = v_id;
    v_actualizadas := v_actualizadas + 1;
  end loop;

  return jsonb_build_object('actualizadas', v_actualizadas, 'omitidas', v_omitidas);
end;
$function$;

-- RLS de refuerzo (defensa en profundidad -- el gate real ya vive en la RPC
-- de arriba, que es SECURITY DEFINER y no pasa por RLS): pol_casa_paz_url_update
-- ya cubre a Supervisor (fn_es_operativo_en); a esta le faltaba Pastor.
drop policy if exists pol_casa_paz_url_update_afirmacion on public.casa_paz_url;
create policy pol_casa_paz_url_update_afirmacion on public.casa_paz_url
  for update
  using (fn_es_lider_afirmacion_en(iglesia_id) or fn_es_pastor_en(iglesia_id))
  with check (fn_es_lider_afirmacion_en(iglesia_id) or fn_es_pastor_en(iglesia_id));

-- ─── Evangelismo: lectura -- Pastor/Supervisor ya tenian control total
--     (KAN-281); se suma solo fn_es_super_admin() ──────────────────────────

create or replace function public.fn_evangelismo_red(p_red_id uuid, p_desde date, p_hasta date)
 returns table(id uuid, casa_de_paz_id uuid, casa_de_paz_etiqueta text, persona_id uuid, nombre_completo text, fecha date, domicilio text, tipo_evangelismo_nombre character varying, tipo_evangelismo_color character, tipo_evangelismo_codigo character varying)
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
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id) or fn_es_super_admin()) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id using errcode = 'P0001';
  end if;

  return query
  select ev.id, ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id), ev.persona_id, fn_nombre_completo(p),
         ev.fecha, ev.domicilio, te.nombre, te.color, te.codigo
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

create or replace function public.fn_evangelismo_red_directo(p_red_id uuid, p_desde date, p_hasta date)
 returns table(id uuid, persona_id uuid, nombre_completo text, fecha date, domicilio text, tipo_evangelismo_nombre character varying, tipo_evangelismo_color character, tipo_evangelismo_codigo character varying)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_iglesia_id uuid;
begin
  select red.iglesia_id into v_iglesia_id from red where red.id = p_red_id;
  if v_iglesia_id is null or v_iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id using errcode = 'P0001';
  end if;
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id) or fn_es_super_admin()) then
    raise exception 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id using errcode = 'P0001';
  end if;

  return query
  select ev.id, ev.persona_id, fn_nombre_completo(p), ev.fecha, ev.domicilio,
         te.nombre, te.color, te.codigo
  from evangelismo_red ev
  join persona p on p.id = ev.persona_id
  left join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
  where ev.red_id = p_red_id
    and ev.fecha_eliminacion is null
    and ev.fecha between p_desde and p_hasta
  order by ev.fecha desc;
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
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id) or fn_es_super_admin()) then
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
  if not (fn_es_lider_de_red(p_red_id) or fn_es_operativo_en(v_iglesia_id) or fn_es_pastor_en(v_iglesia_id) or fn_es_lider_evangelismo_en(v_iglesia_id) or fn_es_super_admin()) then
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

create or replace function public.fn_buscar_evangelizados(p_iglesia_id uuid, p_red_id uuid default null::uuid, p_texto text default null::text, p_desde date default null::date, p_hasta date default null::date, p_pagina integer default 1, p_por_pagina integer default 50, p_casa_de_paz_id uuid default null::uuid, p_tipo_evangelismo_id uuid default null::uuid, p_evangelizado_por_id uuid default null::uuid)
 returns table(id uuid, persona_id uuid, nombre_completo text, primer_nombre character varying, segundo_nombre character varying, primer_apellido character varying, segundo_apellido character varying, fecha date, domicilio text, telefono_principal character varying, red_id uuid, red_nombre character varying, casa_de_paz_id uuid, casa_de_paz_etiqueta text, tipo_evangelismo_nombre character varying, tipo_evangelismo_color character varying, evangelizado_por_nombre text, evangelizado_por_primer_nombre character varying, evangelizado_por_segundo_nombre character varying, evangelizado_por_primer_apellido character varying, sexo text, fecha_nacimiento date, total bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_offset int := greatest(p_pagina - 1, 0) * p_por_pagina;
begin
  if p_iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'IGLESIA_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  if not (
    fn_es_operativo_en(p_iglesia_id)
    or fn_es_pastor_en(p_iglesia_id)
    or fn_es_lider_evangelismo_en(p_iglesia_id)
    or fn_es_super_admin()
  ) then
    raise exception 'SIN_PERMISO: no tenes permiso para ver el listado de evangelizados de esta iglesia' using errcode = 'P0001';
  end if;

  if p_red_id is not null and not exists (
    select 1 from red where red.id = p_red_id and red.iglesia_id = p_iglesia_id and red.fecha_eliminacion is null
  ) then
    raise exception 'RED_FUERA_DE_ALCANCE: la red % no pertenece a esta iglesia', p_red_id using errcode = 'P0001';
  end if;

  return query
  select ev.id, ev.persona_id, fn_nombre_completo(p),
         p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
         ev.fecha, ev.domicilio,
         tel.numero,
         r.id, r.nombre,
         ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id),
         te.nombre, te.color::varchar,
         fn_nombre_completo(evz),
         evz.primer_nombre, evz.segundo_nombre, evz.primer_apellido,
         p.sexo::text, p.fecha_nacimiento,
         count(*) over()
  from evangelismo ev
  join persona p on p.id = ev.persona_id
  left join casa_de_paz_red cdr on cdr.casa_de_paz_id = ev.casa_de_paz_id and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
  left join red r on r.id = cdr.red_id
  left join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
  left join telefono_asignacion ta on ta.persona_id = p.id and ta.es_principal and ta.activo and ta.fecha_eliminacion is null
  left join telefono tel on tel.id = ta.telefono_id
  left join persona evz on evz.id = ev.evangelizado_por_id
  where ev.iglesia_id = p_iglesia_id
    and ev.fecha_eliminacion is null
    and (te.codigo is distinct from 'SEMILLA')
    and (p_red_id is null or r.id = p_red_id)
    and (p_casa_de_paz_id is null or ev.casa_de_paz_id = p_casa_de_paz_id)
    and (p_tipo_evangelismo_id is null or te.id = p_tipo_evangelismo_id)
    and (p_evangelizado_por_id is null or ev.evangelizado_por_id = p_evangelizado_por_id)
    and (p_desde is null or ev.fecha >= p_desde)
    and (p_hasta is null or ev.fecha <= p_hasta)
    and (p_texto is null or btrim(p_texto) = '' or fn_nombre_completo(p) ilike '%' || p_texto || '%')
  order by ev.fecha desc
  limit p_por_pagina offset v_offset;
end;
$function$;
