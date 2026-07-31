-- VisionHub -- 58_otp_verificacion.sql
-- 15-gestion-administrativa, Panel 1. fn_generar_otp la llama la Edge
-- Function solicitar-otp (bajo el cliente del propio usuario, asi auth.uid()
-- resuelve bien) para crear el codigo y devolverselo en texto plano UNA sola
-- vez, para poder mandarlo por correo -- nunca se persiste en claro.
--
-- fn_exigir_pin mantiene firma y nombre identicos a como estaban en
-- 30_fusiones_y_pin.sql: las ~10 funciones que ya hacen
-- `PERFORM fn_exigir_pin(p_pin)` (fn_set_configuracion, fn_toggle_departamento,
-- fn_cambiar_moneda_defecto, fn_fusionar_cdp, fn_deshacer_fusion_cdp,
-- fn_fusionar_red, etc.) no cambian ni una linea.

CREATE OR REPLACE FUNCTION fn_generar_otp(p_proposito VARCHAR DEFAULT 'ACCION_SENSIBLE')
RETURNS TEXT
-- pgcrypto (crypt/gen_salt) vive en el schema `extensions`, no en `public`
-- -- mismo search_path que fn_establecer_pin (30_fusiones_y_pin.sql).
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_ultimo  TIMESTAMPTZ;
  v_codigo  TEXT;
BEGIN
  SELECT fecha_creacion INTO v_ultimo FROM usuario_otp
  WHERE usuario_id = auth.uid()
  ORDER BY fecha_creacion DESC LIMIT 1;

  -- Mismo intervalo minimo de 30s que el reenvio de correos de auth
  -- (harness/EMAILS-AUTH.md) -- evita que un click doble o un bucle gaste
  -- envios de correo sin necesidad.
  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '30 seconds' THEN
    RAISE EXCEPTION 'OTP_MUY_SEGUIDO: espera unos segundos antes de pedir otro codigo'
      USING ERRCODE = 'P0001';
  END IF;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO usuario_otp (usuario_id, codigo_hash, proposito, expira_en)
  VALUES (auth.uid(), crypt(v_codigo, gen_salt('bf')), p_proposito, now() + interval '10 minutes');

  RETURN v_codigo;
END;
$$;

-- Revocado de PUBLIC/anon a proposito: solo se llama desde la Edge Function
-- solicitar-otp con el cliente del usuario autenticado, nunca directo desde
-- el frontend (mismo patron que las funciones de invitacion).
REVOKE EXECUTE ON FUNCTION fn_generar_otp(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_generar_otp(VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION fn_verificar_otp(p_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_fila usuario_otp%ROWTYPE;
BEGIN
  SELECT * INTO v_fila FROM usuario_otp
  WHERE usuario_id = auth.uid() AND usado_en IS NULL AND expira_en > now()
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF v_fila.id IS NULL THEN
    RETURN false;
  END IF;

  IF crypt(COALESCE(p_codigo, ''), v_fila.codigo_hash) != v_fila.codigo_hash THEN
    RETURN false;
  END IF;

  UPDATE usuario_otp SET usado_en = now() WHERE id = v_fila.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION fn_exigir_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF fn_es_super_admin() THEN
    IF NOT fn_verificar_otp(p_pin) THEN
      RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;
