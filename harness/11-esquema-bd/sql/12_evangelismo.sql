-- VisionHub -- 12_evangelismo.sql
-- Evangelismo de Casa de Paz (escala CASA_DE_PAZ unicamente en el Modulo 1).

CREATE TABLE evangelismo (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id          UUID NOT NULL REFERENCES iglesia(id),
  persona_id          UUID NOT NULL REFERENCES persona(id),
  casa_de_paz_id      UUID REFERENCES casa_de_paz(id),
  escala              escala_evangelismo_enum NOT NULL DEFAULT 'CASA_DE_PAZ',
  fecha               DATE NOT NULL,
  domicilio           TEXT,
  evangelizado_por_id UUID REFERENCES persona(id),
  observaciones       TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_evangelismo_fecha CHECK (fecha <= CURRENT_DATE),
  CONSTRAINT chk_evangelismo_escala_cdp CHECK (escala <> 'CASA_DE_PAZ' OR casa_de_paz_id IS NOT NULL),
  CONSTRAINT chk_evangelismo_solo_cdp_modulo1 CHECK (escala = 'CASA_DE_PAZ')
);

CREATE UNIQUE INDEX uq_evangelismo_persona_cdp_fecha ON evangelismo (persona_id, casa_de_paz_id, fecha) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_evangelismo_cdp_fecha ON evangelismo (casa_de_paz_id, fecha) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_evangelismo BEFORE INSERT OR UPDATE ON evangelismo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_evangelismo BEFORE DELETE ON evangelismo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_evangelismo_crear_persona()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_iglesia_persona UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'EVANGELISMO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM persona_estado WHERE persona_id = NEW.persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) THEN
    PERFORM fn_transicionar_estado(NEW.persona_id, 'SIM', NEW.fecha, 'Registrado por evangelismo', true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evangelismo_crear_persona
  AFTER INSERT ON evangelismo
  FOR EACH ROW EXECUTE FUNCTION fn_evangelismo_crear_persona();

ALTER TABLE casa_de_paz
  ADD COLUMN meta_evangelismo INTEGER,
  ADD CONSTRAINT chk_meta_propia_positiva CHECK (meta_evangelismo IS NULL OR meta_evangelismo > 0);

CREATE TABLE meta_evangelismo_asignada (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  asignador_id    UUID NOT NULL REFERENCES persona(id),
  meta            INTEGER NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  observaciones   TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_meta_asignada_positiva CHECK (meta > 0),
  CONSTRAINT chk_meta_asignada_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT excl_meta_asignada_solapada EXCLUDE USING gist (
    casa_de_paz_id WITH =, daterange(fecha_inicio, fecha_fin, '[]') WITH &&
  ) WHERE (fecha_eliminacion IS NULL)
);

CREATE TRIGGER trg_auditoria_meta_evangelismo_asignada BEFORE INSERT OR UPDATE ON meta_evangelismo_asignada FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_meta_evangelismo_asignada BEFORE DELETE ON meta_evangelismo_asignada FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Pastor/Supervisor de la iglesia, o lider/sublider de la red de esa CdP.
CREATE OR REPLACE FUNCTION fn_es_rol_superior_de_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    fn_es_operativo_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR EXISTS (
      SELECT 1 FROM casa_de_paz_red cdr
      JOIN red_cargo rc ON rc.red_id = cdr.red_id
      JOIN cargo c ON c.id = rc.cargo_id
      WHERE cdr.casa_de_paz_id = p_casa_de_paz_id
        AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
        AND rc.persona_id = fn_mi_persona_id()
        AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED')
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION fn_meta_efectiva(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (meta INTEGER, origen VARCHAR)
LANGUAGE sql STABLE
AS $$
  (SELECT ma.meta, 'ASIGNADA'::VARCHAR
   FROM meta_evangelismo_asignada ma
   WHERE ma.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma.fecha_inicio AND ma.fecha_fin AND ma.fecha_eliminacion IS NULL
   LIMIT 1)

  UNION ALL

  (SELECT c.meta_evangelismo, 'PROPIA'::VARCHAR
   FROM casa_de_paz c
   WHERE c.id = p_casa_de_paz_id AND c.meta_evangelismo IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma2
       WHERE ma2.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma2.fecha_inicio AND ma2.fecha_fin AND ma2.fecha_eliminacion IS NULL
     )
   LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION fn_tasa_evangelismo(p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (evangelizados BIGINT, meta INTEGER, origen VARCHAR, tasa NUMERIC)
LANGUAGE sql STABLE
AS $$
  WITH
  conteo AS (
    SELECT count(*) AS n FROM evangelismo e
    WHERE e.casa_de_paz_id = p_casa_de_paz_id AND e.fecha BETWEEN p_desde AND p_hasta AND e.fecha_eliminacion IS NULL
  ),
  m AS (SELECT * FROM fn_meta_efectiva(p_casa_de_paz_id, p_hasta))
  SELECT c.n, m.meta, m.origen,
         CASE WHEN m.meta IS NULL OR m.meta = 0 THEN NULL ELSE round((c.n::numeric / m.meta) * 100, 2) END
  FROM conteo c LEFT JOIN m ON true;
$$;

-- fn_mi_rol_operativo: lee usuario_rol directo (2026-07-17). Con roles de
-- dominio, el rol de sistema ya coincide con lo que el front espera; ya no
-- hace falta derivarlo de persona_cargo/red_cargo/casa_de_paz_cargo.
CREATE OR REPLACE FUNCTION fn_mi_rol_operativo(p_iglesia_id UUID)
RETURNS VARCHAR
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rol::VARCHAR FROM usuario_rol
  WHERE usuario_id = auth.uid() AND iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL
  ORDER BY CASE rol
    WHEN 'PASTOR' THEN 1 WHEN 'SUPERVISOR_VISION_ACCION' THEN 2
    WHEN 'LIDER_RED' THEN 3 WHEN 'LIDER_CDP' THEN 4 WHEN 'SUBLIDER_CDP' THEN 5 ELSE 99
  END
  LIMIT 1;
$$;

-- Declarados vs registrados (04-reporte-cdp), aca porque necesita "evangelismo".
CREATE VIEW v_reporte_evangelismo AS
SELECT
  r.id AS reporte_id, r.casa_de_paz_id, r.fecha_reunion, r.salio_evangelizar,
  COALESCE(r.evangelizados_declarados, 0) AS declarados,
  count(e.id) AS registrados,
  COALESCE(r.evangelizados_declarados, 0) - count(e.id) AS diferencia
FROM casa_de_paz_reporte r
LEFT JOIN evangelismo e ON e.casa_de_paz_id = r.casa_de_paz_id AND e.fecha = r.fecha_reunion AND e.fecha_eliminacion IS NULL
WHERE r.fecha_eliminacion IS NULL
GROUP BY r.id, r.casa_de_paz_id, r.fecha_reunion, r.salio_evangelizar, r.evangelizados_declarados;
