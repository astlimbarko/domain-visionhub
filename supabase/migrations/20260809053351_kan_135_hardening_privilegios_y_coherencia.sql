-- VisionHub — KAN-135: cierre de privilegios y coherencia entre entidades.
-- No modifica datos. Endurece RPC SECURITY DEFINER ya desplegadas.

begin;

revoke all on function public.fn_guardar_membresia_extendida(uuid, uuid, jsonb)
  from public, anon, authenticated;

revoke all on function public.fn_mover_persona_red(uuid, uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.fn_mover_persona_red(uuid, uuid, text, boolean, text)
  to authenticated;

revoke all on function public.fn_listar_movimientos_red_persona(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_listar_movimientos_red_persona(uuid)
  to authenticated;

revoke all on function public.fn_mi_membresia_incompleta()
  from public, anon, authenticated;
grant execute on function public.fn_mi_membresia_incompleta()
  to authenticated;

create or replace function public.fn_estructura_datos_notificacion_cargo_cdp(
  p_cdp_id uuid,
  p_persona_id uuid
)
returns table(persona_nombre text, correo text, cdp_nombre text, iglesia_nombre text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select c.iglesia_id into v_iglesia_id
  from public.casa_de_paz c
  where c.id = p_cdp_id;

  if v_iglesia_id is null or not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select public.fn_nombre_completo(p), coalesce(p.correo, u.email)::text,
         c.nombre::text, i.nombre::text
  from public.persona p
  join public.casa_de_paz c on c.id = p_cdp_id
  join public.iglesia i on i.id = c.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id
    and p.iglesia_id = v_iglesia_id
    and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_notificacion_cargo_cdp(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_notificacion_cargo_cdp(uuid, uuid)
  to authenticated;

create or replace function public.fn_estructura_datos_notificacion_cargo_principal(
  p_iglesia_id uuid,
  p_persona_id uuid
)
returns table(persona_nombre text, correo text, iglesia_nombre text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_iglesia_id is null or not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select public.fn_nombre_completo(p), coalesce(p.correo, u.email)::text, i.nombre::text
  from public.persona p
  join public.iglesia i on i.id = p_iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id
    and p.iglesia_id = p_iglesia_id
    and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_notificacion_cargo_principal(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_notificacion_cargo_principal(uuid, uuid)
  to authenticated;

create or replace function public.fn_estructura_datos_notificacion_cargo_red(
  p_red_id uuid,
  p_persona_id uuid
)
returns table(persona_nombre text, correo text, red_nombre text, iglesia_nombre text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select r.iglesia_id into v_iglesia_id
  from public.red r
  where r.id = p_red_id;

  if v_iglesia_id is null
     or not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select public.fn_nombre_completo(p), coalesce(p.correo, u.email)::text,
         r.nombre::text, i.nombre::text
  from public.persona p
  join public.red r on r.id = p_red_id
  join public.iglesia i on i.id = r.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id
    and p.iglesia_id = v_iglesia_id
    and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_notificacion_cargo_red(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_notificacion_cargo_red(uuid, uuid)
  to authenticated;

create or replace function private.fn_anuncio_puede_crear(
  p_iglesia_id uuid,
  p_red_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_red_id is null then private.fn_anuncio_es_supervisor(p_iglesia_id)
    else
      exists (
        select 1 from public.red r
        where r.id = p_red_id
          and r.iglesia_id = p_iglesia_id
          and r.fecha_eliminacion is null
      )
      and (
        private.fn_anuncio_es_supervisor(p_iglesia_id)
        or public.fn_es_lider_de_red(p_red_id)
      )
  end;
$$;

revoke all on function private.fn_anuncio_puede_crear(uuid, uuid)
  from public, anon, authenticated;

alter view public.v_reporte_totales set (security_invoker = true);

commit;
