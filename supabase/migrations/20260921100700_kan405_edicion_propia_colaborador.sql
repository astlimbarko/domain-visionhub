-- VisionHub -- KAN-405 seguimiento (2026-09-21, mismo día): pedido explícito
-- del owner en vivo -- el Colaborador debe poder REABRIR y CORREGIR (no solo
-- ver) las personas que él mismo cargó, desde su propio historial.
--
-- fn_guardar_membresia_extendida (create) NO es segura para reusar en
-- edición: persona_discipulado/ministerio_persona/referencia_familiar
-- insertan sin dedupe (duplicarían filas), y persona_seminario/
-- persona_universidad_rey_jesus/persona_mentor usan
-- ON CONFLICT ... DO NOTHING (un segundo guardado con datos distintos
-- quedaría pisado silenciosamente por el valor viejo). Todas esas tablas
-- además bloquean DELETE físico (fn_bloquear_delete).
--
-- Se agregan funciones NUEVAS de edición con patrón "reemplazo": soft-delete
-- (fecha_eliminacion = now()) de las filas vigentes de esa persona + INSERT
-- de las nuevas -- no se toca fn_guardar_membresia_extendida ni
-- fn_registrar_persona_afirmacion (cero riesgo de regresión en el alta).

CREATE OR REPLACE FUNCTION fn_editar_membresia_extendida(p_persona_id UUID, p_iglesia_id UUID, p_datos JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_tipo_relacion_id uuid;
BEGIN
  IF p_datos IS NULL THEN
    RETURN;
  END IF;

  IF p_datos ? 'bautizado' THEN
    UPDATE persona_detalle SET
      bautizado = nullif(p_datos->>'bautizado', '')::boolean,
      bautizado_en_nuestra_iglesia = nullif(p_datos->>'bautizado_en_nuestra_iglesia', '')::boolean,
      bautismo_anio = nullif(p_datos->>'bautismo_anio', '')::smallint,
      bautismo_mes = nullif(p_datos->>'bautismo_mes', '')::smallint,
      bautismo_dia = nullif(p_datos->>'bautismo_dia', '')::smallint,
      bautismo_precision_fecha = nullif(p_datos->>'bautismo_precision_fecha', '')::precision_fecha_enum
    WHERE persona_id = p_persona_id;
  END IF;

  IF p_datos ? 'discipulados' AND jsonb_typeof(p_datos->'discipulados') = 'array' THEN
    UPDATE persona_discipulado SET fecha_eliminacion = now(), eliminado_por = auth.uid()
    WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_datos->'discipulados') LOOP
      IF v_item ->> 'tipo_discipulado_id' IS NOT NULL THEN
        INSERT INTO persona_discipulado (iglesia_id, persona_id, tipo_discipulado_id, anio, mes, dia, precision_fecha)
        VALUES (p_iglesia_id, p_persona_id, (v_item->>'tipo_discipulado_id')::uuid,
          nullif(v_item->>'anio', '')::smallint, nullif(v_item->>'mes', '')::smallint,
          nullif(v_item->>'dia', '')::smallint, nullif(v_item->>'precision_fecha', '')::precision_fecha_enum);
      END IF;
    END LOOP;
  END IF;

  UPDATE persona_seminario SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL;
  IF coalesce((p_datos->>'seminario')::boolean, false) THEN
    INSERT INTO persona_seminario (iglesia_id, persona_id, anio, mes, dia, precision_fecha)
    VALUES (p_iglesia_id, p_persona_id, nullif(p_datos->>'seminario_anio', '')::smallint,
      nullif(p_datos->>'seminario_mes', '')::smallint, nullif(p_datos->>'seminario_dia', '')::smallint,
      nullif(p_datos->>'seminario_precision_fecha', '')::precision_fecha_enum);
  END IF;

  UPDATE persona_universidad_rey_jesus SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL;
  IF coalesce((p_datos->>'universidad')::boolean, false) THEN
    INSERT INTO persona_universidad_rey_jesus (iglesia_id, persona_id, anio, mes, dia, precision_fecha)
    VALUES (p_iglesia_id, p_persona_id, nullif(p_datos->>'universidad_anio', '')::smallint,
      nullif(p_datos->>'universidad_mes', '')::smallint, nullif(p_datos->>'universidad_dia', '')::smallint,
      nullif(p_datos->>'universidad_precision_fecha', '')::precision_fecha_enum);
  END IF;

  UPDATE persona_mentor SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL;
  IF coalesce((p_datos->>'mentor')::boolean, false)
     AND p_datos->>'mentor_nombre_txt' IS NOT NULL
     AND btrim(p_datos->>'mentor_nombre_txt') <> '' THEN
    INSERT INTO persona_mentor (iglesia_id, persona_id, mentor_nombre_txt, mentor_es_miembro)
    VALUES (p_iglesia_id, p_persona_id, btrim(p_datos->>'mentor_nombre_txt'),
      coalesce((p_datos->>'mentor_es_miembro')::boolean, false));
  END IF;

  IF p_datos ? 'ministerios' AND jsonb_typeof(p_datos->'ministerios') = 'array' THEN
    UPDATE ministerio_persona SET fecha_eliminacion = now(), eliminado_por = auth.uid()
    WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_datos->'ministerios') LOOP
      IF jsonb_typeof(v_item) = 'string' AND (v_item #>> '{}') IS NOT NULL THEN
        INSERT INTO ministerio_persona (iglesia_id, ministerio_id, persona_id, fecha_inicio)
        VALUES (p_iglesia_id, (v_item #>> '{}')::uuid, p_persona_id, current_date);
      END IF;
    END LOOP;
    UPDATE persona SET ministerio_declarado = true WHERE id = p_persona_id;
  END IF;

  IF p_datos ? 'familiares' AND jsonb_typeof(p_datos->'familiares') = 'array' THEN
    UPDATE referencia_familiar SET fecha_eliminacion = now(), eliminado_por = auth.uid()
    WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_datos->'familiares') LOOP
      IF v_item ->> 'nombre_familiar' IS NOT NULL AND btrim(v_item->>'nombre_familiar') <> '' THEN
        SELECT id INTO v_tipo_relacion_id FROM tipo_relacion
        WHERE codigo = upper(v_item->>'tipo_relacion_codigo') AND fecha_eliminacion IS NULL;
        IF v_tipo_relacion_id IS NOT NULL THEN
          INSERT INTO referencia_familiar (iglesia_id, persona_id, nombre_familiar, tipo_relacion_id, es_miembro_iglesia)
          VALUES (p_iglesia_id, p_persona_id, btrim(v_item->>'nombre_familiar'), v_tipo_relacion_id,
            coalesce((v_item->>'es_miembro')::boolean, false));
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Cargo/rango: ya es upsert real (ON CONFLICT DO UPDATE) -- mismo bloque
  -- que fn_guardar_membresia_extendida, es seguro reusarlo tal cual en edicion.
  IF p_datos ?| array['efesio_tipo', 'cargo_ministro', 'cargo_anciano', 'cargo_diacono',
                       'cargo_mentor', 'cargo_sub_mentor', 'cargo_lider_cdp', 'cargo_sublider_cdp',
                       'cargo_lider_ministerio', 'rango_miembro'] THEN
    INSERT INTO persona_censo_membresia
      (iglesia_id, persona_id, efesio_tipo, cargo_ministro, cargo_anciano, cargo_diacono,
       cargo_mentor, cargo_sub_mentor, cargo_lider_cdp, cargo_sublider_cdp, cargo_lider_ministerio, rango_miembro)
    VALUES (
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
    ON CONFLICT (persona_id) DO UPDATE SET
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
  END IF;
END;
$$;

-- fn_guardar_telefono_membresia (create) tambien es insert-only -- variante
-- de edicion con el mismo patron soft-delete + insert.
CREATE OR REPLACE FUNCTION fn_editar_telefono_membresia(p_persona_id UUID, p_iglesia_id UUID, p_numero TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  UPDATE telefono_asignacion
  SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE persona_id = p_persona_id AND es_principal = true AND fecha_eliminacion IS NULL;

  IF p_numero IS NULL OR btrim(p_numero) = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_tipo_telefono_id FROM tipo_telefono WHERE codigo = 'WHATSAPP' AND fecha_eliminacion IS NULL;

  INSERT INTO telefono (iglesia_id, tipo_telefono_id, numero)
  VALUES (p_iglesia_id, v_tipo_telefono_id, btrim(p_numero))
  RETURNING id INTO v_telefono_id;

  INSERT INTO telefono_asignacion (iglesia_id, telefono_id, persona_id, es_principal)
  VALUES (p_iglesia_id, v_telefono_id, p_persona_id, true);
END;
$$;

-- ============================================================
-- Editar persona (Colaborador/Lider de Afirmacion, SOLO lo que ellos mismos
-- cargaron -- creado_por = auth.uid()). No toca casa_de_paz_membresia (la
-- asignacion de Red/CdP no se re-edita acá, ya quedó fijada al registrar).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_editar_persona_afirmacion(p_persona_id UUID, p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_persona persona;
BEGIN
  SELECT * INTO v_persona FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFIRMACION_PERSONA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  IF v_persona.creado_por IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AFIRMACION_SOLO_EDITA_LO_PROPIO: solo puede editar personas que usted mismo registro'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_lider_afirmacion_en(v_persona.iglesia_id) OR fn_es_colaborador_activo_en(v_persona.iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE persona SET
    primer_nombre = p_datos->>'primer_nombre',
    segundo_nombre = p_datos->>'segundo_nombre',
    primer_apellido = p_datos->>'primer_apellido',
    segundo_apellido = p_datos->>'segundo_apellido',
    sexo = (p_datos->>'sexo')::sexo_enum,
    fecha_nacimiento = (p_datos->>'fecha_nacimiento')::date,
    ci = p_datos->>'ci',
    correo = p_datos->>'correo'
  WHERE id = p_persona_id;

  UPDATE persona_detalle SET
    estado_civil = (p_datos->>'estado_civil')::estado_civil_enum,
    grado_instruccion = (p_datos->>'grado_instruccion')::grado_instruccion_enum,
    ocupacion = p_datos->>'ocupacion',
    nacimiento_ciudad = p_datos->>'nacimiento_ciudad'
  WHERE persona_id = p_persona_id;

  PERFORM fn_editar_membresia_extendida(p_persona_id, v_persona.iglesia_id, p_datos);
  PERFORM fn_editar_telefono_membresia(p_persona_id, v_persona.iglesia_id, p_datos->>'telefono');

  RETURN jsonb_build_object(
    'persona_id', p_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = p_persona_id)
  );
END;
$$;

-- ============================================================
-- Getter para precargar el formulario en modo edicion -- mismo shape que
-- p_datos espera (DatosPersonaAfirmacion + DatosMembresiaExtendida en el
-- frontend). Mismo gate de "solo lo propio" que la escritura.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_obtener_persona_editar_afirmacion(p_persona_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_persona persona;
  v_detalle persona_detalle;
  v_telefono TEXT;
  v_resultado JSONB;
BEGIN
  SELECT * INTO v_persona FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFIRMACION_PERSONA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  IF v_persona.creado_por IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AFIRMACION_SOLO_EDITA_LO_PROPIO' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_lider_afirmacion_en(v_persona.iglesia_id) OR fn_es_colaborador_activo_en(v_persona.iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_detalle FROM persona_detalle WHERE persona_id = p_persona_id;

  SELECT t.numero INTO v_telefono
  FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
  WHERE ta.persona_id = p_persona_id AND ta.es_principal = true AND ta.fecha_eliminacion IS NULL
  LIMIT 1;

  v_resultado := jsonb_build_object(
    'persona_id', v_persona.id,
    'primer_nombre', v_persona.primer_nombre,
    'segundo_nombre', v_persona.segundo_nombre,
    'primer_apellido', v_persona.primer_apellido,
    'segundo_apellido', v_persona.segundo_apellido,
    'sexo', v_persona.sexo,
    'fecha_nacimiento', v_persona.fecha_nacimiento,
    'ci', v_persona.ci,
    'correo', v_persona.correo,
    'telefono', v_telefono,
    'estado_civil', v_detalle.estado_civil,
    'ocupacion', v_detalle.ocupacion,
    'grado_instruccion', v_detalle.grado_instruccion,
    'nacimiento_ciudad', v_detalle.nacimiento_ciudad,
    'bautizado', v_detalle.bautizado,
    'bautizado_en_nuestra_iglesia', v_detalle.bautizado_en_nuestra_iglesia,
    'bautismo_anio', v_detalle.bautismo_anio,
    'bautismo_mes', v_detalle.bautismo_mes,
    'bautismo_dia', v_detalle.bautismo_dia,
    'bautismo_precision_fecha', v_detalle.bautismo_precision_fecha,
    'discipulados', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'tipo_discipulado_id', pd.tipo_discipulado_id, 'anio', pd.anio, 'mes', pd.mes,
        'dia', pd.dia, 'precision_fecha', pd.precision_fecha
      )), '[]'::jsonb)
      FROM persona_discipulado pd WHERE pd.persona_id = p_persona_id AND pd.fecha_eliminacion IS NULL
    ),
    'seminario', EXISTS (SELECT 1 FROM persona_seminario s WHERE s.persona_id = p_persona_id AND s.fecha_eliminacion IS NULL),
    'seminario_anio', (SELECT s.anio FROM persona_seminario s WHERE s.persona_id = p_persona_id AND s.fecha_eliminacion IS NULL LIMIT 1),
    'seminario_mes', (SELECT s.mes FROM persona_seminario s WHERE s.persona_id = p_persona_id AND s.fecha_eliminacion IS NULL LIMIT 1),
    'seminario_dia', (SELECT s.dia FROM persona_seminario s WHERE s.persona_id = p_persona_id AND s.fecha_eliminacion IS NULL LIMIT 1),
    'seminario_precision_fecha', (SELECT s.precision_fecha FROM persona_seminario s WHERE s.persona_id = p_persona_id AND s.fecha_eliminacion IS NULL LIMIT 1),
    'universidad', EXISTS (SELECT 1 FROM persona_universidad_rey_jesus u WHERE u.persona_id = p_persona_id AND u.fecha_eliminacion IS NULL),
    'universidad_anio', (SELECT u.anio FROM persona_universidad_rey_jesus u WHERE u.persona_id = p_persona_id AND u.fecha_eliminacion IS NULL LIMIT 1),
    'universidad_mes', (SELECT u.mes FROM persona_universidad_rey_jesus u WHERE u.persona_id = p_persona_id AND u.fecha_eliminacion IS NULL LIMIT 1),
    'universidad_dia', (SELECT u.dia FROM persona_universidad_rey_jesus u WHERE u.persona_id = p_persona_id AND u.fecha_eliminacion IS NULL LIMIT 1),
    'universidad_precision_fecha', (SELECT u.precision_fecha FROM persona_universidad_rey_jesus u WHERE u.persona_id = p_persona_id AND u.fecha_eliminacion IS NULL LIMIT 1),
    'mentor', EXISTS (SELECT 1 FROM persona_mentor m WHERE m.persona_id = p_persona_id AND m.fecha_eliminacion IS NULL),
    'mentor_nombre_txt', (SELECT m.mentor_nombre_txt FROM persona_mentor m WHERE m.persona_id = p_persona_id AND m.fecha_eliminacion IS NULL LIMIT 1),
    'mentor_es_miembro', (SELECT m.mentor_es_miembro FROM persona_mentor m WHERE m.persona_id = p_persona_id AND m.fecha_eliminacion IS NULL LIMIT 1),
    'ministerios', (
      SELECT coalesce(jsonb_agg(mp.ministerio_id), '[]'::jsonb)
      FROM ministerio_persona mp WHERE mp.persona_id = p_persona_id AND mp.fecha_eliminacion IS NULL
    ),
    'familiares', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'nombre_familiar', rf.nombre_familiar, 'tipo_relacion_codigo', tr.codigo, 'es_miembro', rf.es_miembro_iglesia
      )), '[]'::jsonb)
      FROM referencia_familiar rf JOIN tipo_relacion tr ON tr.id = rf.tipo_relacion_id
      WHERE rf.persona_id = p_persona_id AND rf.fecha_eliminacion IS NULL
    ),
    'efesio_tipo', (SELECT cm.efesio_tipo FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_ministro', (SELECT cm.cargo_ministro FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_anciano', (SELECT cm.cargo_anciano FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_diacono', (SELECT cm.cargo_diacono FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_mentor', (SELECT cm.cargo_mentor FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_sub_mentor', (SELECT cm.cargo_sub_mentor FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_lider_cdp', (SELECT cm.cargo_lider_cdp FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_sublider_cdp', (SELECT cm.cargo_sublider_cdp FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'cargo_lider_ministerio', (SELECT cm.cargo_lider_ministerio FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1),
    'rango_miembro', (SELECT cm.rango_miembro FROM persona_censo_membresia cm WHERE cm.persona_id = p_persona_id LIMIT 1)
  );

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_editar_membresia_extendida(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_editar_telefono_membresia(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_editar_persona_afirmacion(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_persona_editar_afirmacion(UUID) TO authenticated;
