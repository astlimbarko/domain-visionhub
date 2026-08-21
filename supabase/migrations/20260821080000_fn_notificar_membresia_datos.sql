-- VisionHub -- fix del correo de bienvenida de membresia: la Edge Function
-- no puede usar SUPABASE_SERVICE_ROLE_KEY para saltarse RLS en este
-- proyecto (probado en vivo: "permission denied for table persona" incluso
-- con el service role -- la clave legada no se comporta como se esperaba,
-- posible migracion al nuevo sistema de API keys de Supabase). Se resuelve
-- con el MISMO patron de seguridad que ya usa todo el proyecto para el
-- registro anonimo: una funcion SECURITY DEFINER angosta, invocada con la
-- clave anon normal -- nunca hace falta el service role.
--
-- Atomica (UPDATE ... WHERE ... RETURNING): marca "enviado" en el mismo
-- paso que lee los datos, para que 2 llamadas concurrentes con el mismo
-- personaId nunca manden el correo 2 veces.

CREATE OR REPLACE FUNCTION public.fn_notificar_membresia_datos(p_persona_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_correo VARCHAR;
  v_nombre TEXT;
  v_iglesia_nombre VARCHAR;
BEGIN
  UPDATE persona
  SET membresia_correo_bienvenida_enviado = true
  WHERE id = p_persona_id
    AND fecha_eliminacion IS NULL
    AND correo IS NOT NULL
    AND NOT membresia_correo_bienvenida_enviado
  RETURNING correo, fn_nombre_completo(persona), (SELECT nombre FROM iglesia WHERE id = persona.iglesia_id)
  INTO v_correo, v_nombre, v_iglesia_nombre;

  IF v_correo IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('correo', v_correo, 'nombre_completo', v_nombre, 'iglesia_nombre', v_iglesia_nombre);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_notificar_membresia_datos(UUID) TO anon, authenticated;
