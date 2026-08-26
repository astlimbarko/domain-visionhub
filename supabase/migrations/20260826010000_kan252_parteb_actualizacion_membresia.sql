-- VisionHub -- KAN-252 Parte B: personas que YA tenían la membresía
-- completada antes de que existieran Teléfono/Ministerio no deben volver a
-- llenar toda la ficha -- se les pide, en un modal aparte y liviano, SOLO
-- el dato que les falte.
--
-- Para no reabrir el modal para siempre a alguien que legítimamente no
-- tiene teléfono o no está en ningún ministerio, se agregan 2 flags que
-- distinguen "todavía no se le preguntó" de "ya contestó (aunque la
-- respuesta haya sido 'no tengo' / 'ninguno')" -- mismo criterio ya usado
-- para discipulados_ninguno/seminario_universidad_ninguna (KAN-257).
ALTER TABLE persona
  ADD COLUMN IF NOT EXISTS telefono_declarado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ministerio_declarado BOOLEAN NOT NULL DEFAULT false;

-- fn_guardar_telefono_membresia: además de guardar el teléfono si vino uno,
-- marca telefono_declarado=true SIEMPRE que se llama -- se llama una vez
-- por cada membresía nueva completada (los 2 flujos), así que de acá en
-- adelante toda membresía nueva ya queda "declarada" sin importar si dejó
-- el campo vacío (no era obligatorio en esa iglesia) o marcó "No tiene
-- teléfono". Esto es lo que evita que Parte B vuelva a preguntarles a
-- quienes ya pasaron por el wizard actualizado.
CREATE OR REPLACE FUNCTION fn_guardar_telefono_membresia(p_persona_id UUID, p_iglesia_id UUID, p_numero TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  UPDATE persona SET telefono_declarado = true WHERE id = p_persona_id;

  IF p_numero IS NULL OR btrim(p_numero) = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_tipo_telefono_id
  FROM tipo_telefono
  WHERE codigo = 'WHATSAPP' AND fecha_eliminacion IS NULL;

  INSERT INTO telefono (iglesia_id, tipo_telefono_id, numero)
  VALUES (p_iglesia_id, v_tipo_telefono_id, btrim(p_numero))
  RETURNING id INTO v_telefono_id;

  INSERT INTO telefono_asignacion (iglesia_id, telefono_id, persona_id, es_principal)
  VALUES (p_iglesia_id, v_telefono_id, p_persona_id, true);
END;
$$;

-- fn_guardar_membresia_extendida: mismo criterio para ministerio_declarado
-- -- se marca true al final, incondicionalmente, cada vez que se llama
-- (una vez por cada membresía nueva completada).
CREATE OR REPLACE FUNCTION public.fn_guardar_membresia_extendida(p_persona_id uuid, p_iglesia_id uuid, p_datos jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_item jsonb;
  v_tipo_relacion_id uuid;
begin
  if p_datos is null then
    return;
  end if;

  if p_datos ? 'bautizado' then
    update public.persona_detalle set
      bautizado = nullif(p_datos->>'bautizado', '')::boolean,
      bautizado_en_nuestra_iglesia = nullif(p_datos->>'bautizado_en_nuestra_iglesia', '')::boolean,
      bautismo_anio = nullif(p_datos->>'bautismo_anio', '')::smallint,
      bautismo_mes = nullif(p_datos->>'bautismo_mes', '')::smallint,
      bautismo_dia = nullif(p_datos->>'bautismo_dia', '')::smallint,
      bautismo_precision_fecha = nullif(p_datos->>'bautismo_precision_fecha', '')::public.precision_fecha_enum
    where persona_id = p_persona_id;
  end if;

  if p_datos ? 'discipulados' and jsonb_typeof(p_datos->'discipulados') = 'array' then
    for v_item in select value from jsonb_array_elements(p_datos->'discipulados')
    loop
      if v_item ->> 'tipo_discipulado_id' is not null then
        insert into public.persona_discipulado
          (iglesia_id, persona_id, tipo_discipulado_id, anio, mes, dia, precision_fecha)
        values (
          p_iglesia_id, p_persona_id, (v_item->>'tipo_discipulado_id')::uuid,
          nullif(v_item->>'anio', '')::smallint,
          nullif(v_item->>'mes', '')::smallint,
          nullif(v_item->>'dia', '')::smallint,
          nullif(v_item->>'precision_fecha', '')::public.precision_fecha_enum
        );
      end if;
    end loop;
  end if;

  if coalesce((p_datos->>'seminario')::boolean, false) then
    insert into public.persona_seminario (iglesia_id, persona_id, anio, mes, dia, precision_fecha)
    values (
      p_iglesia_id, p_persona_id,
      nullif(p_datos->>'seminario_anio', '')::smallint,
      nullif(p_datos->>'seminario_mes', '')::smallint,
      nullif(p_datos->>'seminario_dia', '')::smallint,
      nullif(p_datos->>'seminario_precision_fecha', '')::public.precision_fecha_enum
    )
    on conflict (persona_id) where fecha_eliminacion is null do nothing;
  end if;

  if coalesce((p_datos->>'universidad')::boolean, false) then
    insert into public.persona_universidad_rey_jesus (iglesia_id, persona_id, anio, mes, dia, precision_fecha)
    values (
      p_iglesia_id, p_persona_id,
      nullif(p_datos->>'universidad_anio', '')::smallint,
      nullif(p_datos->>'universidad_mes', '')::smallint,
      nullif(p_datos->>'universidad_dia', '')::smallint,
      nullif(p_datos->>'universidad_precision_fecha', '')::public.precision_fecha_enum
    )
    on conflict (persona_id) where fecha_eliminacion is null do nothing;
  end if;

  if coalesce((p_datos->>'mentor')::boolean, false)
     and p_datos->>'mentor_nombre_txt' is not null
     and btrim(p_datos->>'mentor_nombre_txt') <> '' then
    insert into public.persona_mentor (iglesia_id, persona_id, mentor_nombre_txt, mentor_es_miembro)
    values (
      p_iglesia_id, p_persona_id, btrim(p_datos->>'mentor_nombre_txt'),
      coalesce((p_datos->>'mentor_es_miembro')::boolean, false)
    )
    on conflict (persona_id) where fecha_eliminacion is null do nothing;
  end if;

  if p_datos ? 'ministerios' and jsonb_typeof(p_datos->'ministerios') = 'array' then
    for v_item in select value from jsonb_array_elements(p_datos->'ministerios')
    loop
      if jsonb_typeof(v_item) = 'string' and (v_item #>> '{}') is not null then
        insert into public.ministerio_persona (iglesia_id, ministerio_id, persona_id, fecha_inicio)
        values (p_iglesia_id, (v_item #>> '{}')::uuid, p_persona_id, current_date);
      end if;
    end loop;
  end if;

  if p_datos ? 'familiares' and jsonb_typeof(p_datos->'familiares') = 'array' then
    for v_item in select value from jsonb_array_elements(p_datos->'familiares')
    loop
      if v_item ->> 'nombre_familiar' is not null and btrim(v_item->>'nombre_familiar') <> '' then
        select id into v_tipo_relacion_id from public.tipo_relacion
        where codigo = upper(v_item->>'tipo_relacion_codigo') and fecha_eliminacion is null;

        if v_tipo_relacion_id is not null then
          insert into public.referencia_familiar
            (iglesia_id, persona_id, nombre_familiar, tipo_relacion_id, es_miembro_iglesia)
          values (
            p_iglesia_id, p_persona_id, btrim(v_item->>'nombre_familiar'), v_tipo_relacion_id,
            coalesce((v_item->>'es_miembro')::boolean, false)
          );
        end if;
      end if;
    end loop;
  end if;

  if p_datos ?| array['efesio_tipo', 'cargo_ministro', 'cargo_anciano', 'cargo_diacono',
                       'cargo_mentor', 'cargo_sub_mentor', 'cargo_lider_cdp', 'cargo_sublider_cdp',
                       'cargo_lider_ministerio', 'rango_miembro'] then
    insert into public.persona_censo_membresia
      (iglesia_id, persona_id, efesio_tipo, cargo_ministro, cargo_anciano, cargo_diacono,
       cargo_mentor, cargo_sub_mentor, cargo_lider_cdp, cargo_sublider_cdp, cargo_lider_ministerio, rango_miembro)
    values (
      p_iglesia_id, p_persona_id, nullif(p_datos->>'efesio_tipo', ''),
      coalesce((p_datos->>'cargo_ministro')::boolean, false),
      coalesce((p_datos->>'cargo_anciano')::boolean, false),
      coalesce((p_datos->>'cargo_diacono')::boolean, false),
      coalesce((p_datos->>'cargo_mentor')::boolean, false),
      coalesce((p_datos->>'cargo_sub_mentor')::boolean, false),
      coalesce((p_datos->>'cargo_lider_cdp')::boolean, false),
      coalesce((p_datos->>'cargo_sublider_cdp')::boolean, false),
      coalesce((p_datos->>'cargo_lider_ministerio')::boolean, false),
      nullif(p_datos->>'rango_miembro', '')
    )
    on conflict (persona_id) do update set
      efesio_tipo = excluded.efesio_tipo,
      cargo_ministro = excluded.cargo_ministro,
      cargo_anciano = excluded.cargo_anciano,
      cargo_diacono = excluded.cargo_diacono,
      cargo_mentor = excluded.cargo_mentor,
      cargo_sub_mentor = excluded.cargo_sub_mentor,
      cargo_lider_cdp = excluded.cargo_lider_cdp,
      cargo_sublider_cdp = excluded.cargo_sublider_cdp,
      cargo_lider_ministerio = excluded.cargo_lider_ministerio,
      rango_miembro = excluded.rango_miembro;
  end if;

  update public.persona set ministerio_declarado = true where id = p_persona_id;
end;
$function$;

-- fn_mi_actualizacion_membresia_pendiente: se consulta después de que el
-- gate de membresía incompleta (fn_mi_membresia_incompleta) ya dio null --
-- solo aplica a alguien con Persona completada. Devuelve null si no falta
-- nada, o qué falta (para que el modal pida solo eso).
CREATE OR REPLACE FUNCTION public.fn_mi_actualizacion_membresia_pendiente()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_persona persona;
BEGIN
  SELECT * INTO v_persona FROM persona
  WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
    AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> '';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_persona.telefono_declarado AND v_persona.ministerio_declarado THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'iglesia_id', v_persona.iglesia_id,
    'falta_telefono', NOT v_persona.telefono_declarado,
    'falta_ministerio', NOT v_persona.ministerio_declarado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_mi_actualizacion_membresia_pendiente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mi_actualizacion_membresia_pendiente() TO authenticated;

-- fn_guardar_actualizacion_telefono / fn_guardar_actualizacion_ministerios:
-- se llaman independientemente, una por cada dato que el modal de Parte B
-- efectivamente pidió (nunca las 2 si a la persona ya no le faltaba una).
CREATE OR REPLACE FUNCTION public.fn_guardar_actualizacion_telefono(p_numero TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_persona_id UUID;
  v_iglesia_id UUID;
BEGIN
  SELECT id, iglesia_id INTO v_persona_id, v_iglesia_id FROM persona
  WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'ACTUALIZACION_SIN_PERSONA: no hay una membresía completada para esta cuenta' USING ERRCODE = 'P0001';
  END IF;

  PERFORM fn_guardar_telefono_membresia(v_persona_id, v_iglesia_id, p_numero);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guardar_actualizacion_telefono(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_guardar_actualizacion_telefono(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_guardar_actualizacion_ministerios(p_ministerio_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_persona_id UUID;
  v_iglesia_id UUID;
  v_ministerio_id UUID;
BEGIN
  SELECT id, iglesia_id INTO v_persona_id, v_iglesia_id FROM persona
  WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'ACTUALIZACION_SIN_PERSONA: no hay una membresía completada para esta cuenta' USING ERRCODE = 'P0001';
  END IF;

  IF p_ministerio_ids IS NOT NULL THEN
    FOREACH v_ministerio_id IN ARRAY p_ministerio_ids
    LOOP
      INSERT INTO ministerio_persona (iglesia_id, ministerio_id, persona_id, fecha_inicio)
      VALUES (v_iglesia_id, v_ministerio_id, v_persona_id, CURRENT_DATE);
    END LOOP;
  END IF;

  UPDATE persona SET ministerio_declarado = true WHERE id = v_persona_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guardar_actualizacion_ministerios(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_guardar_actualizacion_ministerios(UUID[]) TO authenticated;
