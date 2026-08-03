-- VisionHub -- 80_visita_evaluacion_lider.sql
-- Bloque 4 del pedido del owner (2026-08-02): formulario de visita del Líder
-- de Red (registro de supervisión).
--
-- 1. Motivo "Impartición": nuevo valor del enum -- especifico para CdP que ya
--    estan en funcionamiento (a diferencia de SEGUIMIENTO/APERTURA_NUEVA_CDP).
--    ALTER TYPE ... ADD VALUE no puede usarse en la misma transaccion que
--    referencia el valor nuevo, pero esta migracion no lo usa en ningun otro
--    statement, asi que es seguro.
--
-- 2. Evaluacion del lider (ADN de la casa / manera de ensenar): dos campos
--    booleanos nuevos, separados de `aspectos` (que es una lista de
--    problemas que requieren atencion, no una evaluacion positiva/negativa).

ALTER TYPE motivo_visita_enum ADD VALUE 'IMPARTICION';

ALTER TABLE visita_cdp
  ADD COLUMN tiene_adn_casa      BOOLEAN,
  ADD COLUMN ensenanza_correcta  BOOLEAN;

-- fn_visitas_red: RETURNS TABLE cambia de forma -> DROP + CREATE. Cuerpo
-- identico al de 77_perfil_formacion_ministerio_milagros.sql (que ya sumo
-- lider_cdp_id), sumando los dos campos nuevos.
DROP FUNCTION IF EXISTS fn_visitas_red(UUID, DATE, DATE);

CREATE FUNCTION fn_visitas_red(p_red_id UUID, p_desde DATE DEFAULT NULL, p_hasta DATE DEFAULT NULL)
RETURNS TABLE (
  id UUID, casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT, lider_cdp_id UUID, lider_cdp_nombre TEXT,
  motivo motivo_visita_enum, aspectos TEXT[], aspecto_otro_detalle TEXT, observaciones TEXT,
  tiene_adn_casa BOOLEAN, ensenanza_correcta BOOLEAN,
  fecha_visita DATE, hora_registro TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT v.id, v.casa_de_paz_id, fn_etiqueta_cdp(v.casa_de_paz_id),
         (SELECT p.id FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo c ON c.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = v.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1),
         (SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo c ON c.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = v.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1),
         v.motivo, v.aspectos, v.aspecto_otro_detalle, v.observaciones,
         v.tiene_adn_casa, v.ensenanza_correcta, v.fecha_visita, v.hora_registro
  FROM visita_cdp v
  WHERE v.red_id = p_red_id AND v.fecha_eliminacion IS NULL
    AND (p_desde IS NULL OR v.fecha_visita >= p_desde)
    AND (p_hasta IS NULL OR v.fecha_visita <= p_hasta)
  ORDER BY v.fecha_visita DESC, v.hora_registro DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_visitas_red(UUID, DATE, DATE) TO authenticated;
