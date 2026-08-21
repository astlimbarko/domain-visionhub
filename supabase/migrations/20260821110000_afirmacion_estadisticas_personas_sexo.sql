-- VisionHub -- pedido explicito del owner: la fila de KPIs de
-- /afirmacion-personas necesita mas indicadores contables (ademas de
-- total y por estado). Se agrega el desglose por sexo.

CREATE OR REPLACE FUNCTION public.fn_afirmacion_estadisticas_personas(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INT;
  v_por_estado JSONB;
  v_hombres INT;
  v_mujeres INT;
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE sexo = 'M'),
         count(*) FILTER (WHERE sexo = 'F')
  INTO v_total, v_hombres, v_mujeres
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto;

  SELECT jsonb_object_agg(COALESCE(e.sigla, 'SIN_ESTADO'), conteo)
  INTO v_por_estado
  FROM (
    SELECT pe.estado_id, count(*) AS conteo
    FROM persona p
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto
    GROUP BY pe.estado_id
  ) c
  LEFT JOIN estado e ON e.id = c.estado_id;

  RETURN jsonb_build_object(
    'total', v_total,
    'hombres', v_hombres,
    'mujeres', v_mujeres,
    'por_estado', COALESCE(v_por_estado, '{}'::jsonb)
  );
END;
$$;
