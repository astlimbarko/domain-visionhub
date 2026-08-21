-- VisionHub -- KAN-213 (fix complementario, encontrado al probar KAN-216):
-- fn_mi_membresia_incompleta ya trataba una persona con nombre vacio como
-- incompleta (migracion 20260821000000) sin importar membresia_completada,
-- pero fn_guardar_paso_membresia_general y fn_completar_membresia_general
-- seguian buscando la fila SOLO por membresia_completada = false -- no
-- encontraban la fila rota (membresia_completada = true, nombre vacio) y
-- bloqueaban el guardado con MEMBRESIA_YA_COMPLETADA (probado en vivo:
-- 400 al tocar "Siguiente" en la pagina 1 con esa cuenta).
--
-- Mismo criterio en las 3 funciones ahora: una persona con nombre/apellido
-- en blanco se trata como incompleta, la tenga o no marcada
-- membresia_completada = true.

CREATE OR REPLACE FUNCTION public.fn_guardar_paso_membresia_general(p_paso integer, p_datos jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID;
BEGIN
  v_iglesia_id := fn_mi_iglesia_membresia_general();
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEMBRESIA_GENERAL_SIN_ROL: no se encontro un rol vigente que requiera completar la membresia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_persona_id FROM persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND fecha_eliminacion IS NULL
    AND (membresia_completada = false OR btrim(primer_nombre) = '' OR btrim(primer_apellido) = '');

  IF p_paso = 1 THEN
    IF v_persona_id IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM persona
        WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
          AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
      ) THEN
        RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                            sexo, membresia_completada, membresia_paso_actual)
      VALUES (v_iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
              p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
              (p_datos->>'sexo')::sexo_enum, false, 2);
    ELSE
      UPDATE persona SET
        primer_nombre = p_datos->>'primer_nombre',
        segundo_nombre = p_datos->>'segundo_nombre',
        primer_apellido = p_datos->>'primer_apellido',
        segundo_apellido = p_datos->>'segundo_apellido',
        sexo = (p_datos->>'sexo')::sexo_enum,
        membresia_completada = false,
        membresia_paso_actual = GREATEST(COALESCE(membresia_paso_actual, 1), 2)
      WHERE id = v_persona_id;
    END IF;
  ELSE
    IF v_persona_id IS NULL THEN
      RAISE EXCEPTION 'MEMBRESIA_BORRADOR_NO_ENCONTRADO: complete primero la pagina de datos personales'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE persona SET
      membresia_borrador = COALESCE(membresia_borrador, '{}'::jsonb) || p_datos,
      membresia_paso_actual = GREATEST(COALESCE(membresia_paso_actual, 1), p_paso + 1)
    WHERE id = v_persona_id;
  END IF;
END;
$function$;

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

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, v_datos_completos);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$function$;
