-- VisionHub -- T3/T4 (KAN-104/105), rediseno del selector de alcance+
-- destinatarios pedido por el owner 2026-08-15: en vez de dos campos
-- tecnicos separados ("Alcance" / "Destinatarios"), el formulario pasa a
-- leerse como una oracion ("Este anuncio lo van a ver los <roles> de
-- <zona>") con una lista real de personas en vivo debajo, para que no haga
-- falta explicar el mecanismo -- se ve directamente el resultado.
--
-- 1) fn_anuncio_previsualizar_destinatarios: dado un alcance+roles
--    hipotetico (todavia sin guardar), devuelve la lista real de personas
--    que lo verian -- mismo criterio de matching que private.fn_anuncio_
--    es_destinatario, pero "para todos" en vez de "para mi".
-- 2) fn_anuncio_mi_capacidad: casas_de_paz pasa de {id, nombre, red_id} a
--    {id, red_id, lider_nombre, zona} -- las Casas de Paz no tienen nombre
--    propio hace tiempo (confirmado por el owner), se identifican por su
--    Lider y la zona del anfitrion (mismo patron que el resto de la app,
--    ver PanelCasaDePazEstructura.tsx / direccion-cdp.ts).

begin;

create or replace function public.fn_anuncio_mi_capacidad(p_iglesia_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_iglesia_id not in (select public.fn_mis_iglesias()) then
    raise exception 'IGLESIA_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'puede_iglesia', private.fn_anuncio_puede_gestionar_iglesia(p_iglesia_id),
    'puede_designar_encargados', private.fn_anuncio_es_supervisor(p_iglesia_id),
    'redes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'nombre', x.nombre, 'color', x.color, 'es_sublider', x.es_sublider
      ) order by x.nombre), '[]'::jsonb)
      from (
        select distinct on (r.id) r.id, r.nombre, r.color, (c.codigo = 'SUBLIDER_RED') as es_sublider
        from public.red r
        join public.red_cargo rc on rc.red_id = r.id
        join public.cargo c on c.id = rc.cargo_id and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        where r.iglesia_id = p_iglesia_id and rc.persona_id = public.fn_mi_persona_id()
          and rc.fecha_fin is null and rc.fecha_eliminacion is null
        order by r.id, (c.codigo = 'LIDER_RED') desc
      ) x
    ),
    'casas_de_paz', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', y.id, 'red_id', y.red_id, 'lider_nombre', y.lider_nombre, 'zona', y.zona
      ) order by y.zona nulls last, y.lider_nombre nulls last), '[]'::jsonb)
      from (
        select distinct
          cdp.id,
          cdr.red_id,
          (
            select public.fn_nombre_completo(pl)
            from public.casa_de_paz_cargo ccl
            join public.cargo cl on cl.id = ccl.cargo_id and cl.codigo = 'LIDER_CDP'
            join public.persona pl on pl.id = ccl.persona_id
            where ccl.casa_de_paz_id = cdp.id and ccl.fecha_fin is null and ccl.fecha_eliminacion is null
            limit 1
          ) as lider_nombre,
          (
            select d.zona
            from public.direccion_asignacion da
            join public.direccion d on d.id = da.direccion_id
            where da.casa_de_paz_id = cdp.id and da.activo and da.fecha_eliminacion is null
            limit 1
          ) as zona
        from public.casa_de_paz cdp
        join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
          and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
        join public.red r on r.id = cdr.red_id
        join public.red_cargo rc on rc.red_id = r.id
        join public.cargo c on c.id = rc.cargo_id and c.codigo in ('LIDER_RED', 'SUBLIDER_RED')
        where cdp.iglesia_id = p_iglesia_id and cdp.fecha_eliminacion is null
          and rc.persona_id = public.fn_mi_persona_id()
          and rc.fecha_fin is null and rc.fecha_eliminacion is null
      ) y
    )
  );
end;
$$;

-- Lista real de personas que verian un anuncio con este alcance+roles
-- hipoteticos -- mismo chequeo de permiso que fn_anuncio_puede_administrar_
-- alcance (no se puede previsualizar un alcance que no se podria publicar).
create or replace function public.fn_anuncio_previsualizar_destinatarios(
  p_iglesia_id uuid,
  p_alcance_tipo text,
  p_red_ids uuid[],
  p_cdp_ids uuid[],
  p_roles text[]
)
returns table (persona_id uuid, nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_alcance_tipo not in ('IGLESIA', 'RED', 'CDP') then
    raise exception 'ANUNCIO_ALCANCE_INVALIDO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_administrar_alcance(p_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if p_roles is null or cardinality(p_roles) = 0 then
    return;
  end if;

  if p_alcance_tipo = 'IGLESIA' then
    return query
    select distinct p.id, public.fn_nombre_completo(p)
    from public.persona p
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null
      and (
        ('LIDER_RED' = any(p_roles) and exists (
          select 1 from public.red_cargo rc
          join public.cargo c on c.id = rc.cargo_id and c.codigo = 'LIDER_RED'
          join public.red r on r.id = rc.red_id
          where r.iglesia_id = p_iglesia_id and rc.persona_id = p.id
            and rc.fecha_fin is null and rc.fecha_eliminacion is null
        ))
        or ('SUBLIDER_RED' = any(p_roles) and exists (
          select 1 from public.red_cargo rc
          join public.cargo c on c.id = rc.cargo_id and c.codigo = 'SUBLIDER_RED'
          join public.red r on r.id = rc.red_id
          where r.iglesia_id = p_iglesia_id and rc.persona_id = p.id
            and rc.fecha_fin is null and rc.fecha_eliminacion is null
        ))
        or ('LIDER_CDP' = any(p_roles) and exists (
          select 1 from public.casa_de_paz_cargo cc
          join public.cargo c on c.id = cc.cargo_id and c.codigo = 'LIDER_CDP'
          join public.casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
          where cdp.iglesia_id = p_iglesia_id and cc.persona_id = p.id
            and cc.fecha_fin is null and cc.fecha_eliminacion is null
        ))
        or ('SUBLIDER_CDP' = any(p_roles) and exists (
          select 1 from public.casa_de_paz_cargo cc
          join public.cargo c on c.id = cc.cargo_id and c.codigo = 'SUBLIDER_CDP'
          join public.casa_de_paz cdp on cdp.id = cc.casa_de_paz_id
          where cdp.iglesia_id = p_iglesia_id and cc.persona_id = p.id
            and cc.fecha_fin is null and cc.fecha_eliminacion is null
        ))
      )
    order by 2;

  elsif p_alcance_tipo = 'RED' then
    return query
    select distinct p.id, public.fn_nombre_completo(p)
    from public.persona p
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null
      and (
        ('LIDER_RED' = any(p_roles) and exists (
          select 1 from public.red_cargo rc
          join public.cargo c on c.id = rc.cargo_id and c.codigo = 'LIDER_RED'
          where rc.red_id = any(p_red_ids) and rc.persona_id = p.id
            and rc.fecha_fin is null and rc.fecha_eliminacion is null
        ))
        or ('SUBLIDER_RED' = any(p_roles) and exists (
          select 1 from public.red_cargo rc
          join public.cargo c on c.id = rc.cargo_id and c.codigo = 'SUBLIDER_RED'
          where rc.red_id = any(p_red_ids) and rc.persona_id = p.id
            and rc.fecha_fin is null and rc.fecha_eliminacion is null
        ))
        or ('LIDER_CDP' = any(p_roles) and exists (
          select 1 from public.casa_de_paz_cargo cc
          join public.cargo c on c.id = cc.cargo_id and c.codigo = 'LIDER_CDP'
          join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cc.casa_de_paz_id
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
          where cdr.red_id = any(p_red_ids) and cc.persona_id = p.id
            and cc.fecha_fin is null and cc.fecha_eliminacion is null
        ))
        or ('SUBLIDER_CDP' = any(p_roles) and exists (
          select 1 from public.casa_de_paz_cargo cc
          join public.cargo c on c.id = cc.cargo_id and c.codigo = 'SUBLIDER_CDP'
          join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cc.casa_de_paz_id
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
          where cdr.red_id = any(p_red_ids) and cc.persona_id = p.id
            and cc.fecha_fin is null and cc.fecha_eliminacion is null
        ))
      )
    order by 2;

  else
    return query
    select distinct p.id, public.fn_nombre_completo(p)
    from public.persona p
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null
      and (
        ('LIDER_CDP' = any(p_roles) and exists (
          select 1 from public.casa_de_paz_cargo cc
          join public.cargo c on c.id = cc.cargo_id and c.codigo = 'LIDER_CDP'
          where cc.casa_de_paz_id = any(p_cdp_ids) and cc.persona_id = p.id
            and cc.fecha_fin is null and cc.fecha_eliminacion is null
        ))
        or ('SUBLIDER_CDP' = any(p_roles) and exists (
          select 1 from public.casa_de_paz_cargo cc
          join public.cargo c on c.id = cc.cargo_id and c.codigo = 'SUBLIDER_CDP'
          where cc.casa_de_paz_id = any(p_cdp_ids) and cc.persona_id = p.id
            and cc.fecha_fin is null and cc.fecha_eliminacion is null
        ))
        or ('LIDER_RED' = any(p_roles) and exists (
          select 1 from public.red_cargo rc
          join public.cargo c on c.id = rc.cargo_id and c.codigo = 'LIDER_RED'
          join public.casa_de_paz_red cdr on cdr.red_id = rc.red_id
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
          where cdr.casa_de_paz_id = any(p_cdp_ids) and rc.persona_id = p.id
            and rc.fecha_fin is null and rc.fecha_eliminacion is null
        ))
        or ('SUBLIDER_RED' = any(p_roles) and exists (
          select 1 from public.red_cargo rc
          join public.cargo c on c.id = rc.cargo_id and c.codigo = 'SUBLIDER_RED'
          join public.casa_de_paz_red cdr on cdr.red_id = rc.red_id
            and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
          where cdr.casa_de_paz_id = any(p_cdp_ids) and rc.persona_id = p.id
            and rc.fecha_fin is null and rc.fecha_eliminacion is null
        ))
      )
    order by 2;
  end if;
end;
$$;

revoke all on function public.fn_anuncio_previsualizar_destinatarios(uuid, text, uuid[], uuid[], text[])
  from public, anon;
grant execute on function public.fn_anuncio_previsualizar_destinatarios(uuid, text, uuid[], uuid[], text[])
  to authenticated;

commit;
