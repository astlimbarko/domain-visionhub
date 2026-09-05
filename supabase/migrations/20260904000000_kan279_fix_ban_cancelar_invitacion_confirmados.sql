-- VisionHub -- KAN-279: fn_cancelar_invitacion_lider baneaba por 100 años
-- (invitar-lider banea `usuario_id_a_borrar` con ban_duration="876000h") a
-- CUALQUIER cuenta que quedara sin persona ni usuario_rol tras cancelar una
-- invitación -- sin chequear si esa cuenta alguna vez confirmó su correo de
-- verdad. Le pasó a 2 cuentas reales: alguien cancelaba lo que parecía una
-- invitación "muerta" (sin Persona todavía, por el hueco de KAN-252 en un
-- caso, o por un motivo similar en el otro) sin saber que la persona ya
-- había confirmado su correo y logueado -- quedaban baneadas sin ningún
-- rastro visible en el Constructor. Fix: solo se banea si la cuenta NUNCA
-- confirmó su correo (auth.users.email_confirmed_at is null).
--
-- Se agrega además una auditoría de solo lectura (Super Admin) para
-- detectar si esto vuelve a pasar en el futuro, sin tener que ir a mano por
-- SQL cada vez.

begin;

create or replace function public.fn_cancelar_invitacion_lider(p_invitacion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inv public.invitacion_lider;
  v_puede boolean;
  v_cargo_codigo text;
  v_usuario_a_borrar uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select * into v_inv from public.invitacion_lider
  where id = p_invitacion_id and fecha_eliminacion is null;

  if not found or v_inv.estado <> 'PENDIENTE' then
    raise exception 'INVITACION_NO_ENCONTRADA_O_YA_RESUELTA' using errcode = 'P0001';
  end if;

  v_puede := public.fn_es_super_admin()
    or public.fn_es_operativo_en(v_inv.iglesia_id)
    or public.fn_es_pastor_en(v_inv.iglesia_id)
    or (v_inv.red_id is not null and public.fn_es_lider_de_red(v_inv.red_id))
    or (v_inv.casa_de_paz_id is not null and exists (
          select 1 from public.casa_de_paz_red cr where cr.casa_de_paz_id = v_inv.casa_de_paz_id
            and cr.fecha_eliminacion is null and public.fn_es_lider_de_red(cr.red_id)
        ));

  if not v_puede then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  select c.codigo into v_cargo_codigo from public.cargo c where c.id = v_inv.cargo_id;

  update public.invitacion_lider
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where id = v_inv.id;

  update public.usuario_rol
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where usuario_id = v_inv.usuario_id and rol = v_inv.rol and iglesia_id = v_inv.iglesia_id
    and fecha_eliminacion is null;

  -- KAN-279: antes solo miraba si quedaba sin persona ni usuario_rol. Se
  -- agrega el chequeo de email_confirmed_at -- una cuenta que sí confirmó
  -- su correo alguna vez (por lo que sea que no tenga Persona todavía) NO
  -- se marca para banear, aunque haya quedado sin persona/usuario_rol.
  if not exists (select 1 from public.persona where usuario_id = v_inv.usuario_id and fecha_eliminacion is null)
     and not exists (select 1 from public.usuario_rol where usuario_id = v_inv.usuario_id and fecha_eliminacion is null)
     and not exists (select 1 from auth.users u where u.id = v_inv.usuario_id and u.email_confirmed_at is not null)
  then
    v_usuario_a_borrar := v_inv.usuario_id;
  end if;

  return jsonb_build_object(
    'usuario_id_a_borrar', v_usuario_a_borrar,
    'rol', v_inv.rol,
    'cargo_codigo', v_cargo_codigo,
    'red_id', v_inv.red_id,
    'casa_de_paz_id', v_inv.casa_de_paz_id
  );
end;
$function$;

-- Auditoría de solo lectura: cuentas confirmadas de verdad pero baneadas
-- (mismo criterio usado a mano para encontrar los 2 casos reales de
-- mariajulietavm2020@gmail.com y centrodevidascz2@gmail.com).
create or replace function public.fn_auditoria_cuentas_baneadas_por_error()
returns table(usuario_id uuid, correo varchar, email_confirmed_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.fn_es_super_admin() then
    raise exception 'ADMIN_FUERA_DE_ALCANCE: se requiere ser Super Admin' using errcode = 'P0001';
  end if;

  return query
  select u.id, u.email::varchar, u.email_confirmed_at, u.last_sign_in_at, u.banned_until
  from auth.users u
  where u.banned_until is not null
    and u.banned_until > now()
    and u.email_confirmed_at is not null
  order by u.banned_until desc;
end;
$$;

revoke all on function public.fn_auditoria_cuentas_baneadas_por_error() from public, anon, authenticated;
grant execute on function public.fn_auditoria_cuentas_baneadas_por_error() to authenticated;

commit;
