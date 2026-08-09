-- VisionHub — KAN-135: aprobación de acciones de Red sin elevar al aprobador.
-- La autorización vive solo durante la transacción y exige solicitud, Red,
-- payload y usuario aprobador coincidentes.

begin;

create or replace function private.fn_solicitud_payload_valido(
  p_tipo text,
  p_iglesia_id uuid,
  p_red_id uuid,
  p_payload jsonb
)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_origen_id uuid;
  v_destino_id uuid;
  v_persona_id uuid;
  v_cdp_id uuid;
  v_cargo_id uuid;
begin
  if p_tipo = 'FUSIONAR_CDP' then
    v_origen_id := (p_payload->>'origen_id')::uuid;
    v_destino_id := (p_payload->>'destino_id')::uuid;
    return v_origen_id is distinct from v_destino_id
      and exists (
        select 1
        from public.casa_de_paz origen
        join public.casa_de_paz destino on destino.id = v_destino_id
        join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = destino.id
        where origen.id = v_origen_id
          and origen.iglesia_id = p_iglesia_id
          and destino.iglesia_id = p_iglesia_id
          and origen.fecha_eliminacion is null
          and destino.fecha_eliminacion is null
          and cdr.red_id = p_red_id
          and cdr.fecha_fin is null
          and cdr.fecha_eliminacion is null
      );
  elsif p_tipo = 'FUSIONAR_RED' then
    v_origen_id := (p_payload->>'origen_id')::uuid;
    v_destino_id := (p_payload->>'destino_id')::uuid;
    return v_destino_id = p_red_id
      and v_origen_id is distinct from v_destino_id
      and exists (
        select 1
        from public.red origen
        join public.red destino on destino.id = v_destino_id
        where origen.id = v_origen_id
          and origen.iglesia_id = p_iglesia_id
          and destino.iglesia_id = p_iglesia_id
          and origen.fecha_eliminacion is null
          and destino.fecha_eliminacion is null
      );
  elsif p_tipo = 'MULTIPLICAR_CDP' then
    v_origen_id := (p_payload->>'origen_id')::uuid;
    return exists (
      select 1
      from public.casa_de_paz cdp
      join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
      where cdp.id = v_origen_id
        and cdp.iglesia_id = p_iglesia_id
        and cdp.fecha_eliminacion is null
        and cdr.red_id = p_red_id
        and cdr.fecha_fin is null
        and cdr.fecha_eliminacion is null
    );
  elsif p_tipo = 'MULTIPLICAR_RED' then
    v_origen_id := (p_payload->>'origen_id')::uuid;
    return v_origen_id = p_red_id
      and jsonb_typeof(p_payload->'cdp_ids') = 'array'
      and jsonb_array_length(p_payload->'cdp_ids') > 0
      and exists (
        select 1 from public.red r
        where r.id = p_red_id
          and r.iglesia_id = p_iglesia_id
          and r.fecha_eliminacion is null
      )
      and not exists (
        select 1
        from jsonb_array_elements_text(p_payload->'cdp_ids') item(valor)
        where not exists (
          select 1
          from public.casa_de_paz cdp
          join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
          where cdp.id = item.valor::uuid
            and cdp.iglesia_id = p_iglesia_id
            and cdp.fecha_eliminacion is null
            and cdr.red_id = p_red_id
            and cdr.fecha_fin is null
            and cdr.fecha_eliminacion is null
        )
      );
  elsif p_tipo = 'CAMBIAR_LIDER_RED' then
    v_destino_id := (p_payload->>'red_id')::uuid;
    v_persona_id := (p_payload->>'persona_id')::uuid;
    v_cargo_id := (p_payload->>'cargo_id')::uuid;
    return v_destino_id = p_red_id
      and p_payload->>'codigo' = 'LIDER_RED'
      and exists (
        select 1
        from public.red r
        join public.persona p on p.id = v_persona_id
        join public.cargo c on c.id = v_cargo_id
        where r.id = p_red_id
          and r.iglesia_id = p_iglesia_id
          and p.iglesia_id = p_iglesia_id
          and c.codigo = 'LIDER_RED'
          and r.fecha_eliminacion is null
          and p.fecha_eliminacion is null
          and c.fecha_eliminacion is null
      );
  elsif p_tipo = 'CAMBIAR_LIDER_CDP' then
    v_cdp_id := (p_payload->>'cdp_id')::uuid;
    v_persona_id := (p_payload->>'persona_id')::uuid;
    v_cargo_id := (p_payload->>'cargo_id')::uuid;
    return p_payload->>'codigo' = 'LIDER_CDP'
      and exists (
        select 1
        from public.casa_de_paz cdp
        join public.casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
        join public.persona p on p.id = v_persona_id
        join public.cargo c on c.id = v_cargo_id
        where cdp.id = v_cdp_id
          and cdp.iglesia_id = p_iglesia_id
          and cdr.red_id = p_red_id
          and p.iglesia_id = p_iglesia_id
          and c.codigo = 'LIDER_CDP'
          and cdp.fecha_eliminacion is null
          and cdr.fecha_fin is null
          and cdr.fecha_eliminacion is null
          and p.fecha_eliminacion is null
          and c.fecha_eliminacion is null
      );
  elsif p_tipo = 'MOVER_PERSONA_RED' then
    v_persona_id := (p_payload->>'persona_id')::uuid;
    v_destino_id := (p_payload->>'casa_de_paz_destino_id')::uuid;
    return exists (
      select 1
      from public.persona p
      join public.casa_de_paz_membresia m
        on m.persona_id = p.id and m.es_principal
      join public.casa_de_paz_red origen
        on origen.casa_de_paz_id = m.casa_de_paz_id
      join public.casa_de_paz destino on destino.id = v_destino_id
      where p.id = v_persona_id
        and p.iglesia_id = p_iglesia_id
        and destino.iglesia_id = p_iglesia_id
        and origen.red_id = p_red_id
        and p.fecha_eliminacion is null
        and m.fecha_fin is null
        and m.fecha_eliminacion is null
        and origen.fecha_fin is null
        and origen.fecha_eliminacion is null
        and destino.fecha_eliminacion is null
    );
  end if;

  return false;
exception when others then
  return false;
end;
$$;

revoke all on function private.fn_solicitud_payload_valido(text, uuid, uuid, jsonb)
  from public, anon, authenticated;

create or replace function private.fn_solicitud_aprobada_actual_valida(
  p_tipo text,
  p_red_id uuid,
  p_payload jsonb
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.solicitud_estructura s
    where s.id::text = current_setting('visionhub.solicitud_aprobada_id', true)
      and s.estado = 'PENDIENTE'
      and s.tipo = p_tipo
      and s.red_id = p_red_id
      and s.payload = p_payload
      and s.fecha_eliminacion is null
      and (
        public.fn_es_lider_de_red(s.red_id)
        or public.fn_es_operativo_en(s.iglesia_id)
      )
  );
$$;

revoke all on function private.fn_solicitud_aprobada_actual_valida(text, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.fn_fusionar_red(
  p_origen_id uuid,
  p_destino_id uuid,
  p_motivo text,
  p_pin text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_iglesia_origen uuid;
  v_fusion_id uuid;
  v_lider_vigente uuid;
  v_solicitud_id uuid;
  v_payload jsonb;
  v_aprobacion_valida boolean;
begin
  if p_origen_id = p_destino_id then
    raise exception 'FUSION_MISMA_RED: no se puede fusionar una red consigo misma' using errcode = 'P0001';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' using errcode = 'P0001';
  end if;

  select iglesia_id into v_iglesia_id
  from public.red where id = p_destino_id and fecha_eliminacion is null;
  select iglesia_id into v_iglesia_origen
  from public.red where id = p_origen_id and fecha_eliminacion is null;

  if v_iglesia_id is null or v_iglesia_origen is null then
    raise exception 'FUSION_RED_INEXISTENTE: alguna de las redes no existe' using errcode = 'P0001';
  end if;
  if v_iglesia_id is distinct from v_iglesia_origen then
    raise exception 'FUSION_IGLESIAS_DISTINTAS: las dos redes deben ser de la misma iglesia' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object(
    'origen_id', p_origen_id,
    'destino_id', p_destino_id,
    'motivo', p_motivo
  );
  v_aprobacion_valida := private.fn_solicitud_aprobada_actual_valida(
    'FUSIONAR_RED', p_destino_id, v_payload
  );

  if not public.fn_es_operativo_en(v_iglesia_id) and not v_aprobacion_valida then
    raise exception 'FUSION_SIN_PERMISO: solo el Supervisor o el Lider que aprueba la solicitud pueden fusionar redes'
      using errcode = 'P0001';
  end if;

  if not v_aprobacion_valida and public.fn_es_supervisor_en(v_iglesia_id) then
    select rc.persona_id into v_lider_vigente
    from public.red_cargo rc
    join public.cargo c on c.id = rc.cargo_id
    where rc.red_id = p_destino_id
      and c.codigo = 'LIDER_RED'
      and rc.fecha_fin is null
      and rc.fecha_eliminacion is null
    limit 1;

    if v_lider_vigente is not null then
      insert into public.solicitud_estructura (
        iglesia_id, red_id, tipo, payload, solicitante_persona_id
      ) values (
        v_iglesia_id, p_destino_id, 'FUSIONAR_RED', v_payload,
        public.fn_mi_persona_id()
      ) returning id into v_solicitud_id;

      perform public.fn_crear_notificacion(
        v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de fusión de Redes',
        'El Supervisor pidió fusionar otra Red dentro de la tuya. Requiere tu autorización.',
        'solicitud_estructura', v_solicitud_id
      );
      return null;
    end if;
  end if;

  perform public.fn_exigir_pin(p_pin);

  insert into public.fusion_red (
    iglesia_id, red_origen_id, red_destino_id, motivo
  ) values (
    v_iglesia_id, p_origen_id, p_destino_id, p_motivo
  ) returning id into v_fusion_id;

  update public.casa_de_paz_red
  set fecha_fin = current_date
  where red_id = p_origen_id
    and fecha_fin is null
    and fecha_eliminacion is null;

  insert into public.casa_de_paz_red (
    iglesia_id, casa_de_paz_id, red_id, fecha_inicio
  )
  select v_iglesia_id, cdr.casa_de_paz_id, p_destino_id, current_date
  from public.casa_de_paz_red cdr
  where cdr.red_id = p_origen_id
    and cdr.fecha_fin = current_date
    and cdr.fecha_eliminacion is null;

  update public.red_cargo
  set fecha_fin = current_date
  where red_id = p_origen_id
    and fecha_fin is null
    and fecha_eliminacion is null;

  update public.red set activo = false where id = p_origen_id;
  return v_fusion_id;
end;
$$;

revoke all on function public.fn_fusionar_red(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fn_fusionar_red(uuid, uuid, text, text)
  to authenticated;

create or replace function public.fn_multiplicar_red(
  p_origen_id uuid,
  p_nombre_nueva character varying,
  p_cdp_ids uuid[],
  p_lider_nuevo_id uuid,
  p_motivo text,
  p_pin text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_iglesia_id uuid;
  v_nueva_id uuid;
  v_cantidad smallint;
  v_cargo_lider_id uuid;
  v_lider_vigente uuid;
  v_solicitud_id uuid;
  v_payload jsonb;
  v_aprobacion_valida boolean;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'MULTIPLICACION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la multiplicacion' using errcode = 'P0001';
  end if;
  if p_nombre_nueva is null or btrim(p_nombre_nueva) = '' then
    raise exception 'MULTIPLICACION_NOMBRE_OBLIGATORIO: la red nueva necesita un nombre' using errcode = 'P0001';
  end if;
  if p_cdp_ids is null or array_length(p_cdp_ids, 1) is null then
    raise exception 'MULTIPLICACION_SIN_CDP: hay que elegir al menos una Casa de Paz que se va a la nueva Red' using errcode = 'P0001';
  end if;

  select iglesia_id into v_iglesia_id
  from public.red
  where id = p_origen_id and fecha_eliminacion is null and activo;
  if v_iglesia_id is null then
    raise exception 'MULTIPLICACION_RED_INEXISTENTE: la red de origen no existe o esta inactiva' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object(
    'origen_id', p_origen_id,
    'nombre_nueva', p_nombre_nueva,
    'cdp_ids', to_jsonb(p_cdp_ids),
    'lider_nuevo_id', p_lider_nuevo_id,
    'motivo', p_motivo
  );
  v_aprobacion_valida := private.fn_solicitud_aprobada_actual_valida(
    'MULTIPLICAR_RED', p_origen_id, v_payload
  );

  if not public.fn_es_operativo_en(v_iglesia_id) and not v_aprobacion_valida then
    raise exception 'MULTIPLICACION_SIN_PERMISO: solo el Supervisor o el Lider que aprueba la solicitud pueden multiplicar redes'
      using errcode = 'P0001';
  end if;

  if not v_aprobacion_valida and public.fn_es_supervisor_en(v_iglesia_id) then
    select rc.persona_id into v_lider_vigente
    from public.red_cargo rc
    join public.cargo c on c.id = rc.cargo_id
    where rc.red_id = p_origen_id
      and c.codigo = 'LIDER_RED'
      and rc.fecha_fin is null
      and rc.fecha_eliminacion is null
    limit 1;

    if v_lider_vigente is not null then
      insert into public.solicitud_estructura (
        iglesia_id, red_id, tipo, payload, solicitante_persona_id
      ) values (
        v_iglesia_id, p_origen_id, 'MULTIPLICAR_RED', v_payload,
        public.fn_mi_persona_id()
      ) returning id into v_solicitud_id;

      perform public.fn_crear_notificacion(
        v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de multiplicación de Red',
        'El Supervisor pidió multiplicar tu Red. Requiere tu autorización.',
        'solicitud_estructura', v_solicitud_id
      );
      return null;
    end if;
  end if;

  perform public.fn_exigir_pin(p_pin);

  insert into public.red (iglesia_id, nombre)
  values (v_iglesia_id, btrim(p_nombre_nueva))
  returning id into v_nueva_id;

  update public.casa_de_paz_red
  set fecha_fin = current_date
  where red_id = p_origen_id
    and casa_de_paz_id = any(p_cdp_ids)
    and fecha_fin is null
    and fecha_eliminacion is null;
  get diagnostics v_cantidad = row_count;

  if v_cantidad <> cardinality(p_cdp_ids) then
    raise exception 'MULTIPLICACION_CDP_INVALIDAS: todas las Casas de Paz deben pertenecer a la Red de origen'
      using errcode = 'P0001';
  end if;

  insert into public.casa_de_paz_red (
    iglesia_id, casa_de_paz_id, red_id, fecha_inicio
  )
  select v_iglesia_id, cdr.casa_de_paz_id, v_nueva_id, current_date
  from public.casa_de_paz_red cdr
  where cdr.red_id = p_origen_id
    and cdr.casa_de_paz_id = any(p_cdp_ids)
    and cdr.fecha_fin = current_date
    and cdr.fecha_eliminacion is null;

  if p_lider_nuevo_id is not null then
    if not exists (
      select 1 from public.persona p
      where p.id = p_lider_nuevo_id
        and p.iglesia_id = v_iglesia_id
        and p.fecha_eliminacion is null
    ) then
      raise exception 'MULTIPLICACION_LIDER_FUERA_DE_IGLESIA: el nuevo lider no pertenece a la iglesia'
        using errcode = 'P0001';
    end if;

    select id into v_cargo_lider_id
    from public.cargo
    where codigo = 'LIDER_RED' and activo and fecha_eliminacion is null
    limit 1;

    insert into public.red_cargo (
      iglesia_id, red_id, persona_id, cargo_id, fecha_inicio
    ) values (
      v_iglesia_id, v_nueva_id, p_lider_nuevo_id, v_cargo_lider_id, current_date
    );
  end if;

  insert into public.multiplicacion_red (
    iglesia_id, red_origen_id, red_nueva_id, cantidad_movidas, motivo
  ) values (
    v_iglesia_id, p_origen_id, v_nueva_id, v_cantidad, p_motivo
  );

  return v_nueva_id;
end;
$$;

revoke all on function public.fn_multiplicar_red(uuid, character varying, uuid[], uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fn_multiplicar_red(uuid, character varying, uuid[], uuid, text, text)
  to authenticated;

create or replace function public.fn_aprobar_solicitud_estructura(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_sol public.solicitud_estructura%rowtype;
  v_resultado uuid;
begin
  select * into v_sol
  from public.solicitud_estructura
  where id = p_id
  for update;

  if not found then
    raise exception 'SOLICITUD_NO_ENCONTRADA: no existe esa solicitud' using errcode = 'P0001';
  end if;
  if v_sol.estado <> 'PENDIENTE' then
    raise exception 'SOLICITUD_YA_RESUELTA: esta solicitud ya fue resuelta' using errcode = 'P0001';
  end if;
  if not (
    public.fn_es_lider_de_red(v_sol.red_id)
    or public.fn_es_operativo_en(v_sol.iglesia_id)
  ) then
    raise exception 'SOLICITUD_SIN_PERMISO: se requiere ser el Lider de esa Red o el Supervisor'
      using errcode = 'P0001';
  end if;
  if not private.fn_solicitud_payload_valido(
    v_sol.tipo, v_sol.iglesia_id, v_sol.red_id, v_sol.payload
  ) then
    raise exception 'SOLICITUD_PAYLOAD_INVALIDO: las entidades no coinciden con la solicitud autorizada'
      using errcode = 'P0001';
  end if;

  perform set_config('visionhub.solicitud_aprobada_id', p_id::text, true);

  case v_sol.tipo
    when 'FUSIONAR_CDP' then
      select public.fn_fusionar_cdp(
        (v_sol.payload->>'origen_id')::uuid,
        (v_sol.payload->>'destino_id')::uuid,
        v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'FUSIONAR_RED' then
      select public.fn_fusionar_red(
        (v_sol.payload->>'origen_id')::uuid,
        (v_sol.payload->>'destino_id')::uuid,
        v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'MULTIPLICAR_CDP' then
      select public.fn_multiplicar_cdp(
        (v_sol.payload->>'origen_id')::uuid,
        v_sol.payload->>'nombre_nueva',
        (
          select array_agg(item.valor::uuid order by item.orden)
          from jsonb_array_elements_text(v_sol.payload->'persona_ids')
               with ordinality item(valor, orden)
        ),
        nullif(v_sol.payload->>'lider_nuevo_id', '')::uuid,
        v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'MULTIPLICAR_RED' then
      select public.fn_multiplicar_red(
        (v_sol.payload->>'origen_id')::uuid,
        v_sol.payload->>'nombre_nueva',
        (
          select array_agg(item.valor::uuid order by item.orden)
          from jsonb_array_elements_text(v_sol.payload->'cdp_ids')
               with ordinality item(valor, orden)
        ),
        nullif(v_sol.payload->>'lider_nuevo_id', '')::uuid,
        v_sol.payload->>'motivo'
      ) into v_resultado;
    when 'CAMBIAR_LIDER_RED' then
      select public.fn_asignar_cargo_red(
        (v_sol.payload->>'red_id')::uuid,
        (v_sol.payload->>'persona_id')::uuid,
        v_sol.payload->>'codigo',
        (v_sol.payload->>'cargo_id')::uuid
      ) into v_resultado;
    when 'CAMBIAR_LIDER_CDP' then
      select public.fn_asignar_cargo_cdp(
        (v_sol.payload->>'cdp_id')::uuid,
        (v_sol.payload->>'persona_id')::uuid,
        v_sol.payload->>'codigo',
        (v_sol.payload->>'cargo_id')::uuid
      ) into v_resultado;
    when 'MOVER_PERSONA_RED' then
      select public.fn_mover_persona_red(
        (v_sol.payload->>'persona_id')::uuid,
        (v_sol.payload->>'casa_de_paz_destino_id')::uuid,
        v_sol.payload->>'motivo',
        coalesce((v_sol.payload->>'confirmar_cierre_cargos')::boolean, false)
      ) into v_resultado;
    else
      raise exception 'SOLICITUD_TIPO_DESCONOCIDO: tipo % no soportado', v_sol.tipo
        using errcode = 'P0001';
  end case;

  update public.solicitud_estructura
  set estado = 'APROBADA',
      fecha_resolucion = now(),
      resuelta_por_persona_id = public.fn_mi_persona_id()
  where id = p_id and estado = 'PENDIENTE';

  perform public.fn_crear_notificacion(
    v_sol.solicitante_persona_id,
    'SOLICITUD_RESUELTA',
    'Tu solicitud fue aprobada',
    'El Líder de Red autorizó la acción que solicitaste.',
    'solicitud_estructura',
    p_id
  );

  return v_resultado;
end;
$$;

revoke all on function public.fn_aprobar_solicitud_estructura(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_aprobar_solicitud_estructura(uuid)
  to authenticated;

commit;
