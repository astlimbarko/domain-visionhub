-- VisionHub -- pedido explicito del owner (2026-09-06): en la linea de
-- tiempo "Tendencia" (KAN-285), "Evangelizados" y "Semilla" no son lo mismo
-- -- Semilla es un conteo agregado sin nombres reales (mismo criterio que
-- fn_buscar_evangelizados, KAN-335), asi que deben verse como 2 series
-- separadas, no sumadas en una sola linea. Para poder separarlas en el
-- cliente, fn_evangelismo_red (que alimenta la Tendencia) necesita el
-- `codigo` del tipo de evangelismo, no solo nombre/color -- se agrega al
-- final de RETURNS TABLE (aditivo, no rompe a quien ya la usa por nombre
-- de columna via PostgREST).

DROP FUNCTION IF EXISTS public.fn_evangelismo_red(uuid, date, date);

CREATE OR REPLACE FUNCTION public.fn_evangelismo_red(p_red_id uuid, p_desde date, p_hasta date)
RETURNS TABLE(id uuid, casa_de_paz_id uuid, casa_de_paz_etiqueta text, persona_id uuid, nombre_completo text, fecha date, domicilio text, tipo_evangelismo_nombre character varying, tipo_evangelismo_color character, tipo_evangelismo_codigo character varying)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id uuid;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR fn_es_lider_evangelismo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT ev.id, ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id), ev.persona_id, fn_nombre_completo(p),
         ev.fecha, ev.domicilio, te.nombre, te.color, te.codigo
  FROM evangelismo ev
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = ev.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  JOIN casa_de_paz c ON c.id = ev.casa_de_paz_id AND c.activo AND c.fecha_eliminacion IS NULL
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  WHERE cdr.red_id = p_red_id
    AND ev.fecha_eliminacion IS NULL
    AND ev.fecha BETWEEN p_desde AND p_hasta
  ORDER BY ev.fecha DESC;
END;
$function$;
