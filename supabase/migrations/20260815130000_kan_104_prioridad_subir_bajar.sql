-- VisionHub -- T3 (KAN-104), pedido del owner 2026-08-15: poder subir/bajar
-- el orden (prioridad) de los anuncios desde la pantalla de gestion.
--
-- fn_mis_anuncios_gestion pasa a ordenar por prioridad desc (igual criterio
-- que fn_anuncios_pendientes, la cola que ve el destinatario) en vez de solo
-- fecha_creacion desc -- si no, "subir/bajar" no se reflejaria en el orden
-- que la propia pantalla de gestion muestra.
--
-- fn_anuncio_mover_prioridad intercambia el valor de `prioridad` con el
-- anuncio vecino (el inmediato superior/inferior en ese mismo orden, dentro
-- de toda la iglesia -- el campo es compartido con la cola real de
-- destinatarios, no tiene sentido acotarlo solo a lo que administra quien
-- reordena). Sin vecino (ya esta en un extremo) no hace nada.

begin;

create or replace function public.fn_mis_anuncios_gestion(p_iglesia_id uuid, p_red_id uuid default null)
returns table (
  id uuid,
  alcance_tipo text,
  redes jsonb,
  casas_de_paz jsonb,
  titulo text,
  mensaje text,
  imagen_path text,
  imagen_orientacion text,
  roles_destinatarios text[],
  activo boolean,
  es_borrador boolean,
  prioridad smallint,
  fecha_publicacion timestamptz,
  fecha_fin timestamptz,
  autor_nombre text,
  fecha_creacion timestamptz
)
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

  return query
  select
    a.id, a.alcance_tipo,
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre)), '[]'::jsonb)
      from public.anuncio_alcance_red ar
      join public.red r on r.id = ar.red_id
      where ar.anuncio_id = a.id and ar.fecha_eliminacion is null
    ),
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre)), '[]'::jsonb)
      from public.anuncio_alcance_cdp ac
      join public.casa_de_paz c on c.id = ac.casa_de_paz_id
      where ac.anuncio_id = a.id and ac.fecha_eliminacion is null
    ),
    a.titulo::text, a.mensaje, a.imagen_path,
    a.imagen_orientacion::text, a.roles_destinatarios, a.activo, a.es_borrador, a.prioridad,
    a.fecha_publicacion, a.fecha_fin, public.fn_nombre_completo(p), a.fecha_creacion
  from public.anuncio a
  left join public.persona p on p.id = a.autor_persona_id
  where a.iglesia_id = p_iglesia_id
    and a.fecha_eliminacion is null
    and (
      p_red_id is null
      or exists (select 1 from public.anuncio_alcance_red ar where ar.anuncio_id = a.id and ar.red_id = p_red_id and ar.fecha_eliminacion is null)
    )
    and private.fn_anuncio_fila_administrable(a.id)
  order by a.prioridad desc, a.fecha_creacion desc;
end;
$$;

create or replace function public.fn_anuncio_mover_prioridad(p_anuncio_id uuid, p_direccion text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_prioridad smallint;
  v_fecha_creacion timestamptz;
  v_vecino_id uuid;
  v_vecino_prioridad smallint;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_direccion not in ('SUBIR', 'BAJAR') then
    raise exception 'DIRECCION_INVALIDA' using errcode = 'P0001';
  end if;

  select iglesia_id, prioridad, fecha_creacion
  into v_iglesia_id, v_prioridad, v_fecha_creacion
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if p_direccion = 'SUBIR' then
    select id, prioridad into v_vecino_id, v_vecino_prioridad
    from public.anuncio
    where iglesia_id = v_iglesia_id and fecha_eliminacion is null and id <> p_anuncio_id
      and (prioridad > v_prioridad or (prioridad = v_prioridad and fecha_creacion > v_fecha_creacion))
    order by prioridad asc, fecha_creacion asc
    limit 1
    for update;
  else
    select id, prioridad into v_vecino_id, v_vecino_prioridad
    from public.anuncio
    where iglesia_id = v_iglesia_id and fecha_eliminacion is null and id <> p_anuncio_id
      and (prioridad < v_prioridad or (prioridad = v_prioridad and fecha_creacion < v_fecha_creacion))
    order by prioridad desc, fecha_creacion desc
    limit 1
    for update;
  end if;

  if v_vecino_id is null then
    return;
  end if;

  update public.anuncio set prioridad = v_vecino_prioridad, actualizado_por = (select auth.uid()) where id = p_anuncio_id;
  update public.anuncio set prioridad = v_prioridad, actualizado_por = (select auth.uid()) where id = v_vecino_id;
end;
$$;

revoke all on function public.fn_anuncio_mover_prioridad(uuid, text) from public, anon;
grant execute on function public.fn_anuncio_mover_prioridad(uuid, text) to authenticated;

commit;
