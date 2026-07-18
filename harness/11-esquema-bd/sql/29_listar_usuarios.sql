-- VisionHub -- 29_listar_usuarios.sql
-- Para la pantalla de Administracion (Super Admin, o Pastor/Supervisor
-- dentro de su propia iglesia): lista los usuario_rol con el correo (que
-- vive en auth.users, fuera del alcance de PostgREST) y, si existe, la
-- Persona ya asociada.

CREATE OR REPLACE FUNCTION fn_listar_usuarios(p_iglesia_id UUID DEFAULT NULL)
RETURNS TABLE (
  usuario_rol_id UUID, usuario_id UUID, correo VARCHAR, rol rol_sistema_enum,
  iglesia_id UUID, iglesia_nombre VARCHAR, persona_id UUID, persona_nombre TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND fn_es_operativo_en(p_iglesia_id))) THEN
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
    AND (p_iglesia_id IS NULL OR ur.iglesia_id = p_iglesia_id)
  ORDER BY u.email;
END;
$$;
