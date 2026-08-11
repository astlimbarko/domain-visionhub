-- VisionHub -- fn_buscar_cuentas exigia un INNER JOIN contra usuario_rol con
-- fecha_eliminacion IS NULL, es decir: solo encontraba cuentas que YA tenian
-- al menos un cargo activo. Eso es lo opuesto de para que sirve esta funcion
-- (buscar una cuenta existente para asignarle un cargo -- REQ-C-1, "busca
-- entre TODAS las cuentas que ya existen, cualquier rol", segun el propio
-- comentario del frontend en admin.types.ts). Bug real encontrado en vivo
-- 2026-08-10: al sacarle a test@somoscdv.com su unico rol (Super Admin),
-- dejo de poder encontrarse para asignarle Pastor -- exactamente el caso de
-- "cuenta sin cargo todavia" que mas necesita aparecer en esta busqueda.
CREATE OR REPLACE FUNCTION public.fn_buscar_cuentas(p_busqueda text)
RETURNS TABLE(usuario_id uuid, correo character varying)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    fn_es_super_admin()
    OR EXISTS (
      SELECT 1 FROM usuario_rol ur2
      WHERE ur2.usuario_id = auth.uid() AND ur2.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION') AND ur2.fecha_eliminacion IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'BUSQUEDA_SIN_PERMISO: no tenes permiso para buscar cuentas' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT DISTINCT u.id, u.email::VARCHAR
  FROM auth.users u
  WHERE u.email ILIKE '%' || p_busqueda || '%'
  ORDER BY u.email::VARCHAR
  LIMIT 10;
END;
$function$;
