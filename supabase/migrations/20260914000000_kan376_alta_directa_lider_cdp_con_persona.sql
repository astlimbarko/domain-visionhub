-- VisionHub -- KAN-376 seguimiento (2026-09-14): la primera version de
-- "asignar contraseña directamente" (checkbox en AsignarCargoDialog) solo
-- creaba la cuenta de Auth con contraseña -- la Persona y el cargo real
-- (casa_de_paz_cargo) seguian sin existir hasta que alguien (el invitado, o
-- el admin logueado como el) completara "Tu nombre" del wizard. En la
-- practica eso dejaba a la persona en un estado intermedio raro: cuenta
-- utilizable, pero SIN rol real todavia, mostrada solo como "correo --
-- invitacion pendiente" en el Constructor -- exactamente el caso de
-- leonosinagafelipa@gmail.com que motivo esta vuelta.
--
-- Pedido explicito del owner: que el checkbox tambien pida nombre/apellido/
-- sexo ahi mismo, y cree TODO de una sola vez (Persona real + cargo real +
-- contraseña), sin dejar ninguna invitacion PENDIENTE de por medio. Alcance
-- acotado a Lider/Sublider de Casa de Paz (mismo criterio que el resto de
-- este seguimiento, "primero que funcione para lider y sublider").

begin;

create or replace function public.fn_alta_directa_lider_cdp(
  p_usuario_id uuid,
  p_correo text,
  p_rol rol_sistema_enum,
  p_casa_de_paz_id uuid,
  p_primer_nombre text,
  p_segundo_nombre text,
  p_primer_apellido text,
  p_segundo_apellido text,
  p_sexo text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_iglesia_id uuid;
  v_cargo_id uuid;
  v_persona_id uuid;
begin
  if p_rol not in ('LIDER_CDP', 'SUBLIDER_CDP') then
    raise exception 'ALTA_DIRECTA_ROL_NO_SOPORTADO: por ahora solo Lider/Sublider de Casa de Paz' using errcode = 'P0001';
  end if;

  if not public.fn_puede_invitar_lider(p_rol, null, p_casa_de_paz_id, null) then
    raise exception 'INVITACION_LIDER_SIN_PERMISO: no tenes permiso para asignar aqui' using errcode = 'P0001';
  end if;

  -- Mismo piso que el trigger de Persona exige (nombre/apellido/sexo
  -- reales) -- se valida acá también para dar un mensaje claro antes de
  -- llegar al INSERT.
  if p_primer_nombre is null or trim(p_primer_nombre) = ''
     or p_primer_apellido is null or trim(p_primer_apellido) = ''
     or p_sexo is null then
    raise exception 'ALTA_DIRECTA_DATOS_INCOMPLETOS: nombre, apellido y sexo son obligatorios' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.persona where usuario_id = p_usuario_id and fecha_eliminacion is null) then
    raise exception 'ALTA_DIRECTA_YA_TIENE_PERSONA: esta cuenta ya tiene una persona asociada' using errcode = 'P0001';
  end if;

  select iglesia_id into v_iglesia_id from public.casa_de_paz where id = p_casa_de_paz_id and fecha_eliminacion is null;
  if v_iglesia_id is null then
    raise exception 'ALTA_DIRECTA_CDP_INEXISTENTE: la casa de paz no existe' using errcode = 'P0001';
  end if;

  select id into v_cargo_id from public.cargo where codigo = p_rol::text and activo;
  if v_cargo_id is null then
    raise exception 'INVITACION_LIDER_CARGO_INEXISTENTE: no existe el cargo % en el catalogo', p_rol using errcode = 'P0001';
  end if;

  -- Mismo criterio de dedupe que fn_invitar_lider (usuario_rol no
  -- distingue destino, nunca hace falta mas de una fila activa).
  if not exists (
    select 1 from public.usuario_rol
    where usuario_id = p_usuario_id and rol = p_rol and iglesia_id = v_iglesia_id and fecha_eliminacion is null
  ) then
    insert into public.usuario_rol (usuario_id, rol, iglesia_id) values (p_usuario_id, p_rol, v_iglesia_id);
  end if;

  insert into public.persona (
    iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo,
    correo, membresia_completada, creado_por
  )
  values (
    v_iglesia_id, p_usuario_id, trim(p_primer_nombre), nullif(trim(coalesce(p_segundo_nombre, '')), ''),
    trim(p_primer_apellido), nullif(trim(coalesce(p_segundo_apellido, '')), ''), p_sexo::sexo_enum,
    p_correo, false, (select auth.uid())
  )
  returning id into v_persona_id;

  -- Mismo patron que fn_aceptar_invitacion_lider: LIDER_CDP es exclusivo
  -- (termina el cargo vigente anterior si lo hubiera), SUBLIDER_CDP no.
  if p_rol = 'LIDER_CDP' then
    update public.casa_de_paz_cargo set fecha_fin = current_date
    where casa_de_paz_id = p_casa_de_paz_id and cargo_id = v_cargo_id and fecha_fin is null and fecha_eliminacion is null;
  end if;

  insert into public.casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
  values (v_iglesia_id, p_casa_de_paz_id, v_persona_id, v_cargo_id, current_date);

  perform private.fn_asegurar_membresia_cdp_por_cargo(v_persona_id, v_iglesia_id, p_casa_de_paz_id);

  -- Registro de auditoria (misma tabla que las invitaciones reales), ya
  -- COMPLETADA -- no aparece como "pendiente" en ningun listado, pero deja
  -- constancia de quien/cuando se dio de alta asi, igual que una invitacion
  -- normal que se acepto.
  insert into public.invitacion_lider (usuario_id, correo, iglesia_id, rol, casa_de_paz_id, cargo_id, estado, fecha_completada)
  values (p_usuario_id, p_correo, v_iglesia_id, p_rol, p_casa_de_paz_id, v_cargo_id, 'COMPLETADA', now());

  return v_persona_id;
end;
$function$;

grant execute on function public.fn_alta_directa_lider_cdp(uuid, text, rol_sistema_enum, uuid, text, text, text, text, text) to authenticated;

commit;
