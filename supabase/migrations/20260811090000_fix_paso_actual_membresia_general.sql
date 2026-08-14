-- VisionHub -- KAN-179 fix: membresia_paso_actual debe guardar la PROXIMA
-- pagina a mostrar al volver, no la ultima que se confirmo -- si no, al
-- reanudar se pierde un paso hacia atras (ej. confirmar la pagina 2 y
-- quedar viendo la 3, pero al volver reaparecia en la 2).
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
                            sexo, fecha_nacimiento, ci, correo, membresia_completada, membresia_paso_actual)
      VALUES (v_iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
              p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
              (p_datos->>'sexo')::sexo_enum, NULLIF(p_datos->>'fecha_nacimiento', '')::date,
              p_datos->>'ci', p_datos->>'correo', false, 2);
    ELSE
      UPDATE persona SET
        primer_nombre = p_datos->>'primer_nombre',
        segundo_nombre = p_datos->>'segundo_nombre',
        primer_apellido = p_datos->>'primer_apellido',
        segundo_apellido = p_datos->>'segundo_apellido',
        sexo = (p_datos->>'sexo')::sexo_enum,
        fecha_nacimiento = NULLIF(p_datos->>'fecha_nacimiento', '')::date,
        ci = p_datos->>'ci',
        correo = p_datos->>'correo',
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
