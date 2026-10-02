-- KAN-488 (UX 2026-10-02): el formulario "Membresía desde 0" ahora captura
-- Familia + Cónyuge (se reusa la misma UI de la membresía extendida). Este
-- cambio agrega la persistencia: fn_guardar_membresia_nuevos recibe
-- p_payload->'familiares' (array de {tipo_relacion_codigo, nombre_familiar,
-- es_miembro}) y los inserta en referencia_familiar, igual que
-- fn_actualizar_membresia (KAN-252). En modo actualizar no duplica: salta un
-- familiar si ya existe uno con el mismo nombre + parentesco para esa persona.
-- El cónyuge es un familiar más (tipo_relacion_codigo='CONYUGE'). Se mantiene
-- todo lo demás idéntico a la versión 20261002100000.

CREATE OR REPLACE FUNCTION public.fn_guardar_membresia_nuevos(p_iglesia_id uuid, p_payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_persona_id      uuid := NULLIF(p_payload->>'persona_id', '')::uuid;
  v_es_actualizar   boolean := v_persona_id IS NOT NULL;
  v_invitador_id    uuid := NULLIF(p_payload->>'invitador_persona_id', '')::uuid;
  v_invitador_txt   text := NULLIF(trim(p_payload->>'invitador_txt'), '');
  v_casa_de_paz_id  uuid := NULLIF(p_payload->>'casa_de_paz_id', '')::uuid;
  v_motivo_payload  uuid := NULLIF(p_payload->>'motivo_llegada_id', '')::uuid;
  v_es_visita       boolean := COALESCE((p_payload->>'es_visita')::boolean, false);
  v_motivo_id       uuid;
  v_direccion       text := NULLIF(trim(p_payload->>'direccion'), '');
  v_direccion_id    uuid;
  v_cdp_iglesia_id  uuid;
  v_tiene_estado    boolean;
  v_item            jsonb;
  v_tipo_relacion_id uuid;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia' USING ERRCODE='P0001';
  END IF;
  IF COALESCE(p_payload->>'primer_nombre','')='' OR COALESCE(p_payload->>'primer_apellido','')='' OR COALESCE(p_payload->>'sexo','')='' THEN
    RAISE EXCEPTION 'MEMBRESIA_DATOS_INCOMPLETOS: faltan nombre, apellido o sexo' USING ERRCODE='P0001';
  END IF;

  IF v_es_actualizar THEN
    IF NOT EXISTS (SELECT 1 FROM persona WHERE id=v_persona_id AND iglesia_id=p_iglesia_id AND fecha_eliminacion IS NULL) THEN
      RAISE EXCEPTION 'MEMBRESIA_PERSONA_INVALIDA: la persona no existe en esta iglesia' USING ERRCODE='P0001';
    END IF;
    UPDATE persona SET
      primer_nombre=p_payload->>'primer_nombre', segundo_nombre=NULLIF(p_payload->>'segundo_nombre',''),
      primer_apellido=p_payload->>'primer_apellido', segundo_apellido=NULLIF(p_payload->>'segundo_apellido',''),
      sexo=(p_payload->>'sexo')::sexo_enum,
      fecha_nacimiento=COALESCE(NULLIF(p_payload->>'fecha_nacimiento','')::date, fecha_nacimiento),
      ci=COALESCE(NULLIF(p_payload->>'ci',''), ci), correo=COALESCE(NULLIF(p_payload->>'correo',''), correo)
    WHERE id=v_persona_id;
    INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, discipulado_nivel)
    VALUES (v_persona_id, NULLIF(p_payload->>'estado_civil','')::estado_civil_enum,
            NULLIF(p_payload->>'grado_instruccion','')::grado_instruccion_enum,
            NULLIF(p_payload->>'ocupacion',''), NULLIF(p_payload->>'discipulado_nivel','')::discipulado_nivel_enum)
    ON CONFLICT (persona_id) DO UPDATE SET
      estado_civil=COALESCE(EXCLUDED.estado_civil, persona_detalle.estado_civil),
      grado_instruccion=COALESCE(EXCLUDED.grado_instruccion, persona_detalle.grado_instruccion),
      ocupacion=COALESCE(EXCLUDED.ocupacion, persona_detalle.ocupacion),
      discipulado_nivel=COALESCE(EXCLUDED.discipulado_nivel, persona_detalle.discipulado_nivel);
  ELSE
    INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                         sexo, fecha_nacimiento, ci, correo, membresia_completada)
    VALUES (p_iglesia_id, p_payload->>'primer_nombre', NULLIF(p_payload->>'segundo_nombre',''),
            p_payload->>'primer_apellido', NULLIF(p_payload->>'segundo_apellido',''),
            (p_payload->>'sexo')::sexo_enum, NULLIF(p_payload->>'fecha_nacimiento','')::date,
            NULLIF(p_payload->>'ci',''), NULLIF(p_payload->>'correo',''), false)
    RETURNING id INTO v_persona_id;
    INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, bautizado, bautizado_en_nuestra_iglesia, discipulado_nivel)
    VALUES (v_persona_id, NULLIF(p_payload->>'estado_civil','')::estado_civil_enum,
            NULLIF(p_payload->>'grado_instruccion','')::grado_instruccion_enum, NULLIF(p_payload->>'ocupacion',''),
            NULL, NULL, NULLIF(p_payload->>'discipulado_nivel','')::discipulado_nivel_enum);
  END IF;

  PERFORM fn_guardar_telefono_membresia(v_persona_id, p_iglesia_id, NULLIF(p_payload->>'telefono',''));

  IF v_direccion IS NOT NULL AND NOT EXISTS (SELECT 1 FROM direccion_asignacion WHERE persona_id=v_persona_id AND es_principal AND fecha_eliminacion IS NULL) THEN
    INSERT INTO direccion (iglesia_id, calle) VALUES (p_iglesia_id, v_direccion) RETURNING id INTO v_direccion_id;
    INSERT INTO direccion_asignacion (iglesia_id, direccion_id, persona_id, es_principal) VALUES (p_iglesia_id, v_direccion_id, v_persona_id, true);
  END IF;

  IF v_casa_de_paz_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM casa_de_paz cdp JOIN iglesia ig ON ig.id=cdp.iglesia_id
      WHERE cdp.id=v_casa_de_paz_id AND cdp.fecha_eliminacion IS NULL AND (cdp.iglesia_id=p_iglesia_id OR ig.iglesia_padre_id=p_iglesia_id)) THEN
      RAISE EXCEPTION 'MEMBRESIA_CDP_INVALIDA: la Casa de Paz no pertenece a esta iglesia ni a sus satélites' USING ERRCODE='P0001';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM persona_llegada WHERE persona_id=v_persona_id AND fecha_eliminacion IS NULL) THEN
    IF v_motivo_payload IS NOT NULL THEN
      v_motivo_id := v_motivo_payload;
    ELSE
      SELECT id INTO v_motivo_id FROM motivo_llegada
      WHERE codigo = CASE WHEN v_invitador_id IS NOT NULL OR v_invitador_txt IS NOT NULL THEN 'INVITACION_PERSONAL' ELSE 'OTRO' END;
    END IF;
    INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso, invitado_por_id, invitado_por_txt)
    VALUES (p_iglesia_id, v_persona_id, v_motivo_id, CURRENT_DATE, v_invitador_id, v_invitador_txt);
  END IF;

  IF v_casa_de_paz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM casa_de_paz_membresia WHERE persona_id=v_persona_id AND es_principal AND fecha_fin IS NULL AND fecha_eliminacion IS NULL) THEN
    SELECT iglesia_id INTO v_cdp_iglesia_id FROM casa_de_paz WHERE id=v_casa_de_paz_id;
    INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
    VALUES (COALESCE(v_cdp_iglesia_id, p_iglesia_id), v_casa_de_paz_id, v_persona_id, true, CURRENT_DATE);
  END IF;

  -- Familia + Cónyuge (UX 2026-10-02): mismo criterio que fn_actualizar_membresia
  -- (KAN-252), pero sin duplicar en modo actualizar.
  IF p_payload ? 'familiares' AND jsonb_typeof(p_payload->'familiares') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'familiares')
    LOOP
      IF v_item->>'nombre_familiar' IS NOT NULL AND btrim(v_item->>'nombre_familiar') <> '' THEN
        SELECT id INTO v_tipo_relacion_id FROM public.tipo_relacion
        WHERE codigo = upper(v_item->>'tipo_relacion_codigo') AND fecha_eliminacion IS NULL;
        IF v_tipo_relacion_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM public.referencia_familiar rf
             WHERE rf.persona_id = v_persona_id
               AND rf.tipo_relacion_id = v_tipo_relacion_id
               AND lower(btrim(rf.nombre_familiar)) = lower(btrim(v_item->>'nombre_familiar'))
               AND rf.fecha_eliminacion IS NULL
           ) THEN
          INSERT INTO public.referencia_familiar (iglesia_id, persona_id, nombre_familiar, tipo_relacion_id, es_miembro_iglesia)
          VALUES (p_iglesia_id, v_persona_id, btrim(v_item->>'nombre_familiar'), v_tipo_relacion_id,
                  COALESCE((v_item->>'es_miembro')::boolean, false));
        END IF;
      END IF;
    END LOOP;
  END IF;

  SELECT EXISTS (SELECT 1 FROM persona_estado WHERE persona_id=v_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL) INTO v_tiene_estado;
  IF NOT v_tiene_estado THEN
    PERFORM fn_transicionar_estado(v_persona_id, CASE WHEN v_es_visita THEN 'SIM' ELSE 'NC' END, CURRENT_DATE, 'Membresía desde 0', false);
  END IF;

  RETURN jsonb_build_object('persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id=v_persona_id),
    'casa_de_paz_id', v_casa_de_paz_id, 'sin_casa_de_paz', v_casa_de_paz_id IS NULL, 'actualizada', v_es_actualizar);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.fn_guardar_membresia_nuevos(uuid, jsonb) TO authenticated;
