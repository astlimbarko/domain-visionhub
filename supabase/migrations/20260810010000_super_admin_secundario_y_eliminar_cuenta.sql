-- VisionHub -- KAN-154: Super Admin Secundario + eliminar cuenta completa.
-- Pedido del owner (2026-08-10): 3 Super Admin ya no deben ser iguales --
-- Gonzalo (astlimbark@gmail.com) queda como "principal" y los otros 2 como
-- "secundarios": MISMAS capacidades operativas (fn_es_super_admin() sigue
-- devolviendo true para ambos, ningun gate existente cambia), pero solo el
-- principal puede crear/editar/reactivar/quitar una fila de rol SUPER_ADMIN
-- (de cualquiera de los 3). No se agrega un valor nuevo al enum
-- rol_sistema_enum a proposito -- mismo rol, solo se distingue el nivel con
-- una columna, evitando tocar los ~20 gates que ya usan fn_es_super_admin().

ALTER TABLE usuario_rol ADD COLUMN es_principal BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE usuario_rol ADD CONSTRAINT chk_es_principal_solo_super_admin
  CHECK (rol = 'SUPER_ADMIN' OR NOT es_principal);

CREATE OR REPLACE FUNCTION fn_es_super_admin_principal()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol = 'SUPER_ADMIN' AND es_principal AND fecha_eliminacion IS NULL
  );
$$;

-- Bootstrap: astlimbark@gmail.com es el Super Admin principal desde siempre
-- (owner del proyecto). trg_validar_rol exige fn_es_super_admin_principal()
-- para tocar una fila SUPER_ADMIN -- este backfill corre fuera de un
-- request autenticado (auth.uid() es NULL en la migracion), asi que hay que
-- destrabarlo puntualmente igual que ya se hizo antes en esta epica para
-- purgar datos de prueba.
ALTER TABLE usuario_rol DISABLE TRIGGER trg_validar_rol;

UPDATE usuario_rol ur
SET es_principal = true
FROM auth.users u
WHERE ur.usuario_id = u.id
  AND u.email = 'astlimbark@gmail.com'
  AND ur.rol = 'SUPER_ADMIN'
  AND ur.fecha_eliminacion IS NULL;

ALTER TABLE usuario_rol ENABLE TRIGGER trg_validar_rol;

-- Unico cambio de gate necesario: trg_validar_rol (fn_validar_asignacion_rol,
-- ultima version en 70_super_admin_asigna_supervisor.sql) ya corre en BEFORE
-- INSERT OR UPDATE sobre usuario_rol -- cubre crear, editar y reactivar/
-- suspender (fn_toggle_usuario_rol hace UPDATE fecha_eliminacion, con rol sin
-- cambiar, asi que tambien pasa por aca). Un solo cambio acá alcanza, sin
-- tocar fn_crear_usuario_rol/fn_actualizar_usuario_rol/fn_toggle_usuario_rol/
-- fn_asignar_rol_recien_invitado uno por uno.
CREATE OR REPLACE FUNCTION fn_validar_asignacion_rol()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin_principal() THEN
    RAISE EXCEPTION 'SUPER_ADMIN_SOLO_PRINCIPAL: solo el Super Admin principal puede crear, editar o quitar otro Super Admin'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT (fn_es_super_admin() OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Super Admin o Pastor de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_RED', 'LIDER_CDP') AND NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUBLIDER_CDP'
     AND NOT (fn_es_operativo_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id) OR fn_es_lider_cdp_en_iglesia(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor, Lider de Red o Lider de CdP en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
     AND EXISTS (SELECT 1 FROM usuario_rol WHERE usuario_id = NEW.usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'ROL_SUPER_ADMIN_NO_OPERATIVO: un Super Admin no puede tener roles operativos; se necesita una cuenta separada' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- fn_listar_usuarios ahora tambien devuelve es_principal, para que el panel
-- pueda distinguir cual Super Admin es el principal (RETURNS TABLE cambia de
-- forma -- hace falta DROP antes de recrear, CREATE OR REPLACE no alcanza).
DROP FUNCTION IF EXISTS fn_listar_usuarios(UUID);

CREATE FUNCTION fn_listar_usuarios(p_iglesia_id UUID DEFAULT NULL)
RETURNS TABLE (usuario_rol_id UUID, usuario_id UUID, correo VARCHAR, rol rol_sistema_enum, iglesia_id UUID, iglesia_nombre VARCHAR, persona_id UUID, persona_nombre TEXT, es_principal BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)))) THEN
    RAISE EXCEPTION 'ADMIN_FUERA_DE_ALCANCE: se requiere ser Super Admin o Pastor/Supervisor de la iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    ur.id, ur.usuario_id, u.email::VARCHAR, ur.rol,
    ur.iglesia_id, i.nombre, p.id, fn_nombre_completo(p), ur.es_principal
  FROM usuario_rol ur
  JOIN auth.users u ON u.id = ur.usuario_id
  LEFT JOIN iglesia i ON i.id = ur.iglesia_id
  LEFT JOIN persona p ON p.usuario_id = ur.usuario_id AND p.fecha_eliminacion IS NULL
  WHERE ur.fecha_eliminacion IS NULL
    AND ur.rol IN ('SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION')
    AND (p_iglesia_id IS NULL OR ur.iglesia_id = p_iglesia_id)
  ORDER BY u.email;
END;
$$;

-- Segunda parte del pedido (limpieza manual de cuentas de prueba, 2026-08-10):
-- "Remover" (fn_toggle_usuario_rol) ya existia pero solo da de baja UN cargo
-- puntual. Esta funcion nueva da de baja TODA la cuenta de una vez (todas
-- las filas de usuario_rol y de persona que le correspondan) en un solo
-- paso -- sigue el mismo patron de soft-delete que el resto de la app (no
-- se borra fisicamente, ver fn_bloquear_delete/trg_no_delete_*); no toca
-- auth.users (eliminar la cuenta de auth completa queda para una iteracion
-- futura si hace falta reusar el correo).
CREATE FUNCTION fn_eliminar_cuenta_usuario(p_usuario_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'USUARIO_SOLO_SUPER_ADMIN: solo un Super Admin puede eliminar cuentas'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOMODIFICACION: no podes eliminar tu propia cuenta'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM usuario_rol WHERE usuario_id = p_usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL
  ) THEN
    IF NOT fn_es_super_admin_principal() THEN
      RAISE EXCEPTION 'SUPER_ADMIN_SOLO_PRINCIPAL: solo el Super Admin principal puede eliminar a otro Super Admin'
        USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM usuario_rol WHERE rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) <= 1 THEN
      RAISE EXCEPTION 'ULTIMO_SUPER_ADMIN: no se puede eliminar al unico Super Admin del sistema'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  UPDATE usuario_rol SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE usuario_id = p_usuario_id AND fecha_eliminacion IS NULL;

  UPDATE persona SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE usuario_id = p_usuario_id AND fecha_eliminacion IS NULL;
END;
$$;
