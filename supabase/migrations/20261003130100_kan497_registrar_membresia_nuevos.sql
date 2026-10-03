-- KAN-497 paso 7: deja registrado quién cargó / actualizó a una persona desde el
-- formulario de membresía de nuevos. Una sola fila por persona: si ya existe, se
-- actualiza (quién la modificó y cuándo) en vez de crear otra.
CREATE OR REPLACE FUNCTION public.fn_afirmacion_registrar_membresia_nuevos(
  p_persona_id uuid,
  p_iglesia_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM persona WHERE id = p_persona_id AND iglesia_id = p_iglesia_id
                 AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_PERSONA_INVALIDA: la persona no existe en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id
  FROM persona_proceso_afirmacion
  WHERE persona_id = p_persona_id AND proceso_codigo = 'MEMBRESIA_NUEVOS'
    AND fecha_eliminacion IS NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO persona_proceso_afirmacion (persona_id, iglesia_id, proceso_codigo, fecha)
    VALUES (p_persona_id, p_iglesia_id, 'MEMBRESIA_NUEVOS', CURRENT_DATE)
    RETURNING id INTO v_id;
  ELSE
    UPDATE persona_proceso_afirmacion
    SET fecha_actualizacion = now(), actualizado_por = auth.uid()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_registrar_membresia_nuevos(uuid, uuid) TO authenticated;
