-- VisionHub -- KAN-179 (seguimiento): la pagina 1 del formulario tenia 11
-- campos (identidad + fecha/CI/correo + estado civil/ocupacion/instruccion),
-- se sentia sobrecargada. Se divide en 3 paginas mas livianas:
--   pagina 1 "Tu nombre": primer/segundo nombre, primer/segundo apellido, sexo (5 campos)
--   pagina 2 "Datos personales": fecha_nacimiento, ci, correo (3 campos)
--   pagina 3 "Datos generales": estado_civil, ocupacion, grado_instruccion (3 campos)
-- Solo la pagina 1 sigue necesitando manejo especial (crea la Persona real
-- -- sexo es NOT NULL en la tabla, por eso tiene que venir ahi). Las paginas
-- 2 y 3 ya funcionan con la rama generica (acumulan en el borrador JSONB),
-- sin cambios en esa parte.
CREATE OR REPLACE FUNCTION public.fn_guardar_paso_membresia_general(p_paso INT, p_datos JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    AND membresia_completada = false AND fecha_eliminacion IS NULL;

  IF p_paso = 1 THEN
    IF v_persona_id IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM persona
        WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
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
$$;
