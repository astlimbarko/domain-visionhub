-- VisionHub -- 59_gestion_admin_super.sql
-- 15-gestion-administrativa, Panel 2. Completa "Gestionar" para el Super
-- Admin: editar/suspender/reactivar/eliminar iglesias, y editar/suspender/
-- reactivar/remover cargos de usuario (Pastor, Supervisor, Super Admin).
-- Todo sensible via fn_exigir_pin (ya es OTP desde 58_otp_verificacion.sql).

-- ============================================================
-- Iglesias
-- ============================================================

CREATE OR REPLACE FUNCTION fn_actualizar_iglesia(
  p_iglesia_id UUID, p_sufijo VARCHAR, p_ciudad VARCHAR, p_correo VARCHAR DEFAULT NULL, p_pin TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede modificar iglesias'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET sufijo = p_sufijo, ciudad = p_ciudad, correo = p_correo
  WHERE id = p_iglesia_id AND fecha_eliminacion IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IGLESIA_NO_ENCONTRADA: la iglesia % no existe o fue eliminada', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_toggle_iglesia_activa(p_iglesia_id UUID, p_activa BOOLEAN, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede suspender o reactivar iglesias'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET activo = p_activa WHERE id = p_iglesia_id AND fecha_eliminacion IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IGLESIA_NO_ENCONTRADA: la iglesia % no existe o fue eliminada', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Mismo criterio que fn_validar_red_desactivacion (08_estructura.sql): no se
-- elimina una iglesia con estructura vigente colgando -- primero hay que
-- reasignar/desactivar redes e iglesias hijas.
CREATE OR REPLACE FUNCTION fn_eliminar_iglesia(p_iglesia_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede eliminar iglesias'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  IF EXISTS (SELECT 1 FROM red WHERE iglesia_id = p_iglesia_id AND activo AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'IGLESIA_CON_REDES_ACTIVAS: la iglesia tiene redes vigentes; desactivelas antes de eliminar'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM iglesia WHERE iglesia_padre_id = p_iglesia_id AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'IGLESIA_CON_HIJAS: la iglesia tiene iglesias hijas vigentes; reasignelas antes de eliminar'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE iglesia SET fecha_eliminacion = now(), eliminado_por = auth.uid(), activo = false
  WHERE id = p_iglesia_id AND fecha_eliminacion IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IGLESIA_NO_ENCONTRADA: la iglesia % no existe o ya fue eliminada', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ============================================================
-- Cargos de usuario (usuario_rol) -- Pastor, Supervisor, Super Admin
-- ============================================================

-- trg_validar_rol (fn_validar_asignacion_rol, 40_acotar_super_admin.sql) ya
-- corre en BEFORE INSERT **OR UPDATE** -- revalida jerarquia, iglesia y la
-- regla "Super Admin no lleva rol operativo" en este UPDATE exactamente
-- igual que en un alta nueva. No se duplica esa logica aca.
CREATE OR REPLACE FUNCTION fn_actualizar_usuario_rol(
  p_usuario_rol_id UUID, p_rol rol_sistema_enum, p_iglesia_id UUID, p_pin TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_usuario_objetivo UUID;
  v_rol_objetivo rol_sistema_enum;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'USUARIO_SOLO_SUPER_ADMIN: solo un Super Admin puede modificar cargos'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT usuario_id, rol INTO v_usuario_objetivo, v_rol_objetivo FROM usuario_rol
  WHERE id = p_usuario_rol_id AND fecha_eliminacion IS NULL;

  IF v_usuario_objetivo IS NULL THEN
    RAISE EXCEPTION 'USUARIO_ROL_NO_ENCONTRADO: la asignacion % no existe o fue eliminada', p_usuario_rol_id
      USING ERRCODE = 'P0001';
  END IF;
  IF v_usuario_objetivo = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOMODIFICACION: no podes modificar tu propio cargo'
      USING ERRCODE = 'P0001';
  END IF;
  -- El Super Admin es un rol tecnico acotado a Iglesia/Pastor/Supervisor
  -- (decision del owner, 2026-07-19). Lider de Red/CdP/Sublider se gestionan
  -- desde Casas de Paz, nunca desde Administracion -- mismo limite que ya
  -- aplica al invitar (InvitarUsuarioDialog).
  IF v_rol_objetivo IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP') THEN
    RAISE EXCEPTION 'USUARIO_FUERA_DE_ALCANCE: los cargos de Red y Casa de Paz se gestionan desde Casas de Paz, no desde Administracion'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  UPDATE usuario_rol SET rol = p_rol, iglesia_id = p_iglesia_id WHERE id = p_usuario_rol_id;
END;
$$;

-- Suspender/reactivar/remover son la misma operacion de base (togglear
-- fecha_eliminacion) -- el framing "suspension temporal" vs "remocion" queda
-- en la UI, no en el backend. Bloquea auto-modificacion y dejar el sistema
-- sin ningun Super Admin activo.
CREATE OR REPLACE FUNCTION fn_toggle_usuario_rol(p_usuario_rol_id UUID, p_activo BOOLEAN, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_usuario_objetivo UUID;
  v_rol_objetivo rol_sistema_enum;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'USUARIO_SOLO_SUPER_ADMIN: solo un Super Admin puede suspender, reactivar o remover cargos'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT usuario_id, rol INTO v_usuario_objetivo, v_rol_objetivo
  FROM usuario_rol WHERE id = p_usuario_rol_id;

  IF v_usuario_objetivo IS NULL THEN
    RAISE EXCEPTION 'USUARIO_ROL_NO_ENCONTRADO: la asignacion % no existe', p_usuario_rol_id
      USING ERRCODE = 'P0001';
  END IF;
  IF v_usuario_objetivo = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOMODIFICACION: no podes suspender ni remover tu propio cargo'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_rol_objetivo = 'SUPER_ADMIN' AND NOT p_activo THEN
    IF (SELECT count(*) FROM usuario_rol WHERE rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) <= 1 THEN
      RAISE EXCEPTION 'ULTIMO_SUPER_ADMIN: no se puede suspender ni remover al unico Super Admin del sistema'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- Mismo limite que fn_actualizar_usuario_rol: Red/CdP se gestionan desde
  -- Casas de Paz, no desde Administracion.
  IF v_rol_objetivo IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP') THEN
    RAISE EXCEPTION 'USUARIO_FUERA_DE_ALCANCE: los cargos de Red y Casa de Paz se gestionan desde Casas de Paz, no desde Administracion'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  UPDATE usuario_rol
  SET fecha_eliminacion = CASE WHEN p_activo THEN NULL ELSE now() END,
      eliminado_por = CASE WHEN p_activo THEN NULL ELSE auth.uid() END
  WHERE id = p_usuario_rol_id;
END;
$$;
