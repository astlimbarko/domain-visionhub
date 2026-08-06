-- VisionHub — Constructor de Estructura Organizacional: crear Casa de Paz.
-- Aditiva. No reutiliza crearCdp() del frontend (technical-design.md §11: esa
-- función hace varias llamadas sueltas, no es transaccional). Esta RPC crea
-- la Casa de Paz, su relación con la Red y —si se indica— su Líder en una
-- sola transacción. REQ-CDP-1/CDP-3: sin nombre propio, sin exigir
-- anfitrión/dirección/sublíderes al crear (se completan después, item 5).

begin;

create or replace function public.fn_estructura_crear_cdp(
  p_red_id uuid,
  p_lider_persona_id uuid default null,
  p_otp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_cdp_id uuid;
  v_cargo_lider_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select r.iglesia_id
  into v_iglesia_id
  from public.red r
  where r.id = p_red_id and r.fecha_eliminacion is null
  for update;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not private.fn_estructura_puede_administrar(v_iglesia_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  if p_lider_persona_id is not null and not exists (
    select 1
    from public.persona p
    where p.id = p_lider_persona_id
      and p.iglesia_id = v_iglesia_id
      and p.fecha_eliminacion is null
  ) then
    raise exception 'ESTRUCTURA_PERSONA_FUERA_DE_IGLESIA' using errcode = 'P0001';
  end if;

  insert into public.casa_de_paz (iglesia_id, nombre, creado_por, actualizado_por)
  values (v_iglesia_id, null, (select auth.uid()), (select auth.uid()))
  returning id into v_cdp_id;

  insert into public.casa_de_paz_red (
    iglesia_id, casa_de_paz_id, red_id, fecha_inicio, creado_por, actualizado_por
  ) values (
    v_iglesia_id, v_cdp_id, p_red_id, current_date, (select auth.uid()), (select auth.uid())
  );

  if p_lider_persona_id is not null then
    select c.id
    into v_cargo_lider_id
    from public.cargo c
    where c.codigo = 'LIDER_CDP'
      and c.activo
      and c.fecha_eliminacion is null;

    if v_cargo_lider_id is null then
      raise exception 'ESTRUCTURA_CARGO_CDP_NO_DISPONIBLE' using errcode = 'P0001';
    end if;

    insert into public.casa_de_paz_cargo (
      iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio,
      creado_por, actualizado_por
    ) values (
      v_iglesia_id, v_cdp_id, p_lider_persona_id, v_cargo_lider_id, current_date,
      (select auth.uid()), (select auth.uid())
    );
  end if;

  return v_cdp_id;
end;
$$;

revoke all on function public.fn_estructura_crear_cdp(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fn_estructura_crear_cdp(uuid, uuid, text)
  to authenticated;

commit;
