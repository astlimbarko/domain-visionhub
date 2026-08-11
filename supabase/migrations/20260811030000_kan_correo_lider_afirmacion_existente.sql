-- VisionHub -- KAN-16x: invitar por correo a un Lider de Afirmacion cuyo
-- correo YA tiene cuenta (con Persona vinculada) dejaba al Super Admin en
-- un callejon sin salida -- el backend ya devolvia personaId/personaNombre
-- para que el frontend ofreciera "asignarla de todas formas"
-- (fn_persona_por_correo_cuenta, pedido del owner 2026-08-06), pero esa
-- parte del frontend nunca se construyo. Mismo patron ya aplicado hoy en
-- invitar-usuario/crear-iglesia (KAN-156): asignar directo en el mismo
-- paso en vez de solo avisar.
--
-- OJO con el OTP: el codigo es de un solo uso (fn_verificar_otp lo marca
-- "usado" al validarlo) -- invitar-lider ya lo valida UNA vez antes de
-- intentar el alta (fn_estructura_validar_otp_departamento). Esta funcion
-- NO vuelve a pedirlo (mismo patron que fn_asignar_rol_recien_invitado
-- para Pastor/Supervisor), para no consumir un segundo codigo que ya no
-- existe.
CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_departamento_directo(
  p_iglesia_id uuid,
  p_departamento_id uuid,
  p_persona_id uuid,
  p_cargo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.fn_es_super_admin() OR public.fn_es_operativo_en(p_iglesia_id) OR public.fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para asignar un Lider de Departamento'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.departamento_cargo SET fecha_fin = current_date
  WHERE departamento_id = p_departamento_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO public.departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
  VALUES (p_iglesia_id, p_departamento_id, p_persona_id, p_cargo_id, current_date);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_asignar_cargo_departamento_directo(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_asignar_cargo_departamento_directo(uuid, uuid, uuid, uuid) TO authenticated;
