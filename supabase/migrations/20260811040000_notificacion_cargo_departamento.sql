-- VisionHub -- KAN-16x: el aviso por correo de designacion (REQ-ASG-7/
-- KAN-117) cubria Red, Casa de Paz y Pastor/Supervisor, pero nunca
-- Departamento -- ni el modo "Buscar en base de datos" ni "Por correo
-- electronico" avisaban a un Lider de Afirmacion recien asignado. Mismo
-- patron exacto que fn_estructura_datos_notificacion_cargo_red/_cdp.
CREATE OR REPLACE FUNCTION public.fn_estructura_datos_notificacion_cargo_departamento(
  p_departamento_id uuid,
  p_persona_id uuid
)
RETURNS TABLE(persona_nombre text, correo text, departamento_nombre text, iglesia_nombre text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_iglesia_id uuid;
BEGIN
  SELECT d.iglesia_id INTO v_iglesia_id FROM public.departamento d WHERE d.id = p_departamento_id;
  IF v_iglesia_id IS NULL OR NOT private.fn_estructura_puede_administrar(v_iglesia_id) THEN
    RAISE EXCEPTION 'SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    public.fn_nombre_completo(p),
    coalesce(p.correo, u.email)::text,
    d.nombre::text,
    i.nombre::text
  FROM public.persona p
  JOIN public.departamento d ON d.id = p_departamento_id
  JOIN public.iglesia i ON i.id = d.iglesia_id
  LEFT JOIN auth.users u ON u.id = p.usuario_id
  WHERE p.id = p_persona_id AND p.fecha_eliminacion IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_estructura_datos_notificacion_cargo_departamento(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estructura_datos_notificacion_cargo_departamento(uuid, uuid) TO authenticated;
