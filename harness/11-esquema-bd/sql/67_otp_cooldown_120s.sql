-- VisionHub -- 67_otp_cooldown_120s.sql
-- El owner probo el cooldown de 60s (66_) y el correo le llego justo cuando
-- se vencia -- no hay evidencia de un bug (la funcion espera a que
-- sendMail() termine antes de responder, asi que el cooldown ya arranca
-- despues de que el correo "salio"; el resto de la demora es entrega de
-- Brevo a Gmail, variable por reputacion de dominio nuevo). Sube a 120s de
-- colchon para que no se tiente a reenviar justo cuando el primero esta por
-- llegar -- no soluciona la demora de entrega en si, solo da mas margen.

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

  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '120 seconds' THEN
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
