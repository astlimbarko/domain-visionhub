-- VisionHub -- 62_crear_iglesia_hija_pastor.sql
-- Extiende fn_crear_iglesia para: (a) crear como hija/satelite de una
-- iglesia madre existente, y (b) asignar de una vez al Pastor -- SOLO si ya
-- tiene cuenta (p_pastor_usuario_id), un unico fn_exigir_pin cubre ambas
-- escrituras en la misma transaccion. Invitar por correo a un Pastor nuevo
-- sigue siendo un segundo paso aparte (crea una cuenta de auth.users nueva,
-- eso solo lo puede hacer la Edge Function invitar-usuario con service_role,
-- no una funcion de Postgres) -- el frontend lo encadena como "paso 2 de 2"
-- con su propio codigo, no se puede evitar sin comprometer el OTP de un
-- solo uso.
--
-- Cambia el tipo de retorno (VOID -> UUID, para que el frontend pueda
-- encadenar el paso 2) -- CREATE OR REPLACE no lo permite, hace falta
-- DROP + CREATE.

DROP FUNCTION IF EXISTS fn_crear_iglesia(VARCHAR, VARCHAR, TEXT);

CREATE FUNCTION fn_crear_iglesia(
  p_sufijo VARCHAR,
  p_ciudad VARCHAR,
  p_iglesia_padre_id UUID DEFAULT NULL,
  p_tipo iglesia_tipo_enum DEFAULT 'HIJA',
  p_pastor_usuario_id UUID DEFAULT NULL,
  p_pin TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cobertura_id UUID;
  v_moneda_id UUID;
  v_iglesia_id UUID;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede crear iglesias'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  IF p_iglesia_padre_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM iglesia WHERE id = p_iglesia_padre_id AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'IGLESIA_MADRE_NO_ENCONTRADA: la iglesia madre % no existe', p_iglesia_padre_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_cobertura_id FROM cobertura LIMIT 1;
  SELECT id INTO v_moneda_id FROM moneda WHERE codigo = 'BOB';

  INSERT INTO iglesia (sufijo, ciudad, cobertura_id, moneda_defecto_id, iglesia_padre_id, tipo)
  VALUES (p_sufijo, p_ciudad, v_cobertura_id, v_moneda_id, p_iglesia_padre_id, p_tipo)
  RETURNING id INTO v_iglesia_id;

  -- trg_validar_rol (fn_validar_asignacion_rol) revalida esta asignacion
  -- igual que cualquier alta de PASTOR -- no se duplica esa logica aca.
  IF p_pastor_usuario_id IS NOT NULL THEN
    INSERT INTO usuario_rol (usuario_id, iglesia_id, rol)
    VALUES (p_pastor_usuario_id, v_iglesia_id, 'PASTOR');
  END IF;

  RETURN v_iglesia_id;
END;
$$;
