-- KAN-497 paso 6: el buscador de Casa de Paz del formulario de membresía puede
-- buscar también por dirección y ciudad. fn_listar_cdp_asistencia no devuelve
-- direcciones, así que se agrega una función aparte (aditiva, no cambia la
-- existente). Devuelve SOLO la dirección principal de cada Casa de Paz; si no
-- tiene ninguna marcada como principal, toma la primera activa.
-- Mismo alcance que fn_listar_cdp_asistencia: la iglesia y sus satélites.

CREATE OR REPLACE FUNCTION public.fn_direccion_principal_cdp(p_iglesia_id uuid)
RETURNS TABLE(casa_de_paz_id uuid, direccion text, ciudad text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (da.casa_de_paz_id)
    da.casa_de_paz_id,
    NULLIF(btrim(concat_ws(' ', d.calle, d.numero)), '')::text,
    NULLIF(btrim(d.ciudad), '')::text
  FROM direccion_asignacion da
  JOIN direccion d ON d.id = da.direccion_id AND d.fecha_eliminacion IS NULL
  JOIN casa_de_paz cdp ON cdp.id = da.casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
  JOIN iglesia ig ON ig.id = cdp.iglesia_id
  WHERE da.activo
    AND da.fecha_eliminacion IS NULL
    AND da.casa_de_paz_id IS NOT NULL
    AND (cdp.iglesia_id = p_iglesia_id OR ig.iglesia_padre_id = p_iglesia_id)
  ORDER BY da.casa_de_paz_id, da.es_principal DESC, da.fecha_creacion;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_direccion_principal_cdp(uuid) TO authenticated;
