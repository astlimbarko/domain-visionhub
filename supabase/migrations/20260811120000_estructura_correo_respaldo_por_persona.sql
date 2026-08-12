-- VisionHub -- bug real reportado en vivo 2026-08-11: al designar Lider/
-- Supervisor de Red (o de Departamento/CdP) a una cuenta que todavia no
-- completo su ficha de Membresia (KAN-179, nombre vacio) Y cuya Persona
-- tampoco tiene `correo` propio cargado (columna aparte de auth.users.email,
-- suele quedar vacia para altas directas), el Constructor mostraba
-- "Persona sin identificar" -- sin ninguna pista de quien es. El correo
-- real vive en auth.users, no expuesto directo al cliente.
--
-- Mismo patron ya usado en fn_estructura_datos_notificacion_cargo_red
-- (coalesce(p.correo, u.email)), pero en bulk para toda la iglesia de una
-- sola vez (Promise.all de obtenerEstructuraOrganizacional), no persona por
-- persona. El permiso replica el mismo criterio ya usado para ver el
-- lienzo completo: Super Admin, Pastor/Supervisor de la iglesia, o Lider/
-- Supervisor de alguna Red de esa iglesia (quien ya ve el lienzo entero,
-- no solo su propia Red).
CREATE OR REPLACE FUNCTION public.fn_estructura_correos_respaldo(p_iglesia_id UUID)
RETURNS TABLE (persona_id UUID, correo TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (
    public.fn_es_super_admin()
    OR public.fn_es_operativo_en(p_iglesia_id)
    OR public.fn_es_pastor_en(p_iglesia_id)
    OR EXISTS (
      SELECT 1 FROM public.red_cargo rc
      JOIN public.cargo c ON c.id = rc.cargo_id
      WHERE rc.iglesia_id = p_iglesia_id
        AND rc.persona_id = public.fn_mi_persona_id()
        AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED')
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'SIN_PERMISO: no tenes acceso al Constructor de esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, u.email::TEXT
  FROM public.persona p
  JOIN auth.users u ON u.id = p.usuario_id
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND p.correo IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_estructura_correos_respaldo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_estructura_correos_respaldo(UUID) TO authenticated;
