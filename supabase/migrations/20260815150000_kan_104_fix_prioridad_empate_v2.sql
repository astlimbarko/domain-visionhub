-- VisionHub -- fix real encontrado probando en vivo (2026-08-15): todos los
-- anuncios nacen con prioridad=0 por defecto, asi que el primer intento de
-- fn_anuncio_mover_prioridad (intercambiar el campo `prioridad` con el
-- vecino) no producia ningun cambio visible entre 2 anuncios recien creados
-- -- ambos seguian en 0, y el desempate por fecha_creacion no se movia.
--
-- Se reemplaza por un recalculo completo: toma el orden actual de toda la
-- iglesia (mismo criterio que ya usan fn_mis_anuncios_gestion/fn_anuncios_
-- pendientes), mueve el anuncio pedido una posicion, y reasigna `prioridad`
-- de forma estrictamente decreciente segun la posicion final -- garantiza
-- que nunca vuelva a haber un empate entre dos anuncios consecutivos.
--
-- v2 (esta migracion): la primera version de este fix (20260815140000)
-- quedo con un segundo bug real -- "FOR UPDATE is not allowed with
-- aggregate functions", Postgres no permite combinar array_agg() con FOR
-- UPDATE en la misma consulta. Se saca el FOR UPDATE de esa consulta (el
-- lock de fila sobre p_anuncio_id de mas arriba alcanza para esta accion
-- manual, sin concurrencia real esperada).

begin;

create or replace function public.fn_anuncio_mover_prioridad(p_anuncio_id uuid, p_direccion text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_ids uuid[];
  v_idx int;
  v_tmp uuid;
  v_n int;
  v_prioridad smallint;
  v_i int;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if p_direccion not in ('SUBIR', 'BAJAR') then
    raise exception 'DIRECCION_INVALIDA' using errcode = 'P0001';
  end if;

  select iglesia_id into v_iglesia_id
  from public.anuncio
  where id = p_anuncio_id and fecha_eliminacion is null;

  if v_iglesia_id is null then
    raise exception 'ANUNCIO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not private.fn_anuncio_fila_administrable(p_anuncio_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  -- Postgres no permite FOR UPDATE junto a una funcion de agregado
  -- (array_agg) en la misma consulta -- el lock de fila ya lo tomamos
  -- arriba sobre p_anuncio_id, alcanza para esta operacion (reordenar es
  -- una accion manual, sin concurrencia real esperada sobre la misma
  -- iglesia al mismo tiempo).
  select array_agg(id order by prioridad desc, fecha_creacion desc)
  into v_ids
  from public.anuncio
  where iglesia_id = v_iglesia_id and fecha_eliminacion is null;

  v_n := coalesce(array_length(v_ids, 1), 0);

  select ordinalidad into v_idx
  from unnest(v_ids) with ordinality as t(id, ordinalidad)
  where t.id = p_anuncio_id;

  if p_direccion = 'SUBIR' and v_idx > 1 then
    v_tmp := v_ids[v_idx - 1];
    v_ids[v_idx - 1] := p_anuncio_id;
    v_ids[v_idx] := v_tmp;
  elsif p_direccion = 'BAJAR' and v_idx < v_n then
    v_tmp := v_ids[v_idx + 1];
    v_ids[v_idx + 1] := p_anuncio_id;
    v_ids[v_idx] := v_tmp;
  end if;

  v_prioridad := v_n::smallint;
  for v_i in 1..v_n loop
    update public.anuncio
    set prioridad = v_prioridad, actualizado_por = (select auth.uid())
    where id = v_ids[v_i];
    v_prioridad := v_prioridad - 1;
  end loop;
end;
$$;

commit;
