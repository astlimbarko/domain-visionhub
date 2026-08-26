-- VisionHub -- KAN-252 (seguimiento): 2 cambios del mismo lote de pedidos
-- del owner tras probar el wizard en vivo.
--
-- 1) campos_obligatorios ahora también informa estado_civil y teléfono
--    (flags creados en 20260825190000) -- mismo patrón que los 4 flags
--    existentes, en las 2 funciones que arman ese jsonb.
-- 2) Cargo y posición: faltaba "Líder de Ministerio" en la lista de otros
--    cargos del censo autodeclarado (persona_censo_membresia, KAN-217).

ALTER TABLE persona_censo_membresia
  ADD COLUMN IF NOT EXISTS cargo_lider_ministerio BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION fn_mi_invitacion_pendiente()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT il.id, il.rol, il.iglesia_id, i.nombre AS iglesia_nombre,
         red.nombre AS red_nombre, il.casa_de_paz_id, il.departamento_id, d.nombre AS departamento_nombre
  INTO r
  FROM invitacion_lider il
  JOIN iglesia i ON i.id = il.iglesia_id
  LEFT JOIN red ON red.id = il.red_id
  LEFT JOIN departamento d ON d.id = il.departamento_id
  WHERE il.usuario_id = auth.uid() AND il.estado = 'PENDIENTE' AND il.fecha_eliminacion IS NULL
  ORDER BY il.fecha_creacion DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'rol', r.rol,
    'iglesia_id', r.iglesia_id,
    'iglesia_nombre', r.iglesia_nombre,
    'destino', CASE
      WHEN r.red_nombre IS NOT NULL THEN r.red_nombre
      WHEN r.casa_de_paz_id IS NOT NULL THEN fn_etiqueta_cdp(r.casa_de_paz_id)
      ELSE r.departamento_nombre
    END,
    'departamento_nombre', r.departamento_nombre,
    'campos_obligatorios', jsonb_build_object(
      'ci', fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO'),
      'estado_civil', fn_config_bool(r.iglesia_id, 'MEMBRESIA_ESTADO_CIVIL_OBLIGATORIO'),
      'telefono', fn_config_bool(r.iglesia_id, 'MEMBRESIA_TELEFONO_OBLIGATORIO')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mi_membresia_incompleta(p_iglesia_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_invitacion jsonb;
  v_iglesia_id uuid;
  v_iglesia_nombre text;
  v_rol text;
  v_borrador record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.persona
    WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
      AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
  ) THEN
    RETURN NULL;
  END IF;

  v_invitacion := public.fn_mi_invitacion_pendiente();
  IF v_invitacion IS NOT NULL THEN
    RETURN v_invitacion;
  END IF;

  IF p_iglesia_id IS NOT NULL THEN
    SELECT ur.iglesia_id INTO v_iglesia_id
    FROM public.usuario_rol ur
    WHERE ur.usuario_id = auth.uid() AND ur.iglesia_id = p_iglesia_id
      AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
    LIMIT 1;

    IF v_iglesia_id IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    v_iglesia_id := public.fn_mi_iglesia_membresia_general();
    IF v_iglesia_id IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT nombre INTO v_iglesia_nombre FROM public.iglesia WHERE id = v_iglesia_id;

  SELECT ur.rol::text INTO v_rol
  FROM public.usuario_rol ur
  WHERE ur.usuario_id = auth.uid() AND ur.iglesia_id = v_iglesia_id
    AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
  ORDER BY ur.fecha_creacion ASC
  LIMIT 1;

  SELECT primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, ci, correo,
         membresia_borrador, membresia_paso_actual
  INTO v_borrador
  FROM public.persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND fecha_eliminacion IS NULL
    AND (membresia_completada = false OR btrim(primer_nombre) = '' OR btrim(primer_apellido) = '');

  RETURN jsonb_build_object(
    'id', NULL,
    'rol', v_rol,
    'iglesia_id', v_iglesia_id,
    'iglesia_nombre', v_iglesia_nombre,
    'destino', NULL,
    'campos_obligatorios', jsonb_build_object(
      'ci', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO'),
      'estado_civil', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_ESTADO_CIVIL_OBLIGATORIO'),
      'telefono', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_TELEFONO_OBLIGATORIO')
    ),
    'paso_actual', COALESCE(v_borrador.membresia_paso_actual, 1),
    'datos_guardados', CASE WHEN v_borrador.primer_nombre IS NULL OR btrim(v_borrador.primer_nombre) = '' THEN NULL ELSE
      jsonb_build_object(
        'primer_nombre', v_borrador.primer_nombre, 'segundo_nombre', v_borrador.segundo_nombre,
        'primer_apellido', v_borrador.primer_apellido, 'segundo_apellido', v_borrador.segundo_apellido,
        'sexo', v_borrador.sexo, 'fecha_nacimiento', v_borrador.fecha_nacimiento,
        'ci', v_borrador.ci, 'correo', v_borrador.correo
      ) || COALESCE(v_borrador.membresia_borrador, '{}'::jsonb)
    END
  );
END;
$function$;

-- fn_guardar_membresia_extendida: agrega cargo_lider_ministerio al mismo
-- upsert del censo de cargos (KAN-217).
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
end;
$function$;
