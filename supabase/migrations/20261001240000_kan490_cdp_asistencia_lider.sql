-- KAN-490 (harness/23 A): fn_listar_cdp_asistencia suma el nombre del LÍDER
-- vigente de cada Casa de Paz, para que el buscador del selector de CdP pueda
-- filtrar por líder (además de por nombre de CdP y Red; los satélites ya venían).
-- Solo agrega la columna lider_nombre respecto de 20261001180000.
-- DROP primero: cambiar el tipo de retorno (nueva columna) no permite CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.fn_listar_cdp_asistencia(uuid);

CREATE OR REPLACE FUNCTION public.fn_listar_cdp_asistencia(p_iglesia_id uuid)
 RETURNS TABLE(casa_de_paz_id uuid, casa_de_paz_etiqueta text, red_id uuid,
               red_nombre text, iglesia_id uuid, iglesia_nombre text,
               es_satelite boolean, lider_nombre text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    r.id,
    r.nombre::text,
    ig.id,
    ig.nombre::text,
    (ig.id <> p_iglesia_id),
    (SELECT fn_nombre_completo(pl)
     FROM casa_de_paz_cargo cc
     JOIN cargo c ON c.id = cc.cargo_id
     JOIN persona pl ON pl.id = cc.persona_id
     WHERE cc.casa_de_paz_id = cdp.id AND c.codigo = 'LIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
     LIMIT 1)::text
  FROM casa_de_paz cdp
  JOIN iglesia ig ON ig.id = cdp.iglesia_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE (cdp.iglesia_id = p_iglesia_id OR ig.iglesia_padre_id = p_iglesia_id)
    AND cdp.activo
    AND cdp.fecha_eliminacion IS NULL
    AND ig.fecha_eliminacion IS NULL
  ORDER BY (ig.id = p_iglesia_id) DESC, ig.nombre, r.nombre NULLS LAST, fn_etiqueta_cdp(cdp.id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_listar_cdp_asistencia(uuid) TO authenticated;
