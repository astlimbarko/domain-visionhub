-- VisionHub -- 09_parentela.sql
-- tipo_relacion (sin cuenta_para_familia: se movio a configuracion_valor, ver
-- 06_configuracion.sql y 10-panel-supervisor), familia, familia_override, referencia_familiar.

CREATE TABLE tipo_relacion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(30) NOT NULL UNIQUE,
  nombre      VARCHAR(100) NOT NULL,
  inverso_id  UUID REFERENCES tipo_relacion(id),
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

-- chk_tipo_relacion_inverso NO se agrega aca: NOT VALID solo exime a las filas
-- YA existentes al momento del ALTER, no a los INSERT nuevos -- el primer
-- INSERT de la semilla (sin inverso_id todavia) igual fallaria. Se agrega al
-- final de seed_01_catalogos_globales.sql, despues del UPDATE que enlaza los inversos.

CREATE TRIGGER trg_auditoria_tipo_relacion BEFORE INSERT OR UPDATE ON tipo_relacion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_tipo_relacion BEFORE DELETE ON tipo_relacion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE familia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  persona_id        UUID NOT NULL REFERENCES persona(id),
  familiar_id       UUID NOT NULL REFERENCES persona(id),
  tipo_relacion_id  UUID NOT NULL REFERENCES tipo_relacion(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_familia_no_autorelacion CHECK (persona_id <> familiar_id)
);

CREATE UNIQUE INDEX uq_familia_par ON familia (persona_id, familiar_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_familia BEFORE INSERT OR UPDATE ON familia FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_familia BEFORE DELETE ON familia FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Movida de 04_persona.sql: es LANGUAGE SQL y referencia familia/tipo_relacion,
-- que no existian todavia en 04.
CREATE OR REPLACE FUNCTION fn_sugerir_apellido_casada(p_persona_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT 'de ' || c.primer_apellido
  FROM persona p
  JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
  JOIN familia f ON f.persona_id = p.id AND f.fecha_eliminacion IS NULL
  JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id AND tr.codigo = 'CONYUGE'
  JOIN persona c ON c.id = f.familiar_id AND c.fecha_eliminacion IS NULL
  WHERE p.id = p_persona_id
    AND p.sexo = 'F'
    AND pd.estado_civil = 'CASADO'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_familia_simetria()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inverso_id UUID;
  v_iglesia_a  UUID;
  v_iglesia_b  UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT iglesia_id INTO v_iglesia_a FROM persona WHERE id = NEW.persona_id;
    SELECT iglesia_id INTO v_iglesia_b FROM persona WHERE id = NEW.familiar_id;
    IF v_iglesia_a IS DISTINCT FROM v_iglesia_b THEN
      RAISE EXCEPTION 'FAMILIA_IGLESIAS_DISTINTAS: no se puede relacionar personas de iglesias distintas'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT inverso_id INTO v_inverso_id FROM tipo_relacion WHERE id = NEW.tipo_relacion_id;
    IF v_inverso_id IS NULL THEN
      RAISE EXCEPTION 'TIPO_RELACION_SIN_INVERSO: el tipo % no tiene inverso definido', NEW.tipo_relacion_id
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM familia WHERE persona_id = NEW.familiar_id AND familiar_id = NEW.persona_id AND fecha_eliminacion IS NULL
    ) THEN
      INSERT INTO familia (iglesia_id, persona_id, familiar_id, tipo_relacion_id)
      VALUES (NEW.iglesia_id, NEW.familiar_id, NEW.persona_id, v_inverso_id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.fecha_eliminacion IS NOT NULL AND OLD.fecha_eliminacion IS NULL THEN
    UPDATE familia SET fecha_eliminacion = now()
    WHERE persona_id = NEW.familiar_id AND familiar_id = NEW.persona_id AND fecha_eliminacion IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_familia_simetria
  AFTER INSERT OR UPDATE ON familia
  FOR EACH ROW EXECUTE FUNCTION fn_familia_simetria();

-- Override manual de familia (decision del owner, 2026-07-17): incluir/excluir
-- personas puntuales, nunca fusionar/partir nucleos completos.
CREATE TABLE familia_override (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id             UUID NOT NULL REFERENCES iglesia(id),
  persona_id             UUID NOT NULL REFERENCES persona(id),
  tipo                   familia_override_tipo_enum NOT NULL,
  persona_referencia_id  UUID REFERENCES persona(id),
  motivo                 TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_familia_override_referencia CHECK (
    (tipo = 'EXCLUIR' AND persona_referencia_id IS NULL) OR
    (tipo = 'INCLUIR_CON' AND persona_referencia_id IS NOT NULL AND persona_referencia_id <> persona_id)
  )
);

CREATE UNIQUE INDEX uq_familia_override_persona ON familia_override (persona_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_familia_override BEFORE INSERT OR UPDATE ON familia_override FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_familia_override BEFORE DELETE ON familia_override FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE referencia_familiar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  persona_id        UUID NOT NULL REFERENCES persona(id),
  nombre_familiar   VARCHAR(200) NOT NULL,
  tipo_relacion_id  UUID NOT NULL REFERENCES tipo_relacion(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_referencia_familiar BEFORE INSERT OR UPDATE ON referencia_familiar FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_referencia_familiar BEFORE DELETE ON referencia_familiar FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Conteo de familias: componente conexo del grafo de parentesco, con la
-- configuracion por iglesia (FAMILIA_CUENTA_*) y los overrides manuales aplicados.
CREATE OR REPLACE FUNCTION fn_nucleos_familiares(p_iglesia_id UUID)
RETURNS TABLE (persona_id UUID, nucleo_id UUID)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER salta RLS: hay que verificar el alcance a mano (00-fundacion, riesgo #1)
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  excluida AS (
    SELECT persona_id FROM familia_override
    WHERE iglesia_id = p_iglesia_id AND tipo = 'EXCLUIR' AND fecha_eliminacion IS NULL
  ),
  arista_real AS (
    SELECT f.persona_id AS a, f.familiar_id AS b
    FROM familia f
    JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id
    WHERE f.iglesia_id = p_iglesia_id
      AND f.fecha_eliminacion IS NULL
      AND tr.activo
      AND fn_config_bool(p_iglesia_id, 'FAMILIA_CUENTA_' || tr.codigo)
      AND f.persona_id NOT IN (SELECT persona_id FROM excluida)
      AND f.familiar_id NOT IN (SELECT persona_id FROM excluida)
  ),
  arista_override AS (
    SELECT persona_id AS a, persona_referencia_id AS b
    FROM familia_override
    WHERE iglesia_id = p_iglesia_id AND tipo = 'INCLUIR_CON' AND fecha_eliminacion IS NULL
      AND persona_id NOT IN (SELECT persona_id FROM excluida)
      AND persona_referencia_id NOT IN (SELECT persona_id FROM excluida)
    UNION ALL
    SELECT persona_referencia_id AS a, persona_id AS b
    FROM familia_override
    WHERE iglesia_id = p_iglesia_id AND tipo = 'INCLUIR_CON' AND fecha_eliminacion IS NULL
      AND persona_id NOT IN (SELECT persona_id FROM excluida)
      AND persona_referencia_id NOT IN (SELECT persona_id FROM excluida)
  ),
  arista AS (
    SELECT a, b FROM arista_real
    UNION
    SELECT a, b FROM arista_override
  ),
  nodo AS (
    SELECT p.id FROM persona p WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
  ),
  alcance AS (
    SELECT n.id AS origen, n.id AS alcanzado FROM nodo n
    UNION
    SELECT al.origen, ar.b FROM alcance al JOIN arista ar ON ar.a = al.alcanzado JOIN nodo n ON n.id = ar.b
  )
  SELECT origen AS persona_id, MIN(alcanzado) AS nucleo_id
  FROM alcance
  GROUP BY origen;
END;
$$;

CREATE OR REPLACE FUNCTION fn_total_familias(p_iglesia_id UUID)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(DISTINCT nucleo_id) FROM fn_nucleos_familiares(p_iglesia_id);
$$;

CREATE OR REPLACE FUNCTION fn_familias_detalle(p_iglesia_id UUID)
RETURNS TABLE (nucleo_id UUID, cantidad_personas BIGINT, integrantes TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT nf.nucleo_id, count(*) AS cantidad_personas,
         string_agg(fn_nombre_completo(p), ', ' ORDER BY p.primer_apellido) AS integrantes
  FROM fn_nucleos_familiares(p_iglesia_id) nf
  JOIN persona p ON p.id = nf.persona_id
  GROUP BY nf.nucleo_id
  ORDER BY cantidad_personas DESC;
$$;
