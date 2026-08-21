-- VisionHub -- KAN-213 (segundo fix complementario, encontrado al probar
-- KAN-216 en vivo): fn_completar_membresia_general insertaba en
-- persona_detalle sin manejar conflicto -- si la persona ya tenia una fila
-- ahi (ej. reabierta tras el fix de nombre vacio, o cualquier reintento
-- despues de una falla parcial previa), el INSERT choca con
-- uq_persona_detalle (UNIQUE persona_id) y la persona queda bloqueada para
-- siempre sin poder completar su membresia. Se vuelve upsert -- mismo
-- comportamiento para el caso normal (persona nueva, sin fila previa),
-- ahora tambien seguro para el caso de reintento.

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
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad')
  ON CONFLICT (persona_id) DO UPDATE SET
    estado_civil = EXCLUDED.estado_civil,
    grado_instruccion = EXCLUDED.grado_instruccion,
    ocupacion = EXCLUDED.ocupacion,
    nacimiento_ciudad = EXCLUDED.nacimiento_ciudad;

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, v_datos_completos);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$function$;
