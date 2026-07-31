-- VisionHub -- 73_gestion_redes_supervisor.sql
-- Pedido del owner (2026-08-01): nuevo menu dedicado "Gestion de Redes"
-- para el Supervisor de la Vision en Accion -- crear/desactivar Redes y
-- designar Lider de Red, todo con confirmacion OTP ("esto es delicado").
-- Antes esto se hacia sin ningun PIN, mezclado en la pantalla de Casas de
-- Paz (GestionEstructuraVista.tsx) -- se saca de ahi (frontend) y estas
-- funciones nuevas son las unicas que lo permiten desde ahora, siempre con
-- OTP. fn_asignar_lider_red_supervisor delega en fn_asignar_cargo_red
-- (58_solicitudes_estructura.sql, de Matias) para no duplicar el flujo de
-- aprobacion del Lider de Red vigente -- solo agrega la verificacion de OTP
-- antes.

CREATE OR REPLACE FUNCTION fn_crear_red_supervisor(
  p_iglesia_id UUID, p_nombre VARCHAR, p_lider_persona_id UUID DEFAULT NULL, p_pin TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_red_id UUID;
  v_cargo_id UUID;
BEGIN
  IF NOT fn_es_supervisor_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'RED_SOLO_SUPERVISOR: solo el Supervisor de la Vision en Accion puede crear redes desde aqui'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'RED_NOMBRE_OBLIGATORIO: la red necesita un nombre' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO red (iglesia_id, nombre) VALUES (p_iglesia_id, btrim(p_nombre)) RETURNING id INTO v_red_id;

  IF p_lider_persona_id IS NOT NULL THEN
    SELECT id INTO v_cargo_id FROM cargo WHERE codigo = 'LIDER_RED' AND activo LIMIT 1;
    INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    VALUES (p_iglesia_id, v_red_id, p_lider_persona_id, v_cargo_id, CURRENT_DATE);
  END IF;

  RETURN v_red_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_desactivar_red_supervisor(p_red_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_INEXISTENTE: la red no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_supervisor_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'RED_SOLO_SUPERVISOR: solo el Supervisor de la Vision en Accion puede desactivar redes desde aqui'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE red SET activo = false WHERE id = p_red_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_asignar_lider_red_supervisor(p_red_id UUID, p_persona_id UUID, p_pin TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_cargo_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_INEXISTENTE: la red no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_supervisor_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'RED_SOLO_SUPERVISOR: solo el Supervisor de la Vision en Accion puede designar Lider de Red desde aqui'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_cargo_id FROM cargo WHERE codigo = 'LIDER_RED' AND activo LIMIT 1;
  RETURN fn_asignar_cargo_red(p_red_id, p_persona_id, 'LIDER_RED', v_cargo_id);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_crear_red_supervisor(UUID, VARCHAR, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_desactivar_red_supervisor(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_asignar_lider_red_supervisor(UUID, UUID, TEXT) TO authenticated;
