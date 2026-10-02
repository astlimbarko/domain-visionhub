-- KAN-434: panel "Crear credencial para Evangelista" -- alta del rol para
-- una Persona que YA existe en el sistema (buscada por nombre) pero que
-- puede o no tener cuenta de acceso (usuario_id) todavia.
--
-- Flujo confirmado con el owner (2026-09-29, ver
-- harness/19-evangelista-personal/open-questions.md #3):
--  - Si la Persona ya tiene cuenta -> solo se otorga el rol
--    (fn_otorgar_evangelista, KAN-427), sin tocar nada de auth.
--  - Si NO tiene cuenta -> se crea una cuenta nueva con password fija
--    "12345678" (mismo patron que "contrasena directa" de
--    supabase/functions/invitar-lider/index.ts), se vincula a la Persona
--    existente (nunca se crea una Persona nueva), se le manda el correo
--    de aviso "Ya tenes acceso" (mismo texto que
--    supabase/functions/establecer-contrasena-temporal/index.ts), y de
--    paso se le otorga el rol Evangelista.
--
-- Estas funciones son el soporte de datos/escritura que consume la edge
-- function supabase/functions/crear-credencial-evangelista/index.ts (la
-- creacion de la cuenta de auth.users no puede hacerse desde SQL, por eso
-- la funcion final de vinculacion recibe el usuario_id ya creado).

-- Datos minimos para que el frontend arme el flujo (¿tiene cuenta? ¿tiene
-- correo guardado? ¿tiene CdP?) sin exponer la tabla persona por SELECT
-- directo. Gateada por el mismo permiso que otorgar el rol -- quien puede
-- otorgar, puede consultar estos datos de cualquier persona de su iglesia.
CREATE OR REPLACE FUNCTION fn_evangelista_datos_persona(p_persona_id UUID)
RETURNS TABLE (
  nombre_completo TEXT,
  correo VARCHAR,
  usuario_id UUID,
  tiene_cdp BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT p.iglesia_id INTO v_iglesia_id FROM persona p WHERE p.id = p_persona_id AND p.fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'EVANGELISTA_PERSONA_INEXISTENTE: la persona no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_otorgar_evangelista(v_iglesia_id) THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_PERMISO: no tiene permiso para consultar esta persona' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    fn_nombre_completo(p),
    p.correo,
    p.usuario_id,
    EXISTS (
      SELECT 1 FROM casa_de_paz_membresia m
      WHERE m.persona_id = p.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
    )
  FROM persona p WHERE p.id = p_persona_id;
END;
$$;

-- Vincula una cuenta de auth.users YA CREADA (por la edge function) a una
-- Persona existente que todavia no tenia usuario_id, actualiza el correo
-- de membresia si se pidio, y otorga el rol Evangelista de una sola vez.
-- Si la Persona ya tenia usuario_id (carrera con otra sesion, o el
-- frontend llamo mal) no pisa nada -- error explicito.
CREATE OR REPLACE FUNCTION fn_evangelista_vincular_usuario(
  p_persona_id UUID,
  p_usuario_id UUID,
  p_correo VARCHAR,
  p_actualizar_correo_membresia BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_usuario_actual UUID;
  v_rol_id UUID;
BEGIN
  SELECT p.iglesia_id, p.usuario_id INTO v_iglesia_id, v_usuario_actual
  FROM persona p WHERE p.id = p_persona_id AND p.fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'EVANGELISTA_PERSONA_INEXISTENTE: la persona no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_otorgar_evangelista(v_iglesia_id) THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_PERMISO: no tiene permiso para vincular esta cuenta' USING ERRCODE = 'P0001';
  END IF;
  IF v_usuario_actual IS NOT NULL THEN
    RAISE EXCEPTION 'EVANGELISTA_YA_TIENE_CUENTA: esta persona ya tiene una cuenta vinculada' USING ERRCODE = 'P0001';
  END IF;

  UPDATE persona
  SET usuario_id = p_usuario_id,
      correo = CASE WHEN p_actualizar_correo_membresia THEN p_correo ELSE correo END
  WHERE id = p_persona_id;

  v_rol_id := fn_otorgar_evangelista(p_persona_id, v_iglesia_id);

  RETURN v_rol_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_evangelista_datos_persona(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_evangelista_vincular_usuario(UUID, UUID, VARCHAR, BOOLEAN) TO authenticated;
