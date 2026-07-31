-- VisionHub -- 69_invitar_usuario_un_solo_pin.sql
-- Bug real reportado 2026-08-01 (probado en vivo por el owner): al invitar
-- un usuario nuevo por correo desde "Agregar usuario" (InvitarUsuarioDialog),
-- la Edge Function invitar-usuario ya consume el codigo OTP (fn_exigir_pin
-- dentro de esa funcion), pero el frontend despues llama a
-- fn_crear_usuario_rol con el MISMO codigo -- que ya esta usado_en, asi que
-- fn_verificar_otp no encuentra nada vigente y devuelve "PIN_INCORRECTO".
-- Mismo problema de fondo que el doble-codigo de Crear Iglesia (63_/65_),
-- ahora en el camino general de invitacion.
--
-- Fix: la Edge Function pasa a asignar el cargo ella misma, en la MISMA
-- request donde ya se verifico el codigo -- sin pedir un segundo. Esta
-- funcion no chequea PIN (ya se veriico segundos antes, en la misma
-- llamada); solo revalida el permiso, igual que fn_crear_usuario_rol.

CREATE OR REPLACE FUNCTION fn_asignar_rol_recien_invitado(p_usuario_id UUID, p_rol rol_sistema_enum, p_iglesia_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)))) THEN
    RAISE EXCEPTION 'USUARIO_ROL_SIN_PERMISO: no tenes permiso para invitar usuarios aqui' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuario_rol (usuario_id, rol, iglesia_id) VALUES (p_usuario_id, p_rol, p_iglesia_id);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_asignar_rol_recien_invitado(UUID, rol_sistema_enum, UUID) TO authenticated;
