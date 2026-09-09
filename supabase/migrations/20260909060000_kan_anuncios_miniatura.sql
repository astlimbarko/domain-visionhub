-- VisionHub -- KAN-354: miniatura real para el panel de gestion de anuncios.
-- Hoy la lista de gestion carga la imagen completa comprimida (hasta 600px
-- de alto, ~90KB) solo para mostrarla como miniatura de 28x28 (Tailwind).
-- Se sube una segunda imagen, mucho mas chica (140px de alto), en paralelo a
-- la principal, y el panel de gestion pide esa en vez de la completa.
--
-- imagen_thumb_path es nullable a proposito: los anuncios creados antes de
-- este cambio no tienen miniatura -- el front cae a la imagen completa como
-- fallback para esos casos historicos, no hace falta backfill.

begin;

alter table public.anuncio
  add column if not exists imagen_thumb_path text null;

-- La miniatura vive en el mismo folder {iglesia_id}/ que la imagen principal
-- (misma policy de insert/delete, que ya valida por folder+permiso, no por
-- archivo puntual). El select si necesita el ajuste: antes solo dejaba leer
-- el objeto cuyo nombre coincidiera EXACTO con anuncio.imagen_path.
drop policy if exists pol_storage_anuncios_select on storage.objects;
create policy pol_storage_anuncios_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'anuncios'
    and exists (
      select 1 from public.anuncio a
      where (a.imagen_path = storage.objects.name or a.imagen_thumb_path = storage.objects.name)
        and a.fecha_eliminacion is null
        and (private.fn_anuncio_fila_administrable(a.id) or private.fn_anuncio_es_destinatario(a.id))
    )
  );

drop function if exists public.fn_anuncio_crear(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean);

create function public.fn_anuncio_crear(
  p_iglesia_id uuid,
  p_alcance_tipo text,
  p_red_ids uuid[],
  p_cdp_ids uuid[],
  p_titulo text,
  p_mensaje text,
  p_imagen_path text,
  p_imagen_orientacion text,
  p_roles_destinatarios text[],
  p_fecha_publicacion timestamptz default now(),
  p_fecha_fin timestamptz default null,
  p_es_borrador boolean default false,
  p_imagen_thumb_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona_id uuid;
  v_permitidos text[];
  v_anuncio_id uuid;
  v_titulo text := btrim(p_titulo);
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

  if v_titulo is null or char_length(v_titulo) < 2 or char_length(v_titulo) > 150 then
    raise exception 'ANUNCIO_TITULO_INVALIDO' using errcode = 'P0001';
  end if;

  if p_imagen_orientacion not in ('CUADRADA', 'VERTICAL') then
    raise exception 'ANUNCIO_ORIENTACION_INVALIDA' using errcode = 'P0001';
  end if;

  if p_imagen_path is null or btrim(p_imagen_path) = '' then
    raise exception 'ANUNCIO_IMAGEN_REQUERIDA' using errcode = 'P0001';
  end if;

  if p_roles_destinatarios is null or cardinality(p_roles_destinatarios) = 0 then
    raise exception 'ANUNCIO_DESTINATARIOS_REQUERIDOS' using errcode = 'P0001';
  end if;

  v_permitidos := public.fn_anuncio_roles_disponibles(p_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids);
  if not (p_roles_destinatarios <@ v_permitidos) then
    raise exception 'ANUNCIO_DESTINATARIOS_NO_PERMITIDOS' using errcode = 'P0001';
  end if;

  if p_fecha_fin is not null and p_fecha_fin < coalesce(p_fecha_publicacion, now()) then
    raise exception 'ANUNCIO_FECHAS_INVALIDAS' using errcode = 'P0001';
  end if;

  v_persona_id := public.fn_mi_persona_id();
  if v_persona_id is null then
    raise exception 'ANUNCIO_SIN_PERSONA' using errcode = 'P0001';
  end if;

  insert into public.anuncio (
    iglesia_id, alcance_tipo, autor_persona_id, titulo, mensaje, imagen_path, imagen_thumb_path,
    imagen_orientacion, roles_destinatarios, fecha_publicacion, fecha_fin,
    es_borrador, creado_por, actualizado_por
  ) values (
    p_iglesia_id, p_alcance_tipo, v_persona_id, v_titulo, nullif(btrim(p_mensaje), ''), p_imagen_path, p_imagen_thumb_path,
    p_imagen_orientacion, p_roles_destinatarios, coalesce(p_fecha_publicacion, now()), p_fecha_fin,
    coalesce(p_es_borrador, false), (select auth.uid()), (select auth.uid())
  )
  returning id into v_anuncio_id;

  if p_alcance_tipo = 'RED' then
    insert into public.anuncio_alcance_red (anuncio_id, red_id, creado_por, actualizado_por)
    select v_anuncio_id, rid, (select auth.uid()), (select auth.uid())
    from unnest(p_red_ids) as rid;
  elsif p_alcance_tipo = 'CDP' then
    insert into public.anuncio_alcance_cdp (anuncio_id, casa_de_paz_id, creado_por, actualizado_por)
    select v_anuncio_id, cid, (select auth.uid()), (select auth.uid())
    from unnest(p_cdp_ids) as cid;
  end if;

  return v_anuncio_id;
end;
$$;

revoke all on function public.fn_anuncio_crear(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean, text)
  from public, anon;
grant execute on function public.fn_anuncio_crear(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean, text)
  to authenticated;

drop function if exists public.fn_anuncio_actualizar(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean);

create function public.fn_anuncio_actualizar(
  p_anuncio_id uuid,
  p_alcance_tipo text,
  p_red_ids uuid[],
  p_cdp_ids uuid[],
  p_titulo text,
  p_mensaje text,
  p_imagen_path text,
  p_imagen_orientacion text,
  p_roles_destinatarios text[],
  p_fecha_publicacion timestamptz,
  p_fecha_fin timestamptz,
  p_mostrar_nuevamente boolean default false,
  p_imagen_thumb_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_permitidos text[];
  v_titulo text := btrim(p_titulo);
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select iglesia_id into v_iglesia_id
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if p_alcance_tipo not in ('IGLESIA', 'RED', 'CDP') then
    raise exception 'ANUNCIO_ALCANCE_INVALIDO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_puede_administrar_alcance(v_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  if v_titulo is null or char_length(v_titulo) < 2 or char_length(v_titulo) > 150 then
    raise exception 'ANUNCIO_TITULO_INVALIDO' using errcode = 'P0001';
  end if;

  if p_imagen_orientacion not in ('CUADRADA', 'VERTICAL') then
    raise exception 'ANUNCIO_ORIENTACION_INVALIDA' using errcode = 'P0001';
  end if;

  if p_imagen_path is null or btrim(p_imagen_path) = '' then
    raise exception 'ANUNCIO_IMAGEN_REQUERIDA' using errcode = 'P0001';
  end if;

  if p_roles_destinatarios is null or cardinality(p_roles_destinatarios) = 0 then
    raise exception 'ANUNCIO_DESTINATARIOS_REQUERIDOS' using errcode = 'P0001';
  end if;

  v_permitidos := public.fn_anuncio_roles_disponibles(v_iglesia_id, p_alcance_tipo, p_red_ids, p_cdp_ids);
  if not (p_roles_destinatarios <@ v_permitidos) then
    raise exception 'ANUNCIO_DESTINATARIOS_NO_PERMITIDOS' using errcode = 'P0001';
  end if;

  if p_fecha_fin is not null and p_fecha_fin < coalesce(p_fecha_publicacion, now()) then
    raise exception 'ANUNCIO_FECHAS_INVALIDAS' using errcode = 'P0001';
  end if;

  update public.anuncio set
    alcance_tipo = p_alcance_tipo,
    titulo = v_titulo,
    mensaje = nullif(btrim(p_mensaje), ''),
    imagen_path = p_imagen_path,
    imagen_thumb_path = p_imagen_thumb_path,
    imagen_orientacion = p_imagen_orientacion,
    roles_destinatarios = p_roles_destinatarios,
    fecha_publicacion = coalesce(p_fecha_publicacion, fecha_publicacion),
    fecha_fin = p_fecha_fin,
    actualizado_por = (select auth.uid())
  where id = p_anuncio_id;

  update public.anuncio_alcance_red
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where anuncio_id = p_anuncio_id and fecha_eliminacion is null;

  update public.anuncio_alcance_cdp
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where anuncio_id = p_anuncio_id and fecha_eliminacion is null;

  if p_alcance_tipo = 'RED' then
    insert into public.anuncio_alcance_red (anuncio_id, red_id, creado_por, actualizado_por)
    select p_anuncio_id, rid, (select auth.uid()), (select auth.uid())
    from unnest(p_red_ids) as rid;
  elsif p_alcance_tipo = 'CDP' then
    insert into public.anuncio_alcance_cdp (anuncio_id, casa_de_paz_id, creado_por, actualizado_por)
    select p_anuncio_id, cid, (select auth.uid()), (select auth.uid())
    from unnest(p_cdp_ids) as cid;
  end if;

  if p_mostrar_nuevamente then
    update public.anuncio_visto
    set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
    where anuncio_id = p_anuncio_id and fecha_eliminacion is null;
  end if;

  return p_anuncio_id;
end;
$$;

revoke all on function public.fn_anuncio_actualizar(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean, text)
  from public, anon;
grant execute on function public.fn_anuncio_actualizar(uuid, text, uuid[], uuid[], text, text, text, text, text[], timestamptz, timestamptz, boolean, text)
  to authenticated;

drop function if exists public.fn_mis_anuncios_gestion(uuid, uuid);

create function public.fn_mis_anuncios_gestion(p_iglesia_id uuid, p_red_id uuid default null)
returns table (
  id uuid,
  alcance_tipo text,
  redes jsonb,
  casas_de_paz jsonb,
  titulo text,
  mensaje text,
  imagen_path text,
  imagen_thumb_path text,
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
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'lider_nombre', (
          select public.fn_nombre_completo(pl)
          from public.casa_de_paz_cargo ccl
          join public.cargo cl on cl.id = ccl.cargo_id and cl.codigo = 'LIDER_CDP'
          join public.persona pl on pl.id = ccl.persona_id
          where ccl.casa_de_paz_id = c.id and ccl.fecha_fin is null and ccl.fecha_eliminacion is null
          limit 1
        ),
        'zona', (
          select d.zona
          from public.direccion_asignacion da
          join public.direccion d on d.id = da.direccion_id
          where da.casa_de_paz_id = c.id and da.activo and da.fecha_eliminacion is null
          limit 1
        )
      )), '[]'::jsonb)
      from public.anuncio_alcance_cdp ac
      join public.casa_de_paz c on c.id = ac.casa_de_paz_id
      where ac.anuncio_id = a.id and ac.fecha_eliminacion is null
    ),
    a.titulo::text, a.mensaje, a.imagen_path, a.imagen_thumb_path,
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

revoke all on function public.fn_mis_anuncios_gestion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_mis_anuncios_gestion(uuid, uuid) to authenticated;

commit;
