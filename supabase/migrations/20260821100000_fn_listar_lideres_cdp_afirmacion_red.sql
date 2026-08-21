-- VisionHub -- pedido explicito del owner: el formulario interno de
-- Afirmacion (RegistrarPersonaAfirmacion.tsx) no mostraba la Red al lado
-- del selector de Lider de Casa de Paz -- el formulario publico por URL SI
-- la muestra (fn_resolver_url_registro ya la resuelve), asi que quedaba
-- inconsistente. Se agrega red_nombre al mismo patron de join que ya usa
-- fn_listar_casas_de_paz_afirmacion (casa_de_paz_red).
--
-- RETURNS TABLE cambia de forma -> DROP + CREATE.
DROP FUNCTION IF EXISTS fn_listar_lideres_cdp_afirmacion(UUID);

CREATE FUNCTION fn_listar_lideres_cdp_afirmacion(p_iglesia_id UUID)
RETURNS TABLE(casa_de_paz_cargo_id UUID, persona_id UUID, lider_nombre TEXT, casa_de_paz_id UUID, cdp_etiqueta TEXT, red_nombre VARCHAR)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT cc.id, cc.persona_id, fn_nombre_completo(p), cc.casa_de_paz_id, fn_etiqueta_cdp(cc.casa_de_paz_id), r.nombre
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
