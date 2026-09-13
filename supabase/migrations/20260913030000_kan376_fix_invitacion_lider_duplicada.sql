-- VisionHub -- KAN-376: invitación de líder que queda como "estado fantasma"
-- (vinculada pero sin poder reenviarse ni cancelarse).
--
-- Causa raíz real (verificado contra producción, caso
-- leonosinagafelipa@gmail.com y 2 más con el mismo patrón):
-- fn_invitar_lider insertaba una fila nueva en invitacion_lider Y en
-- usuario_rol en CADA llamada, sin chequear si la persona ya tenía una
-- invitación PENDIENTE para el mismo destino, o ya tenía un usuario_rol
-- activo para el mismo rol+iglesia. Cada vez que alguien reintentaba
-- "Invitar" (en vez de "Reenviar", pensando que no había funcionado) se
-- creaba un duplicado completo. usuario_rol no tiene columna de destino
-- (esa granularidad vive en casa_de_paz_cargo/red_cargo, que solo se
-- crean al aceptar la invitación vía fn_completar_membresia) -- no hay
-- ningún caso legítimo en el que la misma persona necesite 2 filas
-- usuario_rol activas para el mismo rol en la misma iglesia, así que
-- alcanza con impedir el duplicado en el origen: fn_cancelar_invitacion_lider
-- no necesita cambios, su UPDATE deja de tener más de una fila para
-- afectar una vez que esto se corrige acá.
--
-- El efecto real de los duplicados fue peor que solo "ruido": al cancelar
-- UNA de las invitaciones duplicadas, fn_cancelar_invitacion_lider borraba
-- el usuario_rol de TODAS (mismo usuario_id+rol+iglesia), lo que disparaba
-- la condición de "cuenta huérfana" en el edge function invitar-lider y
-- terminaba baneando la cuenta por 100 años -- mientras las OTRAS
-- invitaciones duplicadas seguían PENDIENTE, ahora apuntando a una cuenta
-- baneada. Eso es el "no puede reenviarse ni eliminarse" del ticket.

begin;

create or replace function public.fn_invitar_lider(
  p_usuario_id uuid, p_correo text, p_rol rol_sistema_enum,
  p_red_id uuid default null, p_casa_de_paz_id uuid default null, p_departamento_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
begin
  if not public.fn_puede_invitar_lider(p_rol, p_red_id, p_casa_de_paz_id, p_departamento_id) then
    raise exception 'INVITACION_LIDER_SIN_PERMISO: no tenes permiso para invitar aqui' using errcode = 'P0001';
  end if;

  if p_departamento_id is not null then
    if exists (
      select 1 from public.invitacion_lider
      where correo = p_correo and departamento_id = p_departamento_id
        and estado = 'PENDIENTE' and fecha_eliminacion is null
    ) then
      raise exception 'INVITACION_LIDER_YA_PENDIENTE: ya existe una invitacion pendiente para esta persona en este destino -- usa Reenviar en vez de invitar de nuevo' using errcode = 'P0001';
    end if;

    select iglesia_id into v_iglesia_id from public.departamento where id = p_departamento_id;
    select id into v_cargo_id from public.cargo where codigo = 'LIDER_DEPARTAMENTO' and activo;
    if v_cargo_id is null then
      raise exception 'INVITACION_LIDER_CARGO_INEXISTENTE: no existe el cargo LIDER_DEPARTAMENTO en el catalogo' using errcode = 'P0001';
    end if;

    insert into public.invitacion_lider (usuario_id, correo, iglesia_id, rol, departamento_id, cargo_id)
    values (p_usuario_id, p_correo, v_iglesia_id, null, p_departamento_id, v_cargo_id);
    return;
  end if;

  if exists (
    select 1 from public.invitacion_lider
    where correo = p_correo and rol = p_rol
      and ((p_red_id is not null and red_id = p_red_id) or (p_casa_de_paz_id is not null and casa_de_paz_id = p_casa_de_paz_id))
      and estado = 'PENDIENTE' and fecha_eliminacion is null
  ) then
    raise exception 'INVITACION_LIDER_YA_PENDIENTE: ya existe una invitacion pendiente para esta persona en este destino -- usa Reenviar en vez de invitar de nuevo' using errcode = 'P0001';
  end if;

  if p_rol = 'LIDER_RED' then
    select iglesia_id into v_iglesia_id from public.red where id = p_red_id;
  else
    select iglesia_id into v_iglesia_id from public.casa_de_paz where id = p_casa_de_paz_id;
  end if;

  select id into v_cargo_id from public.cargo where codigo = p_rol::text and activo;
  if v_cargo_id is null then
    raise exception 'INVITACION_LIDER_CARGO_INEXISTENTE: no existe el cargo % en el catalogo', p_rol using errcode = 'P0001';
  end if;

  -- usuario_rol no distingue destino (esa granularidad es de
  -- casa_de_paz_cargo/red_cargo) -- nunca hace falta mas de una fila
  -- activa por usuario+rol+iglesia, evita el duplicado silencioso.
  if not exists (
    select 1 from public.usuario_rol
    where usuario_id = p_usuario_id and rol = p_rol and iglesia_id = v_iglesia_id and fecha_eliminacion is null
  ) then
    insert into public.usuario_rol (usuario_id, rol, iglesia_id) values (p_usuario_id, p_rol, v_iglesia_id);
  end if;

  insert into public.invitacion_lider (usuario_id, correo, iglesia_id, rol, red_id, casa_de_paz_id, cargo_id)
  values (p_usuario_id, p_correo, v_iglesia_id, p_rol, p_red_id, p_casa_de_paz_id, v_cargo_id);
end;
$function$;

-- Reparacion de datos real: 3 personas reales quedaron con invitaciones
-- PENDIENTE duplicadas para el mismo destino por este bug
-- (leonosinagafelipa@gmail.com, bravobravolidia@gmail.com,
-- vivianariarteguamankairos@gmail.com -- verificado con consulta directa
-- antes de este fix). Genérico a proposito (no hardcodea esos 3
-- correos): cancela todas las duplicadas de cualquier grupo
-- correo+rol+destino, dejando solo la mas reciente PENDIENTE.
with duplicadas as (
  select id,
    row_number() over (
      partition by correo, rol, coalesce(red_id, casa_de_paz_id, departamento_id)
      order by fecha_creacion desc
    ) as orden
  from public.invitacion_lider
  where estado = 'PENDIENTE' and fecha_eliminacion is null
)
update public.invitacion_lider
set fecha_eliminacion = now()
where id in (select id from duplicadas where orden > 1);

-- Mismo criterio para usuario_rol, pero acotado a las personas que
-- tenian el patron confirmado de arriba (invitacion_lider duplicada) --
-- no toca los otros casos de usuario_rol duplicado sin invitacion de por
-- medio (sintoma distinto, fuera de alcance de este ticket, documentado
-- en Jira/memoria aparte).
with duplicadas_rol as (
  select ur.id,
    row_number() over (
      partition by ur.usuario_id, ur.rol, ur.iglesia_id
      order by ur.fecha_creacion desc
    ) as orden
  from public.usuario_rol ur
  where ur.fecha_eliminacion is null
    and exists (
      select 1 from public.invitacion_lider il
      where il.usuario_id = ur.usuario_id and il.rol = ur.rol
        and il.fecha_eliminacion is not null
        and il.fecha_eliminacion >= now() - interval '1 minute'
    )
)
update public.usuario_rol
set fecha_eliminacion = now()
where id in (select id from duplicadas_rol where orden > 1);

-- Desbanear: una cuenta baneada que todavia tiene una invitacion
-- PENDIENTE real es, por definicion, una victima de este mismo bug
-- (fn_cancelar_invitacion_lider la baneo por error al cancelar un
-- duplicado, ver comentario de arriba) -- nunca tuvo oportunidad real de
-- aceptar. Generico a proposito, no hardcodea correos.
update auth.users u
set banned_until = null
where u.banned_until is not null and u.banned_until > now()
  and exists (
    select 1 from public.invitacion_lider il
    where il.usuario_id = u.id and il.estado = 'PENDIENTE' and il.fecha_eliminacion is null
  );

-- Defensa en profundidad: garantiza a nivel de base de datos que no puede
-- volver a existir mas de una invitacion PENDIENTE para la misma persona
-- en el mismo destino, sin importar que camino de codigo la cree.
-- NULLS NOT DISTINCT (PG15+, este proyecto corre PG17) porque "rol" es
-- NULL en toda invitacion de departamento -- sin esto, dos invitaciones
-- de departamento duplicadas para la misma persona/destino no chocarian
-- (Postgres trata cada NULL como distinto por default).
create unique index if not exists uq_invitacion_lider_pendiente_destino
  on public.invitacion_lider (correo, rol, coalesce(red_id, casa_de_paz_id, departamento_id))
  nulls not distinct
  where estado = 'PENDIENTE' and fecha_eliminacion is null;

commit;
