-- VisionHub -- otra regresion real del mismo patron que
-- 20260810020000_fix_regresion_super_admin_operativo.sql: la migracion de
-- KAN-154 (20260810010000) recreo fn_listar_usuarios (DROP + CREATE, para
-- sumar la columna es_principal) tomando como base el mirror de harness
-- (63_pastor_gestion_supervisor.sql), que no incluia el fix real del
-- 2026-08-09 (20260809060000_fix_listar_usuarios_persona_iglesia.sql): el
-- JOIN con persona filtraba solo por usuario_id, sin acotar por iglesia_id
-- -- una persona con ficha en mas de una iglesia (ej. Daniel: Pastor en El
-- Eden + Supervisor en Montero, sin ficha ahi todavia) recibia el
-- persona_id de la iglesia EQUIVOCADA al listar usuarios de otra iglesia.
-- Encontrado por auditoria cruzada (verificando cada funcion sensible
-- tocada en las ultimas 48h contra la ultima migracion incremental real,
-- no contra harness), no reportado en vivo todavia. Se restaura el JOIN
-- acotado por iglesia_id, manteniendo es_principal de KAN-154.
CREATE OR REPLACE FUNCTION public.fn_listar_usuarios(p_iglesia_id UUID DEFAULT NULL)
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
  LEFT JOIN persona p ON p.usuario_id = ur.usuario_id AND p.iglesia_id = ur.iglesia_id AND p.fecha_eliminacion IS NULL
  WHERE ur.fecha_eliminacion IS NULL
    AND ur.rol IN ('SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION')
    AND (p_iglesia_id IS NULL OR ur.iglesia_id = p_iglesia_id)
  ORDER BY u.email;
END;
$$;
