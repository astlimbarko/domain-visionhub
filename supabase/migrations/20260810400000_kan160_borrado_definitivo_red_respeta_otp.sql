-- VisionHub -- KAN-160: el borrado definitivo de Red exigia OTP siempre
-- (fn_verificar_otp directo), a diferencia de reactivar/eliminar Red (soft)
-- y del borrado definitivo de Casa de Paz, que ya respetan
-- estructura_organigrama.otp_requerido via private.fn_estructura_exigir_otp.
-- El resto de la funcion (60s de ventana para deshacer, permiso de Super
-- Admin) queda igual.
CREATE OR REPLACE FUNCTION public.fn_estructura_programar_borrado_red(
  p_red_id uuid,
  p_otp text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_red_id uuid;
  v_iglesia_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.fn_es_super_admin() THEN
    RAISE EXCEPTION 'SOLO_SUPER_ADMIN: solo Super Admin puede eliminar una Red de la base de datos'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT r.id, r.iglesia_id INTO v_red_id, v_iglesia_id
  FROM public.red r
  WHERE r.id = p_red_id
    AND r.fecha_eliminacion IS NOT NULL
    AND r.fecha_borrado_definitivo_programado IS NULL;

  IF v_red_id IS NULL THEN
    RAISE EXCEPTION 'ESTRUCTURA_RED_NO_ENCONTRADA: la Red no existe, no esta eliminada, o ya tiene un borrado programado'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  UPDATE public.red
  SET fecha_borrado_definitivo_programado = now()
  WHERE id = v_red_id;
END;
$$;
