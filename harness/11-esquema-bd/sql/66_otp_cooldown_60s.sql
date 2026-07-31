-- VisionHub -- 66_otp_cooldown_60s.sql
-- El owner reporto que el correo con el codigo tarda en llegar y el
-- cooldown de 30s (fn_generar_otp, CampoOtp.tsx) se vencia antes de que el
-- correo llegara, invitando a reenviar de mas. Sube a 60s. CREATE OR REPLACE
-- alcanza porque la firma/tipo de retorno no cambia (ver 65_ para el ultimo
-- cambio de forma, TEXT -> TABLE).

CREATE OR REPLACE FUNCTION fn_generar_otp(p_proposito VARCHAR DEFAULT 'ACCION_SENSIBLE')
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

  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '60 seconds' THEN
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
