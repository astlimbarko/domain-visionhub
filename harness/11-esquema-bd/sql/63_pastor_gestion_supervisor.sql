-- VisionHub -- 63_pastor_gestion_supervisor.sql
-- 15-gestion-administrativa, Panel 4 (minimo funcional, 2026-07-31): el
-- Pastor gestiona a su Supervisor de la Vision en Accion (REQ-PA-1). Hoy
-- fn_puede_invitar/fn_crear_usuario_rol/fn_listar_usuarios solo dejan pasar
-- a fn_es_operativo_en (Supervisor), porque el Pastor dejo de ser operativo
-- en 43_pastor_no_operativo.sql -- eso bloqueaba al Pastor incluso para lo
-- que SI le corresponde (asignar a su propio Supervisor). Se agrega
-- fn_es_pastor_en(p_iglesia_id) a las tres. Seguro: trg_validar_rol
-- (fn_validar_asignacion_rol, 40_) ya restringe con precision fina que un
-- Pastor SOLO puede terminar asignando el rol SUPERVISOR_VISION_ACCION (no
-- Lider de Red/CdP, no Pastor, no Super Admin) -- este cambio solo abre la
-- puerta de entrada, la regla fina no se toca.

CREATE OR REPLACE FUNCTION fn_puede_invitar(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)));
$$;

CREATE OR REPLACE FUNCTION fn_crear_usuario_rol(p_usuario_id UUID, p_rol rol_sistema_enum, p_iglesia_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)))) THEN
    RAISE EXCEPTION 'USUARIO_ROL_SIN_PERMISO: no tenes permiso para invitar usuarios aqui' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO usuario_rol (usuario_id, rol, iglesia_id) VALUES (p_usuario_id, p_rol, p_iglesia_id);
END;
$$;

-- Ademas de habilitar al Pastor, acota el listado a los 3 cargos
-- administrativos (Super Admin/Pastor/Supervisor) -- Lider de Red/CdP/
-- Sublider no deben aparecer aca, se gestionan desde Casas de Paz (mismo
-- limite ya aplicado en fn_actualizar_usuario_rol/fn_toggle_usuario_rol,
-- 59_gestion_admin_super.sql). RETURNS TABLE identico: CREATE OR REPLACE
-- alcanza, no hace falta DROP.
CREATE OR REPLACE FUNCTION fn_listar_usuarios(p_iglesia_id UUID DEFAULT NULL)
RETURNS TABLE (usuario_rol_id UUID, usuario_id UUID, correo VARCHAR, rol rol_sistema_enum, iglesia_id UUID, iglesia_nombre VARCHAR, persona_id UUID, persona_nombre TEXT)
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
    ur.iglesia_id, i.nombre, p.id, fn_nombre_completo(p)
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
