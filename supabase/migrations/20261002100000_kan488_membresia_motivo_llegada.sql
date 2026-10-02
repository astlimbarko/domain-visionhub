-- KAN-488: "¿Cómo llegó a la iglesia?" pasa de texto libre a un MOTIVO de
-- llegada estructurado (combobox reusando el catálogo motivo_llegada, igual que
-- FichaLlegada). fn_guardar_membresia_nuevos usa p_payload->>'motivo_llegada_id'
-- para persona_llegada.motivo_llegada_id (si no viene, lo deriva del invitador
-- como antes). fn_obtener_persona_para_membresia devuelve ese motivo para la
-- precarga. Se mantiene todo lo demás (modo crear/actualizar, CdP, estado, etc.).

-- 1) Obtener: devolver motivo_llegada_id en vez de como_llego.
CREATE OR REPLACE FUNCTION public.fn_obtener_persona_para_membresia(p_persona_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id uuid; v_result jsonb;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN RAISE EXCEPTION 'MEMBRESIA_PERSONA_INVALIDA: la persona no existe' USING ERRCODE='P0001'; END IF;
  IF NOT fn_puede_gestionar_afirmacion(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia' USING ERRCODE='P0001';
  END IF;

  SELECT jsonb_build_object(
    'persona_id', p.id,
    'primer_nombre', p.primer_nombre, 'segundo_nombre', COALESCE(p.segundo_nombre,''),
    'primer_apellido', p.primer_apellido, 'segundo_apellido', COALESCE(p.segundo_apellido,''),
    'sexo', COALESCE(p.sexo::text,''), 'fecha_nacimiento', COALESCE(p.fecha_nacimiento::text,''),
    'ci', COALESCE(p.ci,''), 'correo', COALESCE(p.correo,''),
    'estado_civil', COALESCE(pd.estado_civil::text,''), 'ocupacion', COALESCE(pd.ocupacion,''),
    'grado_instruccion', COALESCE(pd.grado_instruccion::text,''), 'discipulado_nivel', COALESCE(pd.discipulado_nivel::text,''),
    'telefono', COALESCE((SELECT t.numero FROM telefono_asignacion ta JOIN telefono t ON t.id=ta.telefono_id
      WHERE ta.persona_id=p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL AND t.fecha_eliminacion IS NULL LIMIT 1),''),
    'direccion', COALESCE((SELECT d.calle FROM direccion_asignacion da JOIN direccion d ON d.id=da.direccion_id
      WHERE da.persona_id=p.id AND da.es_principal AND da.fecha_eliminacion IS NULL AND d.fecha_eliminacion IS NULL LIMIT 1),''),
    'motivo_llegada_id', COALESCE((SELECT pl.motivo_llegada_id::text FROM persona_llegada pl
      WHERE pl.persona_id=p.id AND pl.fecha_eliminacion IS NULL ORDER BY pl.fecha_creacion DESC LIMIT 1),''),
    'invitador_persona_id', COALESCE((SELECT pl.invitado_por_id::text FROM persona_llegada pl
      WHERE pl.persona_id=p.id AND pl.fecha_eliminacion IS NULL ORDER BY pl.fecha_creacion DESC LIMIT 1),''),
    'invitador_nombre', COALESCE((SELECT CASE WHEN pl.invitado_por_id IS NOT NULL
        THEN (SELECT fn_nombre_completo(pi) FROM persona pi WHERE pi.id=pl.invitado_por_id)
        ELSE COALESCE(pl.invitado_por_txt,'') END
      FROM persona_llegada pl WHERE pl.persona_id=p.id AND pl.fecha_eliminacion IS NULL ORDER BY pl.fecha_creacion DESC LIMIT 1),''),
    'invitador_es_libre', COALESCE((SELECT (pl.invitado_por_id IS NULL AND pl.invitado_por_txt IS NOT NULL)
      FROM persona_llegada pl WHERE pl.persona_id=p.id AND pl.fecha_eliminacion IS NULL ORDER BY pl.fecha_creacion DESC LIMIT 1), false),
    'casa_de_paz_id', COALESCE((SELECT cm.casa_de_paz_id::text FROM casa_de_paz_membresia cm
      WHERE cm.persona_id=p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),''),
    'casa_de_paz_nombre', COALESCE((SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
      WHERE cm.persona_id=p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),'')
  ) INTO v_result
  FROM persona p LEFT JOIN persona_detalle pd ON pd.persona_id=p.id WHERE p.id=p_persona_id;
  RETURN v_result;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.fn_obtener_persona_para_membresia(uuid) TO authenticated;

-- 2) Guardar: usar motivo_llegada_id del payload (si viene).
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
