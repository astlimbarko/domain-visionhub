-- VisionHub -- 56_visitas_red.sql
-- Registro de supervision: visita de un Lider de Red a una CdP de sus
-- lideres (formulario tipo "Registro de Supervision" pedido por el owner).
-- Aspectos de atencion como lista fija (TEXT[] + CHECK) en vez de tabla
-- catalogo -- a diferencia de tipo_evento/tipo_evangelismo, esta lista no es
-- algo que cada iglesia deba poder personalizar hoy; si eso cambia, se migra
-- a catalogo en un paso aparte.

CREATE TYPE motivo_visita_enum AS ENUM ('SEGUIMIENTO', 'APERTURA_NUEVA_CDP');

CREATE TABLE visita_cdp (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id        UUID NOT NULL REFERENCES casa_de_paz(id),
  red_id                UUID NOT NULL REFERENCES red(id),
  lider_red_id          UUID NOT NULL REFERENCES persona(id),
  motivo                motivo_visita_enum NOT NULL,
  aspectos              TEXT[] NOT NULL DEFAULT '{}',
  aspecto_otro_detalle  TEXT,
  observaciones         TEXT,
  fecha_visita          DATE NOT NULL,
  hora_registro         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion   TIMESTAMPTZ,
  creado_por            UUID REFERENCES auth.users(id),
  actualizado_por       UUID REFERENCES auth.users(id),
  fecha_eliminacion     TIMESTAMPTZ,
  eliminado_por         UUID REFERENCES auth.users(id),
  CONSTRAINT chk_visita_cdp_aspectos CHECK (
    aspectos <@ ARRAY['PUNTUALIDAD','PARTICIPACION_ASISTENTES','AMBIENTE_REUNION','ORGANIZACION',
                       'EVANGELISMO','ENSENANZA','LIDERAZGO','AFIRMACION_NUEVOS','OTRO']::text[]
  )
);

CREATE INDEX idx_visita_cdp_red_fecha ON visita_cdp (red_id, fecha_visita DESC) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_visita_cdp_cdp_fecha ON visita_cdp (casa_de_paz_id, fecha_visita DESC) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_visita_cdp BEFORE INSERT OR UPDATE ON visita_cdp FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_visita_cdp BEFORE DELETE ON visita_cdp FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE visita_cdp ENABLE ROW LEVEL SECURITY;

-- Mismo patron de alcance que el resto del esquema (evento, evangelismo,
-- meta_evangelismo_asignada): SELECT de alcance iglesia, escritura acotada
-- por rol -- en este caso, solo quien lidera esa red.
CREATE POLICY pol_visita_cdp_select ON visita_cdp
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_visita_cdp_insert ON visita_cdp
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_lider_de_red(red_id));

CREATE OR REPLACE FUNCTION fn_visitas_red(p_red_id UUID, p_desde DATE DEFAULT NULL, p_hasta DATE DEFAULT NULL)
RETURNS TABLE (
  id UUID, casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT, lider_cdp_nombre TEXT,
  motivo motivo_visita_enum, aspectos TEXT[], aspecto_otro_detalle TEXT, observaciones TEXT,
  fecha_visita DATE, hora_registro TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  -- `red.id` calificado a proposito: fn_visitas_red declara una columna de
  -- salida `id` (RETURNS TABLE), que plpgsql expone como variable en todo el
  -- cuerpo -- un `WHERE id = ...` sin calificar es ambiguo.
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT v.id, v.casa_de_paz_id, fn_etiqueta_cdp(v.casa_de_paz_id),
         (SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo c ON c.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = v.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1),
         v.motivo, v.aspectos, v.aspecto_otro_detalle, v.observaciones, v.fecha_visita, v.hora_registro
  FROM visita_cdp v
  WHERE v.red_id = p_red_id AND v.fecha_eliminacion IS NULL
    AND (p_desde IS NULL OR v.fecha_visita >= p_desde)
    AND (p_hasta IS NULL OR v.fecha_visita <= p_hasta)
  ORDER BY v.fecha_visita DESC, v.hora_registro DESC;
END;
$$;
