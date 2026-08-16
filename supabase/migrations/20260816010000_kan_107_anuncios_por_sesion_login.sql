-- VisionHub -- T6 (KAN-107), correccion de comportamiento pedida por el
-- owner 2026-08-16: "estos son anuncios de INICIO DE SESION -- la persona
-- los debe ver siempre, en cada inicio de sesion, mientras sigan activos".
--
-- El diseño original (T7, "shown-once-then-closed") marcaba un anuncio
-- CERRADO para siempre por persona -- una vez cerrado, nunca mas volvia a
-- aparecer aunque el anuncio siguiera activo semanas despues. Eso caus'o
-- ademas un bug real (reportado por el owner, encontrado con datos reales
-- en produccion): un cierre accidental durante pruebas dejo su propio
-- anuncio real invisible para siempre.
--
-- Nuevo criterio: "cerrado" solo cuenta dentro de la MISMA sesion de login
-- (auth.jwt()->>'session_id', un uuid que Supabase cambia en cada login
-- real -- confirmado en el JWT real de esta sesion). Cerrar el anuncio dos
-- veces en la misma sesion sigue sin mostrarlo de nuevo hasta refrescar la
-- pagina otra vez; pero un login nuevo (session_id distinto) siempre lo
-- vuelve a mostrar mientras el anuncio siga activo y dentro de su ventana.
-- Las filas viejas (de antes de esta migracion) quedan con sesion_id NULL,
-- que nunca coincide con ninguna sesion real -- se auto-resuelven solas,
-- sin necesitar tocar datos a mano.

begin;

alter table public.anuncio_visto
  add column if not exists sesion_id text;

create or replace function public.fn_anuncios_pendientes()
returns table (
  id uuid,
  iglesia_id uuid,
  red_id uuid,
  titulo text,
  mensaje text,
  imagen_path text,
  imagen_orientacion text,
  prioridad smallint,
  fecha_publicacion timestamptz
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

  return query
  select a.id, a.iglesia_id, a.red_id, a.titulo::text, a.mensaje, a.imagen_path,
         a.imagen_orientacion::text, a.prioridad, a.fecha_publicacion
  from public.anuncio a
  where a.fecha_eliminacion is null
    and a.activo
    and not a.es_borrador
    and a.fecha_publicacion <= now()
    and (a.fecha_fin is null or a.fecha_fin >= now())
    and a.iglesia_id in (select public.fn_mis_iglesias())
    and private.fn_anuncio_es_destinatario(a.id)
    and not exists (
      select 1 from public.anuncio_visto v
      where v.anuncio_id = a.id and v.persona_id = public.fn_mi_persona_id()
        and v.estado = 'CERRADO' and v.fecha_eliminacion is null
        and v.sesion_id = (select auth.jwt() ->> 'session_id')
    )
  order by a.prioridad desc, a.fecha_publicacion asc;
end;
$$;

create or replace function public.fn_anuncio_marcar_mostrado(p_anuncio_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_es_destinatario(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  v_persona_id := public.fn_mi_persona_id();

  -- OJO: el DO UPDATE nunca toca `estado` ni `sesion_id` -- si la fila ya
  -- existia CERRADA de una sesion anterior, "marcar mostrado" (que se
  -- dispara solo, apenas el anuncio vuelve a quedar pendiente) NO debe
  -- heredarle el session_id nuevo a ese cierre viejo, o el anuncio quedaria
  -- "precerrado" en la sesion nueva antes de que la persona lo cierre de
  -- verdad ahi. Solo fn_anuncio_cerrar (mas abajo) escribe sesion_id.
  insert into public.anuncio_visto (anuncio_id, persona_id, estado, fecha_mostrado, sesion_id, creado_por, actualizado_por)
  values (p_anuncio_id, v_persona_id, 'MOSTRADO', now(), (select auth.jwt() ->> 'session_id'), (select auth.uid()), (select auth.uid()))
  on conflict (anuncio_id, persona_id) where fecha_eliminacion is null
  do nothing;
end;
$$;

create or replace function public.fn_anuncio_cerrar(p_anuncio_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  v_persona_id := public.fn_mi_persona_id();
  if v_persona_id is null then
    raise exception 'ANUNCIO_SIN_PERSONA' using errcode = 'P0001';
  end if;

  insert into public.anuncio_visto (
    anuncio_id, persona_id, estado, fecha_mostrado, fecha_cierre, sesion_id, creado_por, actualizado_por
  ) values (
    p_anuncio_id, v_persona_id, 'CERRADO', now(), now(), (select auth.jwt() ->> 'session_id'), (select auth.uid()), (select auth.uid())
  )
  on conflict (anuncio_id, persona_id) where fecha_eliminacion is null
  do update set estado = 'CERRADO', fecha_cierre = now(), sesion_id = (select auth.jwt() ->> 'session_id'), actualizado_por = (select auth.uid());
end;
$$;

commit;
