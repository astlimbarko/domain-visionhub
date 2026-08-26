-- VisionHub -- KAN-252 (fix urgente antes de cerrar la sesion): el frontend
-- de PRODUCCION desplegado en somoscdv.com (las 2 iglesias reales) todavia
-- no tiene el campo Telefono ni la opcion "Ninguno" de Ministerios -- sigue
-- llamando a fn_completar_membresia/fn_completar_membresia_general sin
-- mandar esas claves en el JSON. Como fn_guardar_telefono_membresia y
-- fn_guardar_membresia_extendida marcaban telefono_declarado/ministerio_
-- declarado = true INCONDICIONALMENTE cada vez que se llamaban, cualquier
-- persona real que complete su membresia HOY con el sitio viejo quedaria
-- marcada como "ya se le pregunto" sin haberselo preguntado nunca -- el
-- modal nuevo de Parte B jamas se lo volveria a pedir. Se corrige: las 2
-- funciones que ORQUESTAN la membresia ahora solo llaman a guardar
-- telefono/ministerios si esa clave realmente vino en el JSON (`?`
-- operador de existencia de clave, no de valor) -- el frontend viejo nunca
-- manda esas claves, asi que no toca los flags; el frontend nuevo las
-- manda siempre que la pagina correspondiente se muestra, aunque el valor
-- sea vacio/"Ninguno".

CREATE OR REPLACE FUNCTION fn_guardar_telefono_membresia(p_persona_id UUID, p_iglesia_id UUID, p_numero TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  -- Quien llama a esta funcion ya decidio que la pregunta se mostro (ver el
  -- guard `? 'telefono'` en fn_completar_membresia/fn_completar_membresia_
  -- general/fn_guardar_actualizacion_telefono) -- acá simplemente se marca
  -- declarado y se guarda el numero si vino uno real.
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

CREATE OR REPLACE FUNCTION fn_completar_membresia(p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
  v_persona_id UUID;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider
  WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBRESIA_SIN_INVITACION_PENDIENTE: no hay una invitacion pendiente para completar' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo, membresia_completada)
  VALUES (v_inv.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo', true)
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  IF p_datos ? 'telefono' THEN
    PERFORM fn_guardar_telefono_membresia(v_persona_id, v_inv.iglesia_id, p_datos->>'telefono');
  END IF;

  IF v_inv.rol = 'LIDER_RED' THEN
    UPDATE red_cargo SET fecha_fin = CURRENT_DATE
    WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', COALESCE((SELECT nombre FROM red WHERE id = v_inv.red_id), fn_etiqueta_cdp(v_inv.casa_de_paz_id))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_completar_membresia_general(p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID;
  v_borrador JSONB;
  v_datos_completos JSONB;
BEGIN
  v_iglesia_id := fn_mi_iglesia_membresia_general();
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEMBRESIA_GENERAL_SIN_ROL: no se encontro un rol vigente que requiera completar la membresia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, membresia_borrador INTO v_persona_id, v_borrador FROM persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND fecha_eliminacion IS NULL
    AND (membresia_completada = false OR btrim(primer_nombre) = '' OR btrim(primer_apellido) = '');

  v_datos_completos := COALESCE(v_borrador, '{}'::jsonb) || p_datos;

  IF v_persona_id IS NOT NULL THEN
    UPDATE persona SET
      primer_nombre = p_datos->>'primer_nombre',
      segundo_nombre = p_datos->>'segundo_nombre',
      primer_apellido = p_datos->>'primer_apellido',
      segundo_apellido = p_datos->>'segundo_apellido',
      sexo = (p_datos->>'sexo')::sexo_enum,
      fecha_nacimiento = NULLIF(p_datos->>'fecha_nacimiento', '')::date,
      ci = p_datos->>'ci',
      correo = p_datos->>'correo',
      membresia_completada = true,
      membresia_borrador = NULL,
      membresia_paso_actual = NULL
    WHERE id = v_persona_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM persona
      WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
        AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
    ) THEN
      RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                          sexo, fecha_nacimiento, ci, correo, membresia_completada)
    VALUES (v_iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
            p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
            (p_datos->>'sexo')::sexo_enum, NULLIF(p_datos->>'fecha_nacimiento', '')::date,
            p_datos->>'ci', p_datos->>'correo', true)
    RETURNING id INTO v_persona_id;
  END IF;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  IF v_datos_completos ? 'telefono' THEN
    PERFORM fn_guardar_telefono_membresia(v_persona_id, v_iglesia_id, v_datos_completos->>'telefono');
  END IF;

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, v_datos_completos);

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$function$;

-- fn_guardar_membresia_extendida: mismo criterio para ministerio_declarado
-- -- solo se marca si la clave 'ministerios' vino en el JSON (el frontend
-- viejo de produccion, sin la seccion de Ministerios en el flujo que
-- corresponda, no la manda nunca).
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
    update public.persona set ministerio_declarado = true where id = p_persona_id;
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
end;
$function$;
