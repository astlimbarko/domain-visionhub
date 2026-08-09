-- VisionHub -- KAN-32: movilidad de personas entre Redes.
--
-- Hoy no existe ninguna accion de "Cambiar de Red": una Persona no pertenece
-- a una Red directamente (pertenece a una Casa de Paz, que pertenece a una
-- Red -- ver harness/03-estructura/design.md), asi que "mover a alguien de
-- Red" en realidad es reasignar su membresia principal (casa_de_paz_membresia)
-- a una Casa de Paz que ya este en la Red de destino. El historial nunca se
-- borra (mismo patron que fusion/multiplicacion): se cierra la fila vigente
-- con fecha_fin y se abre una fila nueva.
--
-- Decision de diseno sobre cargos de liderazgo (documentada tambien en el
-- comentario de KAN-32): un Lider/Sublider de Red, Encargado de Red, Lider/
-- Sublider/Anfitrion de CdP NO se "lleva" el cargo a la Red nueva -- el cargo
-- queda atado a la Red/CdP de origen, no a la persona. Si la persona que se
-- mueve tiene alguno de esos cargos vigentes en la Red de origen o en la CdP
-- que deja, el traslado los cierra (fecha_fin), pero exige confirmacion
-- explicita del administrador primero (p_confirmar_cierre_cargos) -- si no,
-- la RPC rechaza con MOVIMIENTO_CARGOS_VIGENTES para que el frontend pueda
-- avisar y pedir confirmacion (Requisito 5/6 del ticket). Cargos de Iglesia
-- (persona_cargo: Pastor, Supervisor de Vision, cargos ministeriales, etc.)
-- no son de este ambito y nunca se tocan -- no dependen de la Red.
--
-- Mismo gate de 58_solicitudes_estructura.sql: si el Supervisor (no el
-- Pastor, no el propio Lider de Red) mueve a alguien fuera de una Red que ya
-- tiene Lider de Red vigente, la accion no se aplica al instante -- genera
-- una solicitud pendiente que ese Lider de Red aprueba o rechaza. Se gatea
-- sobre la Red de ORIGEN (la que pierde a la persona), igual criterio que
-- fn_multiplicar_red (gatea sobre la Red que se divide).
--
-- Reportes historicos no cambian retroactivamente (Requisito 8): no se toca
-- ninguna fila pasada, solo se cierra la vigente y se abre una nueva. Los
-- permisos se recalculan solos (Requisito 9): las funciones de permiso leen
-- casa_de_paz_membresia/red_cargo/casa_de_paz_cargo en vivo, no hay cache.
-- Sin traslado entre Iglesias (Requisito 11): se rechaza si la CdP de
-- destino es de otra Iglesia -- no hay "proceso especifico" para eso todavia.

begin;

-- ============================================================
-- 1. Auditoria del traslado -- nunca se borra (trg_no_delete), append-only
-- igual que multiplicacion_red/multiplicacion_casa_de_paz.
-- ============================================================
create table if not exists movimiento_red_persona (
  id                      uuid primary key default gen_random_uuid(),
  iglesia_id              uuid not null references iglesia(id),
  persona_id              uuid not null references persona(id),
  red_origen_id           uuid not null references red(id),
  casa_de_paz_origen_id   uuid not null references casa_de_paz(id),
  red_destino_id          uuid not null references red(id),
  casa_de_paz_destino_id  uuid not null references casa_de_paz(id),
  motivo                  text not null,
  -- Cargos de Red/CdP de origen que se cerraron con este traslado (para
  -- que el registro de auditoria explique por si solo que se perdio, sin
  -- tener que reconstruirlo a partir de fechas de cierre de otras tablas).
  cargos_finalizados      jsonb not null default '[]'::jsonb,
  fecha_movimiento        timestamptz not null default now(),
  fecha_creacion       timestamptz not null default now(),
  fecha_actualizacion  timestamptz,
  creado_por           uuid references auth.users(id),
  actualizado_por      uuid references auth.users(id),
  fecha_eliminacion    timestamptz,
  eliminado_por        uuid references auth.users(id),
  constraint chk_movimiento_red_persona_distintas check (red_origen_id <> red_destino_id),
  constraint chk_movimiento_red_persona_motivo check (btrim(motivo) <> '')
);

create index if not exists idx_movimiento_red_persona_persona
  on movimiento_red_persona (persona_id, fecha_movimiento desc);
create index if not exists idx_movimiento_red_persona_iglesia
  on movimiento_red_persona (iglesia_id, fecha_movimiento desc);

drop trigger if exists trg_auditoria_movimiento_red_persona on movimiento_red_persona;
create trigger trg_auditoria_movimiento_red_persona
  before insert or update on movimiento_red_persona
  for each row execute function fn_auditoria();

drop trigger if exists trg_no_delete_movimiento_red_persona on movimiento_red_persona;
create trigger trg_no_delete_movimiento_red_persona
  before delete on movimiento_red_persona
  for each row execute function fn_bloquear_delete();

alter table movimiento_red_persona enable row level security;

drop policy if exists pol_movimiento_red_persona_select on movimiento_red_persona;
create policy pol_movimiento_red_persona_select on movimiento_red_persona
  for select to authenticated
  using (iglesia_id in (select fn_mis_iglesias()) and fecha_eliminacion is null);
-- Sin INSERT/UPDATE/DELETE directo: todo pasa por fn_mover_persona_red (SECURITY DEFINER).

-- ============================================================
-- 2. Extiende el catalogo de tipos de solicitud_estructura
-- (58_solicitudes_estructura.sql) con el nuevo tipo.
-- ============================================================
alter table solicitud_estructura drop constraint if exists chk_solicitud_estructura_tipo;
alter table solicitud_estructura add constraint chk_solicitud_estructura_tipo check (
  tipo in (
    'FUSIONAR_CDP', 'FUSIONAR_RED', 'MULTIPLICAR_CDP', 'MULTIPLICAR_RED',
    'CAMBIAR_LIDER_RED', 'CAMBIAR_LIDER_CDP', 'MOVER_PERSONA_RED'
  )
);

-- ============================================================
-- 3. La accion en si: "Cambiar de Red".
-- ============================================================
create or replace function fn_mover_persona_red(
  p_persona_id uuid,
  p_casa_de_paz_destino_id uuid,
  p_motivo text,
  p_confirmar_cierre_cargos boolean default false,
  p_pin text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_iglesia_id uuid;
  v_cdp_origen_id uuid;
  v_red_origen_id uuid;
  v_iglesia_destino uuid;
  v_red_destino_id uuid;
  v_cdp_destino_activa boolean;
  v_lider_vigente uuid;
  v_solicitud_id uuid;
  v_movimiento_id uuid;
  v_cargos_cerrados jsonb := '[]'::jsonb;
  v_tiene_cargos boolean;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'MOVIMIENTO_MOTIVO_OBLIGATORIO: hay que escribir el motivo del traslado' using errcode = 'P0001';
  end if;

  select p.iglesia_id into v_iglesia_id from persona p where p.id = p_persona_id and p.fecha_eliminacion is null;
  if v_iglesia_id is null then
    raise exception 'MOVIMIENTO_PERSONA_INEXISTENTE: la persona no existe' using errcode = 'P0001';
  end if;

  select cm.casa_de_paz_id into v_cdp_origen_id
  from casa_de_paz_membresia cm
  where cm.persona_id = p_persona_id and cm.es_principal
    and cm.fecha_fin is null and cm.fecha_eliminacion is null;
  if v_cdp_origen_id is null then
    raise exception 'MOVIMIENTO_SIN_CDP_ORIGEN: la persona no tiene una Casa de Paz principal vigente; no hay Red de origen para trasladar'
      using errcode = 'P0001';
  end if;

  select cr.red_id into v_red_origen_id
  from casa_de_paz_red cr
  where cr.casa_de_paz_id = v_cdp_origen_id and cr.fecha_fin is null and cr.fecha_eliminacion is null;
  if v_red_origen_id is null then
    raise exception 'MOVIMIENTO_RED_ORIGEN_NO_ENCONTRADA: la Casa de Paz actual de la persona no tiene Red vigente' using errcode = 'P0001';
  end if;

  select cdp.iglesia_id, cr.red_id, cdp.activo
  into v_iglesia_destino, v_red_destino_id, v_cdp_destino_activa
  from casa_de_paz cdp
  join casa_de_paz_red cr on cr.casa_de_paz_id = cdp.id and cr.fecha_fin is null and cr.fecha_eliminacion is null
  where cdp.id = p_casa_de_paz_destino_id and cdp.fecha_eliminacion is null;

  if v_red_destino_id is null then
    raise exception 'MOVIMIENTO_CDP_DESTINO_INVALIDA: la Casa de Paz de destino no existe o no tiene Red vigente' using errcode = 'P0001';
  end if;
  if not v_cdp_destino_activa then
    raise exception 'MOVIMIENTO_CDP_DESTINO_INACTIVA: la Casa de Paz de destino esta inactiva' using errcode = 'P0001';
  end if;
  if v_iglesia_destino is distinct from v_iglesia_id then
    raise exception 'MOVIMIENTO_ENTRE_IGLESIAS_NO_PERMITIDO: no hay traslado de persona entre Iglesias distintas sin un proceso especifico'
      using errcode = 'P0001';
  end if;
  if v_red_destino_id = v_red_origen_id then
    raise exception 'MOVIMIENTO_MISMA_RED: la persona ya pertenece a esa Red' using errcode = 'P0001';
  end if;

  if not (fn_es_operativo_en(v_iglesia_id) or fn_es_lider_de_red(v_red_origen_id)) then
    raise exception 'MOVIMIENTO_SIN_PERMISO: se requiere ser Lider de la Red de origen, o Pastor/Supervisor' using errcode = 'P0001';
  end if;

  -- Cargos vigentes que no se "llevan" a la Red nueva: los de la Red de
  -- origen (LIDER_RED/SUBLIDER_RED/encargados) y los de la CdP puntual que
  -- deja (LIDER_CDP/SUBLIDER_CDP/ANFITRION). Cargos de Iglesia (persona_cargo)
  -- quedan fuera a proposito -- no dependen de la Red.
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_cargos_cerrados from (
    select jsonb_build_object('ambito', 'RED', 'entidad', r.nombre, 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre) as x
    from red_cargo rc join cargo c on c.id = rc.cargo_id join red r on r.id = rc.red_id
    where rc.persona_id = p_persona_id and rc.red_id = v_red_origen_id
      and rc.fecha_fin is null and rc.fecha_eliminacion is null
    union all
    select jsonb_build_object('ambito', 'CDP', 'entidad', fn_etiqueta_cdp(cd.id), 'cargo_codigo', c.codigo, 'cargo_nombre', c.nombre)
    from casa_de_paz_cargo cc join cargo c on c.id = cc.cargo_id join casa_de_paz cd on cd.id = cc.casa_de_paz_id
    where cc.persona_id = p_persona_id and cc.casa_de_paz_id = v_cdp_origen_id
      and cc.fecha_fin is null and cc.fecha_eliminacion is null
  ) sub;

  v_tiene_cargos := jsonb_array_length(v_cargos_cerrados) > 0;
  if v_tiene_cargos and not p_confirmar_cierre_cargos then
    raise exception 'MOVIMIENTO_CARGOS_VIGENTES: la persona tiene % cargo(s) vigente(s) en la Red/Casa de Paz de origen que se cerraran con el traslado; confirme para continuar',
      jsonb_array_length(v_cargos_cerrados) using errcode = 'P0001';
  end if;

  -- Gate: Supervisor (no Pastor, no el propio Lider de la Red de origen)
  -- sobre una Red de origen con Lider vigente -> queda pendiente de su
  -- autorizacion (mismo criterio que fn_multiplicar_red, 58_solicitudes_estructura.sql).
  if fn_es_supervisor_en(v_iglesia_id) and not fn_es_lider_de_red(v_red_origen_id) then
    select rc.persona_id into v_lider_vigente
    from red_cargo rc join cargo c on c.id = rc.cargo_id
    where rc.red_id = v_red_origen_id and c.codigo = 'LIDER_RED' and rc.fecha_fin is null and rc.fecha_eliminacion is null
    limit 1;
    if v_lider_vigente is not null then
      insert into solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      values (v_iglesia_id, v_red_origen_id, 'MOVER_PERSONA_RED',
        jsonb_build_object('persona_id', p_persona_id, 'casa_de_paz_destino_id', p_casa_de_paz_destino_id,
          'motivo', p_motivo, 'confirmar_cierre_cargos', p_confirmar_cierre_cargos),
        fn_mi_persona_id())
      returning id into v_solicitud_id;
      perform fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de traslado a otra Red',
        'El Supervisor pidió trasladar a una persona de tu Red hacia otra Red. Requiere tu autorización.',
        'solicitud_estructura', v_solicitud_id);
      return null;
    end if;
  end if;

  perform fn_exigir_pin(p_pin);

  -- 1. Cierra la membresia principal vigente en la CdP de origen (nunca se
  -- borra -- Requisito 7 del ticket, mismo patron que fusion/multiplicacion).
  update casa_de_paz_membresia
  set fecha_fin = current_date
  where persona_id = p_persona_id and casa_de_paz_id = v_cdp_origen_id
    and es_principal and fecha_fin is null and fecha_eliminacion is null;

  -- 2. Abre la membresia principal nueva en la CdP de destino.
  insert into casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  values (v_iglesia_id, p_casa_de_paz_destino_id, p_persona_id, true, current_date);

  -- 3. Cierra los cargos de Red/CdP de origen (solo si el administrador ya
  -- confirmo que se iban a perder).
  if v_tiene_cargos then
    update red_cargo set fecha_fin = current_date
    where persona_id = p_persona_id and red_id = v_red_origen_id and fecha_fin is null and fecha_eliminacion is null;

    update casa_de_paz_cargo set fecha_fin = current_date
    where persona_id = p_persona_id and casa_de_paz_id = v_cdp_origen_id and fecha_fin is null and fecha_eliminacion is null;
  end if;

  -- 4. Auditoria del traslado (Requisito 10) -- append-only, trg_no_delete.
  insert into movimiento_red_persona (
    iglesia_id, persona_id, red_origen_id, casa_de_paz_origen_id,
    red_destino_id, casa_de_paz_destino_id, motivo, cargos_finalizados
  ) values (
    v_iglesia_id, p_persona_id, v_red_origen_id, v_cdp_origen_id,
    v_red_destino_id, p_casa_de_paz_destino_id, p_motivo, v_cargos_cerrados
  ) returning id into v_movimiento_id;

  return v_movimiento_id;
end;
$$;

grant execute on function fn_mover_persona_red(uuid, uuid, text, boolean, text) to authenticated;

-- ============================================================
-- 4. Historial de traslados de una Iglesia, para auditoria (Requisito 10).
-- Sin UI dedicada todavia -- queda lista para cuando se necesite un panel de
-- "Movimientos entre Redes" (documentado en el comentario de KAN-32).
-- ============================================================
create or replace function fn_listar_movimientos_red_persona(p_iglesia_id uuid)
returns table (
  id uuid, fecha_movimiento timestamptz, motivo text,
  persona_id uuid, persona_nombre text,
  red_origen_id uuid, red_origen_nombre varchar,
  red_destino_id uuid, red_destino_nombre varchar,
  cargos_finalizados jsonb
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not fn_es_operativo_en(p_iglesia_id) then
    raise exception 'MOVIMIENTOS_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia' using errcode = 'P0001';
  end if;

  return query
  select m.id, m.fecha_movimiento, m.motivo,
    m.persona_id, fn_nombre_completo(p),
    m.red_origen_id, ro.nombre, m.red_destino_id, rd.nombre,
    m.cargos_finalizados
  from movimiento_red_persona m
  join persona p on p.id = m.persona_id
  join red ro on ro.id = m.red_origen_id
  join red rd on rd.id = m.red_destino_id
  where m.iglesia_id = p_iglesia_id and m.fecha_eliminacion is null
  order by m.fecha_movimiento desc;
end;
$$;

grant execute on function fn_listar_movimientos_red_persona(uuid) to authenticated;

-- ============================================================
-- 5. fn_aprobar_solicitud_estructura: se re-declara completa (CREATE OR
-- REPLACE) agregando la rama MOVER_PERSONA_RED al CASE. El resto es
-- identico a 58_solicitudes_estructura.sql.
-- ============================================================
create or replace function fn_aprobar_solicitud_estructura(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_sol solicitud_estructura%rowtype;
  v_resultado uuid;
begin
  select * into v_sol from solicitud_estructura where id = p_id;
  if not found then
    raise exception 'SOLICITUD_NO_ENCONTRADA: no existe esa solicitud' using errcode = 'P0001';
  end if;
  if v_sol.estado <> 'PENDIENTE' then
    raise exception 'SOLICITUD_YA_RESUELTA: esta solicitud ya fue resuelta' using errcode = 'P0001';
  end if;
  if not (fn_es_lider_de_red(v_sol.red_id) or fn_es_operativo_en(v_sol.iglesia_id)) then
    raise exception 'SOLICITUD_SIN_PERMISO: se requiere ser el Lider de esa Red, o Pastor/Supervisor' using errcode = 'P0001';
  end if;

  case v_sol.tipo
    when 'FUSIONAR_CDP' then
      select fn_fusionar_cdp(
        (v_sol.payload->>'origen_id')::uuid, (v_sol.payload->>'destino_id')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'FUSIONAR_RED' then
      select fn_fusionar_red(
        (v_sol.payload->>'origen_id')::uuid, (v_sol.payload->>'destino_id')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'MULTIPLICAR_CDP' then
      select fn_multiplicar_cdp(
        (v_sol.payload->>'origen_id')::uuid, v_sol.payload->>'nombre_nueva',
        (select array_agg(x::uuid) from jsonb_array_elements_text(v_sol.payload->'persona_ids') x),
        nullif(v_sol.payload->>'lider_nuevo_id', '')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'MULTIPLICAR_RED' then
      select fn_multiplicar_red(
        (v_sol.payload->>'origen_id')::uuid, v_sol.payload->>'nombre_nueva',
        (select array_agg(x::uuid) from jsonb_array_elements_text(v_sol.payload->'cdp_ids') x),
        nullif(v_sol.payload->>'lider_nuevo_id', '')::uuid, v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'CAMBIAR_LIDER_RED' then
      select fn_asignar_cargo_red(
        (v_sol.payload->>'red_id')::uuid, (v_sol.payload->>'persona_id')::uuid,
        v_sol.payload->>'codigo', (v_sol.payload->>'cargo_id')::uuid
      ) into v_resultado;
    when 'CAMBIAR_LIDER_CDP' then
      select fn_asignar_cargo_cdp(
        (v_sol.payload->>'cdp_id')::uuid, (v_sol.payload->>'persona_id')::uuid,
        v_sol.payload->>'codigo', (v_sol.payload->>'cargo_id')::uuid
      ) into v_resultado;
    when 'MOVER_PERSONA_RED' then
      select fn_mover_persona_red(
        (v_sol.payload->>'persona_id')::uuid, (v_sol.payload->>'casa_de_paz_destino_id')::uuid,
        v_sol.payload->>'motivo', coalesce((v_sol.payload->>'confirmar_cierre_cargos')::boolean, false)
      ) into v_resultado;
    else
      raise exception 'SOLICITUD_TIPO_DESCONOCIDO: tipo % no soportado', v_sol.tipo using errcode = 'P0001';
  end case;

  update solicitud_estructura
  set estado = 'APROBADA', fecha_resolucion = now(), resuelta_por_persona_id = fn_mi_persona_id()
  where id = p_id;

  perform fn_crear_notificacion(v_sol.solicitante_persona_id, 'SOLICITUD_RESUELTA',
    'Tu solicitud fue aprobada', 'El Líder de Red autorizó la acción que solicitaste.', 'solicitud_estructura', p_id);

  return v_resultado;
end;
$$;

commit;
