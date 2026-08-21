-- VisionHub -- baja el cooldown entre solicitudes de OTP de 120s a 60s.
-- Pedido explicito del owner (2026-08-21): 120s se sentia demasiado
-- restrictivo -- 60s es el estandar de la mayoria de apps (Google,
-- WhatsApp, etc.), suficiente para frenar un doble-click/loop accidental
-- sin estorbar un reintento legitimo.

CREATE OR REPLACE FUNCTION public.fn_generar_otp(p_proposito character varying DEFAULT 'ACCION_SENSIBLE'::character varying)
 RETURNS TABLE(id uuid, codigo text, expira_en timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_ultimo  TIMESTAMPTZ;
  v_codigo  TEXT;
  v_expira  TIMESTAMPTZ;
  v_id      UUID;
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
  VALUES (auth.uid(), crypt(v_codigo, gen_salt('bf')), p_proposito, v_expira)
  RETURNING usuario_otp.id INTO v_id;

  RETURN QUERY SELECT v_id, v_codigo, v_expira;
END;
$function$;
