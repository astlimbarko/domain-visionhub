-- VisionHub -- KAN-387 (pedido explicito del owner): "con un clic, Pastor de
-- la iglesia madre o Super Admin marcan una satelite como Hija. Reversible
-- desde la UI." El enum iglesia_tipo_enum ya tiene 'HIJA' y 'SATELITE' desde
-- 61_iglesia_tipo.sql -- no hace falta ALTER TYPE, solo la funcion que mueve
-- el campo `tipo` de un lado a otro con el gate de permiso correcto.
--
-- A proposito NO resuelve cargos/roles compartidos entre la iglesia y su par
-- (ej. la misma persona como Supervisor en las dos a la vez) -- eso es una
-- pieza de diseno aparte, todavia sin especificar. El frontend avisa de esta
-- limitacion en el dialogo de confirmacion.

begin;

create or replace function public.fn_graduar_iglesia_hija(p_iglesia_id uuid, p_graduar boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_iglesia iglesia;
begin
  select * into v_iglesia from iglesia where id = p_iglesia_id and fecha_eliminacion is null;

  if v_iglesia.id is null then
    raise exception 'IGLESIA_NO_ENCONTRADA: no existe esa iglesia'
      using errcode = 'P0001';
  end if;

  if v_iglesia.iglesia_padre_id is null then
    raise exception 'IGLESIA_SIN_PADRE: esta iglesia no tiene iglesia madre -- no aplica graduar/revertir'
      using errcode = 'P0001';
  end if;

  -- Gate de permiso: Super Admin, o Pastor de la iglesia MADRE (no de esta
  -- misma) -- coincide con quien administra hoy la relacion padre/hija
  -- (fn_mis_iglesias_hijas exige lo mismo: fn_es_operativo_en de la madre).
  if not (fn_es_super_admin() or fn_es_pastor_en(v_iglesia.iglesia_padre_id)) then
    raise exception 'GRADUAR_SIN_PERMISO: se requiere ser Pastor de la iglesia madre o Super Admin'
      using errcode = 'P0001';
  end if;

  if p_graduar then
    if v_iglesia.tipo <> 'SATELITE' then
      raise exception 'GRADUAR_ESTADO_INVALIDO: solo se puede graduar una iglesia que hoy es Satelite'
        using errcode = 'P0001';
    end if;
    update iglesia set tipo = 'HIJA' where id = p_iglesia_id;
  else
    if v_iglesia.tipo <> 'HIJA' then
      raise exception 'REVERTIR_ESTADO_INVALIDO: solo se puede volver a Satelite una iglesia que hoy es Hija'
        using errcode = 'P0001';
    end if;
    -- iglesia_padre_id ya se confirmo NOT NULL arriba -- mientras siga
    -- seteado, revertir siempre es posible (nadie lo borra hoy tras graduar).
    update iglesia set tipo = 'SATELITE' where id = p_iglesia_id;
  end if;
  -- trg_auditoria_iglesia (03_tenancy.sql) ya cubre el registro de auditoria
  -- de este UPDATE -- no hace falta nada especial aca.
end;
$$;

grant execute on function public.fn_graduar_iglesia_hija(uuid, boolean) to authenticated;

commit;
