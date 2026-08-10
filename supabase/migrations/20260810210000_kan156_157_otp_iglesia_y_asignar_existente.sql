-- VisionHub -- KAN-157: exponer el switch de OTP por iglesia (ya existia
-- private.fn_estructura_exigir_otp, usada por fn_estructura_asignar_pastor/
-- supervisor) a los Edge Functions, que solo pueden llamar RPCs del schema
-- public via PostgREST. Wrapper fino, sin duplicar la logica.
CREATE OR REPLACE FUNCTION public.fn_exigir_pin_iglesia(p_iglesia_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM private.fn_estructura_exigir_otp(p_iglesia_id, p_pin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_exigir_pin_iglesia(UUID, TEXT) TO authenticated;
