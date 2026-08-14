-- VisionHub -- KAN-16x: invitar-lider (modo "Por correo electronico" al
-- invitar Lider de Afirmacion) llamaba a fn_verificar_otp directo -- la
-- version generica que exige codigo siempre, sin mirar el switch de OTP
-- por iglesia (estructura_organigrama.otp_requerido). Red ya tenia su
-- propio wrapper (fn_estructura_validar_otp_red, respeta el switch); se
-- agrega el mismo patron para Departamento. Bug real reportado en vivo
-- (2026-08-10): con el switch apagado, invitar por correo a un Lider de
-- Afirmacion seguia rechazando con "codigo incorrecto, expiro, o no fue
-- solicitado" aunque nunca se pidio ningun codigo.
CREATE OR REPLACE FUNCTION public.fn_estructura_validar_otp_departamento(
  p_departamento_id uuid,
  p_codigo text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_iglesia_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.iglesia_id
  INTO v_iglesia_id
  FROM public.departamento d
  WHERE d.id = p_departamento_id
    AND d.fecha_eliminacion IS NULL;

  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'ESTRUCTURA_DEPARTAMENTO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;

  IF NOT private.fn_estructura_puede_administrar(v_iglesia_id) THEN
    RAISE EXCEPTION 'SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.fn_estructura_exigir_otp(v_iglesia_id, p_codigo);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_estructura_validar_otp_departamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_estructura_validar_otp_departamento(uuid, text) TO authenticated;
