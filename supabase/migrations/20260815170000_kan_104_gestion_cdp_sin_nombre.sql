-- VisionHub -- fn_mis_anuncios_gestion mostraba casa_de_paz.nombre para
-- anuncios con alcance CDP puntual -- las Casas de Paz no tienen nombre
-- propio hace tiempo, asi que la fila de gestion quedaba con un nombre en
-- blanco cuando el alcance era una sola CdP. Mismo criterio que
-- fn_anuncio_mi_capacidad (20260815160000): se identifican por su Lider y
-- la zona del anfitrion.

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

commit;
