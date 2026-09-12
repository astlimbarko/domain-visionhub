-- VisionHub -- fix_fn_afirmacion_estadisticas_registro.sql
-- Bug real encontrado (2026-09-12, pedido del owner de revisar las tarjetas
-- "Por URL"/"Por formulario" de Membresia de Afirmacion): fn_afirmacion_
-- estadisticas_registro contaba filas crudas de persona_llegada (sin
-- dedupe por persona) y no excluia Semillas de Evangelismo ni personas
-- ocultas/eliminadas -- mientras que la tabla (fn_afirmacion_buscar_
-- membresia, migracion 20260911030000) calcula el via_registro tomando
-- solo la ULTIMA llegada por persona (LATERAL) y excluye Semillas/oculto.
-- Hoy no se nota (no hay personas con mas de 1 fila de persona_llegada en
-- produccion), pero es una discrepancia latente que puede aparecer en
-- cualquier momento (reingresos, invitaciones repetidas). Se reescribe con
-- el mismo criterio exacto que ya usa la tabla, para que el numero de la
-- tarjeta siempre coincida con lo que trae el filtro.

CREATE OR REPLACE FUNCTION public.fn_afirmacion_estadisticas_registro(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_por_url INT;
  v_por_formulario INT;
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id) OR fn_es_super_admin()) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    count(*) FILTER (WHERE llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NOT NULL),
    count(*) FILTER (WHERE llegada.motivo_codigo = 'INVITACION_PERSONAL' AND llegada.casa_paz_url_id IS NULL)
  INTO v_por_url, v_por_formulario
  FROM persona p
  LEFT JOIN LATERAL (
    SELECT pl.casa_paz_url_id, ml.codigo AS motivo_codigo
    FROM persona_llegada pl
    JOIN motivo_llegada ml ON ml.id = pl.motivo_llegada_id
    WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
    ORDER BY pl.fecha_creacion DESC
    LIMIT 1
  ) llegada ON true
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND NOT p.oculto
    AND NOT EXISTS (
      SELECT 1 FROM evangelismo ev
      JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
      WHERE ev.persona_id = p.id AND te.codigo = 'SEMILLA' AND ev.fecha_eliminacion IS NULL
    );

  RETURN jsonb_build_object(
    'por_url', COALESCE(v_por_url, 0),
    'por_formulario', COALESCE(v_por_formulario, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_estadisticas_registro(UUID) TO authenticated;
