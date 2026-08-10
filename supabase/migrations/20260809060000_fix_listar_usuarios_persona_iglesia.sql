-- VisionHub -- fix_listar_usuarios_persona_iglesia
-- Bug real (reportado 2026-08-09, causa de fondo de "Quitar cargo" no
-- hacia nada): fn_listar_usuarios unia la Persona solo por usuario_id,
-- sin filtrar por iglesia_id -- si una persona tiene fichas en mas de una
-- iglesia (ej. Daniel Martinez: Pastor con ficha en Centro de Vida El
-- Eden, y ademas Supervisor de la Vision en Accion en Centro de Vida
-- Montero, sin ficha ahi todavia), al listar los usuarios de Montero le
-- devolvia por error el persona_id de El Eden.
--
-- Eso rompia "Quitar cargo": fn_estructura_quitar_supervisor buscaba esa
-- persona DENTRO de Montero (`where p.id = p_persona_id and p.iglesia_id
-- = p_iglesia_id`), no la encontraba (la ficha es de otra iglesia), y el
-- UPDATE posterior no afectaba ninguna fila -- sin lanzar excepcion. El
-- fallback agregado en 20260809040000 (aceptar un usuario_id cuando no hay
-- persona) tampoco alcanzaba a cubrir este caso, porque lo que llegaba no
-- era un usuario_id sino un persona_id real, solo que de la iglesia
-- equivocada.
CREATE OR REPLACE FUNCTION public.fn_listar_usuarios(p_iglesia_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(usuario_rol_id uuid, usuario_id uuid, correo character varying, rol rol_sistema_enum, iglesia_id uuid, iglesia_nombre character varying, persona_id uuid, persona_nombre text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  LEFT JOIN persona p ON p.usuario_id = ur.usuario_id AND p.iglesia_id = ur.iglesia_id AND p.fecha_eliminacion IS NULL
  WHERE ur.fecha_eliminacion IS NULL
    AND ur.rol IN ('SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION')
    AND (p_iglesia_id IS NULL OR ur.iglesia_id = p_iglesia_id)
  ORDER BY u.email;
END;
$function$;
