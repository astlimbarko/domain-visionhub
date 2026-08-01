-- VisionHub -- 75_otp_baja_cargo_departamento_red.sql
-- Bug real encontrado 2026-08-01: el cargo de Lider de Afirmacion de un
-- usuario real (envioskian@gmail.com) quedo dado de baja sin querer por una
-- cuenta de prueba, con un solo click en el boton "quitar" (X) del dialogo
-- compartido AsignarCargoDialog -- ni asignar ni quitar en Departamentos
-- pedian OTP, y en Gestion de Redes (73_) solo "asignar/invitar" lo pedia,
-- "quitar" quedaba con el mismo hueco. Decision del owner: dar de baja
-- cualquier cargo debe pasar SIEMPRE por OTP.
--
-- Alcance de esta migracion: solo lo que es responsabilidad de Gonzalo
-- (Departamentos, Gestion de Redes). Casas de Paz / autogestion de Lider de
-- Red (GestionEstructuraVista.tsx, GestionRedVista.tsx,
-- GestionSubliderVista.tsx, todas de Matias) quedan afuera a proposito --
-- mismo hallazgo, pendiente de que Matias lo aplique en su codigo.

-- ============================================================
-- Departamentos: departamento_cargo es de uso exclusivo de este modulo (sin
-- otro consumidor), asi que se puede cerrar del todo -- se sacan los
-- permisos de escritura directa via RLS y de ahora en mas solo se escribe
-- por estas 2 funciones (mas fn_completar_membresia, que ya escribe como
-- SECURITY DEFINER y no se ve afectada por el cambio de RLS).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_asignar_cargo_departamento(
  p_iglesia_id UUID, p_departamento_id UUID, p_persona_id UUID, p_cargo_id UUID, p_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para asignar un Lider de Departamento'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE departamento_cargo SET fecha_fin = CURRENT_DATE
  WHERE departamento_id = p_departamento_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
  VALUES (p_iglesia_id, p_departamento_id, p_persona_id, p_cargo_id, CURRENT_DATE);
END;
$$;

CREATE OR REPLACE FUNCTION fn_quitar_cargo_departamento(p_cargo_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM departamento_cargo
  WHERE id = p_cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_INEXISTENTE: la asignacion no existe o ya no esta vigente' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_operativo_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'DEPARTAMENTO_SOLO_OPERATIVO: se requiere ser Pastor o Supervisor de la iglesia para quitar un Lider de Departamento'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE departamento_cargo SET fecha_fin = CURRENT_DATE WHERE id = p_cargo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_asignar_cargo_departamento(UUID, UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_quitar_cargo_departamento(UUID, TEXT) TO authenticated;

-- Ya no se escribe departamento_cargo directo desde el cliente (solo lectura
-- via RLS). fn_completar_membresia sigue funcionando igual: corre como
-- SECURITY DEFINER, no pasa por estas politicas.
DROP POLICY IF EXISTS pol_departamento_cargo_insert ON departamento_cargo;
DROP POLICY IF EXISTS pol_departamento_cargo_update ON departamento_cargo;

-- ============================================================
-- Invitar Lider de Departamento por correo (invitar-lider Edge Function):
-- ya exige OTP para LIDER_RED (73_), ahora tambien para departamento_id.
-- No toca las ramas LIDER_CDP/SUBLIDER_CDP (de Matias).
-- ============================================================
-- (el cambio de codigo va en supabase/functions/invitar-lider/index.ts,
-- no hay nada que migrar en la base para esto)

-- ============================================================
-- Gestion de Redes (Supervisor): red_cargo es TABLA COMPARTIDA con las
-- pantallas de autogestion de Lider de Red de Matias (GestionEstructuraVista
-- .tsx, GestionRedVista.tsx) -- no se toca su RLS ni su servicio
-- (quitarCargoRed) para no romper ese flujo, que sigue sin pin (pendiente de
-- que Matias lo cierre ahi). Se agrega una funcion nueva, dedicada, solo
-- para el boton "quitar" del panel Gestion de Redes del Supervisor.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_quitar_lider_red_supervisor(p_cargo_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red_cargo
  WHERE id = p_cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_CARGO_INEXISTENTE: la asignacion no existe o ya no esta vigente' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_supervisor_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'RED_SOLO_SUPERVISOR: solo el Supervisor de la Vision en Accion puede quitar Lider de Red desde aqui'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE red_cargo SET fecha_fin = CURRENT_DATE WHERE id = p_cargo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_quitar_lider_red_supervisor(UUID, TEXT) TO authenticated;
