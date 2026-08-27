-- VisionHub -- KAN-263: reenviar invitación desde la ficha de la entidad
-- (Red, Casa de Paz, Departamento, Pastor/Supervisor), no solo mientras
-- invitacion_lider sigue en estado PENDIENTE.
--
-- Nota: este SQL ya se había corrido a mano en producción el 2026-08-26
-- (rama abandonada `kan-reenviar-invitacion`, para evitar chocar con el
-- trabajo paralelo de Matías) -- se vuelve a incluir acá solo para que
-- quede en el historial de git/migraciones. Todo el cuerpo es idempotente
-- (`create or replace` / `drop if exists`), así que aplicarlo de nuevo no
-- tiene efecto además de registrarlo.
--
-- Motivo (pedido del owner, viendo ent1.png/ent2.png): desde KAN-252
-- (20260825180000_kan252_invitacion_acepta_crea_persona.sql),
-- fn_aceptar_invitacion_lider crea la Persona (nombre vacío) y el cargo real
-- en el PRIMER login, y ahí mismo invitacion_lider pasa a 'COMPLETADA' --
-- aunque la persona nunca haya terminado el formulario de Membresía. El
-- botón "Reenviar" que ya existe (PanelRedEstructura/PanelCasaDePazEstructura/
-- PanelDepartamentoEstructura, sección "Invitaciones pendientes") solo mira
-- invitacion_lider.estado = 'PENDIENTE', así que deja de poder usarse justo
-- para el caso que preocupa al owner: alguien que sí entró una vez pero
-- quedó a medias, "perdido", varios días después mostrando solo su correo.
-- Pastor/Supervisor de la Visión en Acción (invitar-usuario, sin ninguna fila
-- de seguimiento) nunca tuvieron reenvío en ningún escenario.
--
-- Señal real a usar: persona.membresia_completada = false, sin importar el
-- estado de invitacion_lider. Se agregan 4 RPC de solo-lectura (mismo patrón
-- 1:1 que fn_estructura_datos_notificacion_cargo_{red,cdp,departamento,
-- principal}, mismos chequeos de permiso ya probados) que devuelven además
-- usuario_id/membresia_completada/si el correo ya fue confirmado alguna vez
-- -- la Edge Function nueva (reenviar-invitacion-cargo) usa esos 2 últimos
-- datos para decidir CÓMO reenviar:
--   * cuenta nunca confirmada (nunca aceptó ningún enlace) -> reenviar el
--     mismo invite de Supabase Auth (auth.admin.inviteUserByEmail), igual
--     que ya hace invitar-lider/invitar-usuario -- Supabase invalida el
--     enlace anterior y genera uno nuevo (el último enviado es el único
--     válido, no se acumulan enlaces vivos).
--   * cuenta ya confirmada (ya inició sesión al menos una vez, por eso tiene
--     Persona/cargo) pero membresía incompleta -> no se le puede volver a
--     "invitar" (ya no está pendiente para Supabase Auth) -- se le manda un
--     recordatorio propio por Brevo con un enlace a /login (sirve tanto para
--     quien usa contraseña como para quien entra con Google).
--
-- fn_listar_usuarios (Pastor/Supervisor/Super Admin) también se extiende con
-- membresia_completada -- sin esa columna, el mismo hueco existía para
-- Pastor/Supervisor de la Visión en Acción.

begin;

drop function if exists public.fn_listar_usuarios(uuid);

create or replace function public.fn_listar_usuarios(p_iglesia_id uuid default null)
returns table (
  usuario_rol_id uuid, usuario_id uuid, correo varchar, rol rol_sistema_enum,
  iglesia_id uuid, iglesia_nombre varchar, persona_id uuid, persona_nombre text,
  es_principal boolean, membresia_completada boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (fn_es_super_admin() or (p_iglesia_id is not null and (fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id)))) then
    raise exception 'ADMIN_FUERA_DE_ALCANCE: se requiere ser Super Admin o Pastor/Supervisor de la iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select
    ur.id, ur.usuario_id, u.email::varchar, ur.rol,
    ur.iglesia_id, i.nombre, p.id, fn_nombre_completo(p), ur.es_principal,
    coalesce(p.membresia_completada, false)
  from usuario_rol ur
  join auth.users u on u.id = ur.usuario_id
  left join iglesia i on i.id = ur.iglesia_id
  left join persona p on p.usuario_id = ur.usuario_id and p.iglesia_id = ur.iglesia_id and p.fecha_eliminacion is null
  where ur.fecha_eliminacion is null
    and ur.rol in ('SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION')
    and (p_iglesia_id is null or ur.iglesia_id = p_iglesia_id)
  order by u.email;
end;
$$;

-- Mismo chequeo de permiso ya probado que su gemela fn_estructura_datos_
-- notificacion_cargo_red (líder de la propia Red incluido).
create or replace function public.fn_estructura_datos_reenvio_cargo_red(
  p_red_id uuid,
  p_persona_id uuid
)
returns table(correo text, persona_nombre text, iglesia_nombre text, usuario_id uuid, membresia_completada boolean, invitado_confirmado boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select r.iglesia_id into v_iglesia_id from public.red r where r.id = p_red_id;
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar_red(v_iglesia_id, p_red_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    coalesce(p.correo, u.email)::text,
    public.fn_nombre_completo(p),
    i.nombre::text,
    p.usuario_id,
    coalesce(p.membresia_completada, false),
    (u.email_confirmed_at is not null)
  from public.persona p
  join public.red r on r.id = p_red_id
  join public.iglesia i on i.id = r.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_reenvio_cargo_red(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_reenvio_cargo_red(uuid, uuid) to authenticated;

create or replace function public.fn_estructura_datos_reenvio_cargo_cdp(
  p_cdp_id uuid,
  p_persona_id uuid
)
returns table(correo text, persona_nombre text, iglesia_nombre text, usuario_id uuid, membresia_completada boolean, invitado_confirmado boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select c.iglesia_id into v_iglesia_id from public.casa_de_paz c where c.id = p_cdp_id;
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    coalesce(p.correo, u.email)::text,
    public.fn_nombre_completo(p),
    i.nombre::text,
    p.usuario_id,
    coalesce(p.membresia_completada, false),
    (u.email_confirmed_at is not null)
  from public.persona p
  join public.casa_de_paz c on c.id = p_cdp_id
  join public.iglesia i on i.id = c.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_reenvio_cargo_cdp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_reenvio_cargo_cdp(uuid, uuid) to authenticated;

create or replace function public.fn_estructura_datos_reenvio_cargo_departamento(
  p_departamento_id uuid,
  p_persona_id uuid
)
returns table(correo text, persona_nombre text, iglesia_nombre text, usuario_id uuid, membresia_completada boolean, invitado_confirmado boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  select d.iglesia_id into v_iglesia_id from public.departamento d where d.id = p_departamento_id;
  if v_iglesia_id is null or not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    coalesce(p.correo, u.email)::text,
    public.fn_nombre_completo(p),
    i.nombre::text,
    p.usuario_id,
    coalesce(p.membresia_completada, false),
    (u.email_confirmed_at is not null)
  from public.persona p
  join public.departamento d on d.id = p_departamento_id
  join public.iglesia i on i.id = d.iglesia_id
  left join auth.users u on u.id = p.usuario_id
  where p.id = p_persona_id and p.fecha_eliminacion is null;
end;
$$;

revoke all on function public.fn_estructura_datos_reenvio_cargo_departamento(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_reenvio_cargo_departamento(uuid, uuid) to authenticated;

-- p_persona_id acepta TANTO un persona.id real COMO, en el caso puntual de
-- Pastor/Supervisor recién invitado que nunca inició sesión ni una vez
-- (usuario_rol ya existe vía fn_asignar_rol_recien_invitado, pero la Persona
-- recién se crea al primer login -- KAN-179), un usuario_rol.usuario_id de
-- respaldo (mismo criterio que ya usa responsablesRol en
-- estructura.service.ts: `usuario.persona_id ?? usuario.usuario_id`).
create or replace function public.fn_estructura_datos_reenvio_cargo_principal(
  p_iglesia_id uuid,
  p_persona_id uuid
)
returns table(correo text, persona_nombre text, iglesia_nombre text, usuario_id uuid, membresia_completada boolean, invitado_confirmado boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_iglesia_id is null or not private.fn_estructura_puede_administrar(p_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  return query
  select
    coalesce(p.correo, u.email)::text,
    coalesce(public.fn_nombre_completo(p), ''),
    i.nombre::text,
    coalesce(p.usuario_id, u.id),
    coalesce(p.membresia_completada, false),
    (u.email_confirmed_at is not null)
  from public.iglesia i
  left join public.persona p on p.id = p_persona_id and p.fecha_eliminacion is null
  left join auth.users u on u.id = coalesce(p.usuario_id, p_persona_id)
  where i.id = p_iglesia_id
  limit 1;
end;
$$;

revoke all on function public.fn_estructura_datos_reenvio_cargo_principal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_datos_reenvio_cargo_principal(uuid, uuid) to authenticated;

commit;
