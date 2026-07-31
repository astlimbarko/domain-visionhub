-- VisionHub -- 64_buscar_cuentas.sql
-- fn_listar_usuarios (63_) quedo acotada a los 3 cargos administrativos --
-- correcto para la LISTA de "quien ya tiene un cargo aca", pero eso rompio
-- la Opcion 1 del alta de doble via (REQ-C-1): buscar una cuenta que ya
-- existe (ej. un Lider de Red) para darle un cargo administrativo nuevo ya
-- no encontraba a nadie, porque esas cuentas no aparecen en fn_listar_usuarios.
-- Se separa en una funcion de busqueda aparte, sin el filtro de rol -- solo
-- gente que ya tiene AL MENOS un cargo (no cualquier auth.users, para no
-- exponer cuentas sin ningun vinculo al sistema).

CREATE OR REPLACE FUNCTION fn_buscar_cuentas(p_busqueda TEXT)
RETURNS TABLE (usuario_id UUID, correo VARCHAR)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- usuario_id sin calificar es ambiguo aca: coincide con el nombre del
  -- parametro de salida (RETURNS TABLE) ademas de la columna de la tabla.
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
  JOIN usuario_rol ur ON ur.usuario_id = u.id AND ur.fecha_eliminacion IS NULL
  WHERE u.email ILIKE '%' || p_busqueda || '%'
  ORDER BY u.email::VARCHAR
  LIMIT 10;
END;
$$;
