-- VisionHub -- pedido explicito del owner (2026-08-21): en el formulario
-- interno de Afirmacion, elegir primero la Red y que los lideres de CdP se
-- filtren por esa Red, y mostrar la zona/direccion de cada lider como
-- segundo dato distintivo (mismo criterio de zona que ya usa fn_etiqueta_cdp
-- para desambiguar 2+ CdP del mismo lider).

-- Nueva: lista simple de Redes para el primer selector. Mismo patron de
-- permiso que el resto de las RPC de Afirmacion (no fn_puede_ver_red, que
-- exige ser Lider/Sublider DE esa red puntual -- un Lider de Afirmacion
-- puro, sin otro sombrero, no pasaria ese filtro fila por fila).
CREATE OR REPLACE FUNCTION public.fn_listar_redes_afirmacion(p_iglesia_id UUID)
RETURNS TABLE(id UUID, nombre VARCHAR)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT r.id, r.nombre
  FROM red r
  WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL
  ORDER BY r.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_listar_redes_afirmacion(UUID) TO authenticated;

-- fn_listar_lideres_cdp_afirmacion: agrega red_id (para filtrar en el
-- frontend) y zona (direccion del anfitrion de esa CdP, mismo subquery que
-- fn_etiqueta_cdp -- ayuda a distinguir cuando el lider tiene 2+ CdP o hay
-- nombres parecidos).
DROP FUNCTION IF EXISTS fn_listar_lideres_cdp_afirmacion(UUID);

CREATE FUNCTION fn_listar_lideres_cdp_afirmacion(p_iglesia_id UUID)
RETURNS TABLE(casa_de_paz_cargo_id UUID, persona_id UUID, lider_nombre TEXT, casa_de_paz_id UUID, cdp_etiqueta TEXT, red_id UUID, red_nombre VARCHAR, zona VARCHAR)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cc.id, cc.persona_id, fn_nombre_completo(p), cc.casa_de_paz_id, fn_etiqueta_cdp(cc.casa_de_paz_id),
    r.id, r.nombre,
    (SELECT d.zona FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
     WHERE da.casa_de_paz_id = cc.casa_de_paz_id AND da.activo AND da.fecha_eliminacion IS NULL LIMIT 1)
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN persona p ON p.id = cc.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cc.iglesia_id = p_iglesia_id
    AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL
  ORDER BY fn_nombre_completo(p);
END;
$function$;

GRANT EXECUTE ON FUNCTION fn_listar_lideres_cdp_afirmacion(UUID) TO authenticated;
