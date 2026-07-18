-- VisionHub -- 10_reporte.sql
-- Reporte semanal de CdP. casa_de_paz_reporte nace SIN evento_megafiesta_id
-- (se agrega en 13_calendario.sql, cierra el ciclo 3).

CREATE TABLE cdp_libro (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero  SMALLINT NOT NULL,
  nombre  VARCHAR(100) NOT NULL DEFAULT '52 Lecciones de Vida',
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_libro_numero CHECK (numero BETWEEN 1 AND 7)
);

CREATE UNIQUE INDEX uq_cdp_libro_numero ON cdp_libro (numero) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_cdp_libro BEFORE INSERT OR UPDATE ON cdp_libro FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_cdp_libro BEFORE DELETE ON cdp_libro FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE cdp_tema (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID REFERENCES iglesia(id),
  libro_id    UUID NOT NULL REFERENCES cdp_libro(id),
  numero      SMALLINT,
  nombre      VARCHAR(200) NOT NULL,
  es_especial BOOLEAN NOT NULL DEFAULT false,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_tema_numero CHECK (
    (es_especial AND numero IS NULL) OR (NOT es_especial AND numero BETWEEN 1 AND 52)
  )
);

CREATE UNIQUE INDEX uq_cdp_tema_global
  ON cdp_tema (libro_id, numero)
  WHERE iglesia_id IS NULL AND fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_cdp_tema BEFORE INSERT OR UPDATE ON cdp_tema FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_cdp_tema BEFORE DELETE ON cdp_tema FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_validar_tema_libro()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_libro UUID;
BEGIN
  IF NEW.tema_id IS NULL THEN RETURN NEW; END IF;
  SELECT libro_id INTO v_libro FROM cdp_tema WHERE id = NEW.tema_id;
  IF v_libro IS DISTINCT FROM NEW.libro_id THEN
    RAISE EXCEPTION 'TEMA_LIBRO_INCONSISTENTE: el tema % no pertenece al libro %', NEW.tema_id, NEW.libro_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE casa_de_paz_reporte (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id               UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id           UUID NOT NULL REFERENCES casa_de_paz(id),
  fecha_reunion            DATE NOT NULL,
  libro_id                 UUID REFERENCES cdp_libro(id),
  tema_id                  UUID REFERENCES cdp_tema(id),
  tema_especial_txt        VARCHAR(200),
  disertador_id            UUID REFERENCES persona(id),
  salio_evangelizar        BOOLEAN NOT NULL DEFAULT false,
  evangelizados_declarados SMALLINT,
  testimonios              TEXT,
  comentarios              TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_reporte_fecha CHECK (fecha_reunion <= CURRENT_DATE),
  CONSTRAINT chk_reporte_evangelizados CHECK (salio_evangelizar OR COALESCE(evangelizados_declarados, 0) = 0),
  CONSTRAINT chk_reporte_evangelizados_no_negativo CHECK (evangelizados_declarados IS NULL OR evangelizados_declarados >= 0)
);

CREATE UNIQUE INDEX uq_reporte_cdp_fecha ON casa_de_paz_reporte (casa_de_paz_id, fecha_reunion) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_reporte_cdp_fecha ON casa_de_paz_reporte (casa_de_paz_id, fecha_reunion DESC) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_casa_de_paz_reporte BEFORE INSERT OR UPDATE ON casa_de_paz_reporte FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_de_paz_reporte BEFORE DELETE ON casa_de_paz_reporte FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();
CREATE TRIGGER trg_validar_tema_libro BEFORE INSERT OR UPDATE ON casa_de_paz_reporte FOR EACH ROW EXECUTE FUNCTION fn_validar_tema_libro();

CREATE TABLE casa_de_paz_asistencia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  reporte_id  UUID NOT NULL REFERENCES casa_de_paz_reporte(id),
  persona_id  UUID NOT NULL REFERENCES persona(id),
  es_visita   BOOLEAN NOT NULL DEFAULT false,
  es_menor    BOOLEAN,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_asistencia_reporte_persona ON casa_de_paz_asistencia (reporte_id, persona_id) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_asistencia_persona ON casa_de_paz_asistencia (persona_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_casa_de_paz_asistencia BEFORE INSERT OR UPDATE ON casa_de_paz_asistencia FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_de_paz_asistencia BEFORE DELETE ON casa_de_paz_asistencia FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_asistencia_es_menor(p_asistencia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN p.fecha_nacimiento IS NOT NULL
      THEN EXTRACT(YEAR FROM age(r.fecha_reunion, p.fecha_nacimiento)) < fn_criterio(r.iglesia_id, 'EDAD_MINIMA_CREYENTE')
    ELSE a.es_menor
  END
  FROM casa_de_paz_asistencia a
  JOIN casa_de_paz_reporte r ON r.id = a.reporte_id
  JOIN persona p ON p.id = a.persona_id
  WHERE a.id = p_asistencia_id;
$$;

CREATE OR REPLACE FUNCTION fn_validar_asistencia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tiene_fecha BOOLEAN;
  v_iglesia_persona UUID;
BEGIN
  SELECT fecha_nacimiento IS NOT NULL, iglesia_id INTO v_tiene_fecha, v_iglesia_persona
  FROM persona WHERE id = NEW.persona_id;

  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'ASISTENCIA_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_tiene_fecha AND NEW.es_menor IS NULL THEN
    RAISE EXCEPTION 'ASISTENCIA_EDAD_INDEFINIDA: la persona % no tiene fecha de nacimiento; indique es_menor',
      NEW.persona_id USING ERRCODE = 'P0001';
  END IF;

  NEW.es_visita := NOT EXISTS (
    SELECT 1 FROM casa_de_paz_membresia m
    JOIN casa_de_paz_reporte r ON r.id = NEW.reporte_id
    WHERE m.persona_id = NEW.persona_id AND m.casa_de_paz_id = r.casa_de_paz_id
      AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_asistencia
  BEFORE INSERT OR UPDATE ON casa_de_paz_asistencia
  FOR EACH ROW EXECUTE FUNCTION fn_validar_asistencia();

CREATE VIEW v_reporte_totales AS
SELECT
  r.id AS reporte_id, r.casa_de_paz_id, r.fecha_reunion,
  count(a.id) FILTER (WHERE fn_asistencia_es_menor(a.id))     AS total_menores,
  count(a.id) FILTER (WHERE NOT fn_asistencia_es_menor(a.id)) AS total_mayores,
  count(a.id)                                                 AS total_asistentes,
  count(a.id) FILTER (WHERE a.es_visita)                      AS total_visitas
FROM casa_de_paz_reporte r
LEFT JOIN casa_de_paz_asistencia a ON a.reporte_id = r.id AND a.fecha_eliminacion IS NULL
WHERE r.fecha_eliminacion IS NULL
GROUP BY r.id, r.casa_de_paz_id, r.fecha_reunion;

CREATE OR REPLACE FUNCTION fn_visitas_consecutivas(p_persona_id UUID, p_casa_de_paz_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH reuniones AS (
    SELECT r.id, r.fecha_reunion, ROW_NUMBER() OVER (ORDER BY r.fecha_reunion DESC) AS pos
    FROM casa_de_paz_reporte r
    WHERE r.casa_de_paz_id = p_casa_de_paz_id AND r.fecha_eliminacion IS NULL
  ),
  marcadas AS (
    SELECT rn.pos,
           EXISTS (SELECT 1 FROM casa_de_paz_asistencia a
                   WHERE a.reporte_id = rn.id AND a.persona_id = p_persona_id AND a.fecha_eliminacion IS NULL) AS asistio
    FROM reuniones rn
  ),
  primera_falta AS (
    SELECT COALESCE(MIN(pos), (SELECT COUNT(*) + 1 FROM marcadas)) AS pos FROM marcadas WHERE NOT asistio
  )
  SELECT (SELECT pos FROM primera_falta) - 1;
$$;

CREATE OR REPLACE FUNCTION fn_cdp_sin_reporte(p_iglesia_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (casa_de_paz_id UUID, casa_de_paz_nombre VARCHAR, red_nombre VARCHAR, lider VARCHAR)
LANGUAGE sql STABLE
AS $$
  WITH semana AS (
    SELECT date_trunc('week', p_fecha)::date AS lunes, (date_trunc('week', p_fecha) + interval '6 days')::date AS domingo
  )
  SELECT c.id, c.nombre, r.nombre,
         (SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'LIDER_CDP'
          WHERE cc.casa_de_paz_id = c.id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
          LIMIT 1)
  FROM casa_de_paz c
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  JOIN red r ON r.id = cdr.red_id
  CROSS JOIN semana s
  WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM casa_de_paz_reporte rep
      WHERE rep.casa_de_paz_id = c.id AND rep.fecha_reunion BETWEEN s.lunes AND s.domingo AND rep.fecha_eliminacion IS NULL
    );
$$;
