-- VisionHub -- KAN-214 (plan panel Afirmacion, punto 1/4): indicador de
-- cuantas personas se registraron por URL de Casa de Paz vs. por el
-- formulario interno de Afirmacion.
--
-- Los 2 unicos caminos que insertan en persona_llegada con motivo
-- INVITACION_PERSONAL son fn_registrar_persona_via_url (casa_paz_url_id NOT
-- NULL) y fn_registrar_persona_afirmacion (casa_paz_url_id siempre NULL) --
-- verificado que no hay ningun otro INSERT INTO persona_llegada en el
-- proyecto que use este motivo, asi que no hace falta una columna nueva
-- para distinguir el origen.

CREATE OR REPLACE FUNCTION public.fn_afirmacion_estadisticas_registro(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_por_url INT;
  v_por_formulario INT;
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    count(*) FILTER (WHERE pl.casa_paz_url_id IS NOT NULL),
    count(*) FILTER (WHERE pl.casa_paz_url_id IS NULL)
  INTO v_por_url, v_por_formulario
  FROM persona_llegada pl
  JOIN motivo_llegada ml ON ml.id = pl.motivo_llegada_id
  WHERE pl.iglesia_id = p_iglesia_id
    AND pl.fecha_eliminacion IS NULL
    AND ml.codigo = 'INVITACION_PERSONAL';

  RETURN jsonb_build_object(
    'por_url', COALESCE(v_por_url, 0),
    'por_formulario', COALESCE(v_por_formulario, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_estadisticas_registro(UUID) TO authenticated;
