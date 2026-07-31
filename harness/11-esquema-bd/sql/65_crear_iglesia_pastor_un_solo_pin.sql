-- VisionHub -- 65_crear_iglesia_pastor_un_solo_pin.sql
-- Bug reportado 2026-07-31: invitar un Pastor nuevo por correo al crear una
-- iglesia pedia un SEGUNDO codigo OTP (invitar-usuario ya exige el suyo
-- propio, fn_exigir_pin, independiente del que gasto fn_crear_iglesia). El
-- owner pidio que un solo codigo alcance -- la Edge Function crear-iglesia
-- (nueva) hace las 3 escrituras (iglesia, invitacion de auth, cargo de
-- Pastor) en una sola llamada de red verificando el OTP una unica vez.
-- fn_vincular_pastor_invitado es el ultimo paso de esa cadena: no pide PIN
-- propio (ya se verifico en el mismo request, en fn_crear_iglesia), pero
-- solo funciona si la iglesia todavia no tiene Pastor -- no sirve para
-- reemplazar uno existente (eso sigue yendo por fn_actualizar_usuario_rol,
-- que si pide su propio PIN).

CREATE OR REPLACE FUNCTION fn_vincular_pastor_invitado(p_iglesia_id UUID, p_usuario_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede asignar el Pastor de una iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE iglesia_id = p_iglesia_id AND rol = 'PASTOR' AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'IGLESIA_YA_TIENE_PASTOR: esta iglesia ya tiene un Pastor asignado; para reemplazarlo, edita el cargo existente'
      USING ERRCODE = 'P0001';
  END IF;

  -- trg_validar_rol revalida esta asignacion igual que cualquier alta de
  -- PASTOR (mismo camino que fn_crear_iglesia cuando el pastor ya tenia
  -- cuenta) -- no se duplica esa logica aca.
  INSERT INTO usuario_rol (usuario_id, iglesia_id, rol) VALUES (p_usuario_id, p_iglesia_id, 'PASTOR');
END;
$$;

GRANT EXECUTE ON FUNCTION fn_vincular_pastor_invitado(UUID, UUID) TO authenticated;

-- Bug reportado 2026-07-31: fn_generar_otp solo devolvia el codigo, sin
-- decir cuando vence -- el frontend mostraba un texto estatico ("valido por
-- 10 minutos") en vez de una cuenta regresiva real, facil de confundir con
-- el cooldown de 30s del boton "Reenviar". Cambia el tipo de retorno
-- (TEXT -> TABLE), CREATE OR REPLACE no lo permite con esta funcion.
DROP FUNCTION IF EXISTS fn_generar_otp(VARCHAR);

CREATE FUNCTION fn_generar_otp(p_proposito VARCHAR DEFAULT 'ACCION_SENSIBLE')
RETURNS TABLE (codigo TEXT, expira_en TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_ultimo  TIMESTAMPTZ;
  v_codigo  TEXT;
  v_expira  TIMESTAMPTZ;
BEGIN
  SELECT fecha_creacion INTO v_ultimo FROM usuario_otp
  WHERE usuario_id = auth.uid()
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '30 seconds' THEN
    RAISE EXCEPTION 'OTP_MUY_SEGUIDO: espera unos segundos antes de pedir otro codigo'
      USING ERRCODE = 'P0001';
  END IF;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');
  v_expira := now() + interval '10 minutes';

  INSERT INTO usuario_otp (usuario_id, codigo_hash, proposito, expira_en)
  VALUES (auth.uid(), crypt(v_codigo, gen_salt('bf')), p_proposito, v_expira);

  RETURN QUERY SELECT v_codigo, v_expira;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_generar_otp(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_generar_otp(VARCHAR) TO authenticated;
