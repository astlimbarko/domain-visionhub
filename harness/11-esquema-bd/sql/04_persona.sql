-- VisionHub -- 04_persona.sql
-- persona, persona_detalle. Cierra el ciclo 1 (iglesia.pastor_id/supervisor_id).

CREATE TABLE persona (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  usuario_id        UUID REFERENCES auth.users(id),
  primer_nombre     VARCHAR(100) NOT NULL,
  segundo_nombre    VARCHAR(100),
  primer_apellido   VARCHAR(100) NOT NULL,
  segundo_apellido  VARCHAR(100),
  apellido_casada   VARCHAR(100),
  mostrar_apellido_casada BOOLEAN NOT NULL DEFAULT true,
  sexo              sexo_enum NOT NULL,
  fecha_nacimiento  DATE,
  ci                VARCHAR(20),
  correo            VARCHAR(150),
  oculto            BOOLEAN NOT NULL DEFAULT false,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_persona_nacimiento CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE)
);

CREATE UNIQUE INDEX uq_persona_ci ON persona (ci) WHERE ci IS NOT NULL AND fecha_eliminacion IS NULL;
CREATE UNIQUE INDEX uq_persona_usuario ON persona (usuario_id) WHERE usuario_id IS NOT NULL AND fecha_eliminacion IS NULL;
CREATE INDEX idx_persona_iglesia ON persona (iglesia_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_persona BEFORE INSERT OR UPDATE ON persona FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona BEFORE DELETE ON persona FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE persona_detalle (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id         UUID NOT NULL REFERENCES persona(id),
  nacimiento_ciudad  VARCHAR(100),
  estado_civil       estado_civil_enum,
  grado_instruccion  grado_instruccion_enum,
  ocupacion          VARCHAR(150),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT uq_persona_detalle UNIQUE (persona_id)
);

CREATE TRIGGER trg_auditoria_persona_detalle BEFORE INSERT OR UPDATE ON persona_detalle FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_detalle BEFORE DELETE ON persona_detalle FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Normalizacion de correo + apellido_casada exige estado_civil = CASADO
CREATE OR REPLACE FUNCTION fn_persona_normalizar()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.correo IS NOT NULL THEN
    NEW.correo := lower(btrim(NEW.correo));
    IF NEW.correo = '' THEN NEW.correo := NULL; END IF;
  END IF;

  IF NEW.apellido_casada IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM persona_detalle
    WHERE persona_id = NEW.id AND estado_civil = 'CASADO' AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'APELLIDO_CASADA_SIN_MATRIMONIO: apellido_casada requiere estado_civil = CASADO'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_persona_normalizar
  BEFORE INSERT OR UPDATE ON persona
  FOR EACH ROW EXECUTE FUNCTION fn_persona_normalizar();

-- Nombre completo calculado. mostrar_apellido_casada es el interruptor (2026-07-17):
-- separa "tener el dato guardado" de "mostrarlo", sin reconstruir nada.
CREATE OR REPLACE FUNCTION fn_nombre_completo(p persona)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT array_to_string(
    ARRAY[
      p.primer_nombre,
      p.segundo_nombre,
      p.primer_apellido,
      CASE WHEN p.apellido_casada IS NOT NULL AND p.mostrar_apellido_casada
           THEN p.apellido_casada
           ELSE p.segundo_apellido
      END
    ]::text[],
    ' '
  );
$$;

-- NOTA: fn_sugerir_apellido_casada se crea en 09_parentela.sql: referencia
-- familia/tipo_relacion, y las funciones LANGUAGE SQL se validan contra el
-- catalogo en el momento de CREATE FUNCTION (a diferencia de plpgsql).

-- Al divorciarse o volver a soltero se limpia apellido_casada. VIUDO no esta en
-- la lista a proposito: la viuda conserva el apellido por defecto (confirmado
-- por el owner, PENDIENTES.md #5, 2026-07-17).
CREATE OR REPLACE FUNCTION fn_limpiar_apellido_casada()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado_civil IN ('SOLTERO', 'DIVORCIADO')
     AND OLD.estado_civil = 'CASADO' THEN
    UPDATE persona SET apellido_casada = NULL WHERE id = NEW.persona_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_limpiar_apellido_casada
  AFTER UPDATE ON persona_detalle
  FOR EACH ROW
  WHEN (NEW.estado_civil IS DISTINCT FROM OLD.estado_civil)
  EXECUTE FUNCTION fn_limpiar_apellido_casada();

-- Cierra el ciclo 1: la primera iglesia se crea antes que su pastor
ALTER TABLE iglesia ADD COLUMN pastor_id UUID REFERENCES persona(id);
ALTER TABLE iglesia ADD COLUMN supervisor_id UUID REFERENCES persona(id);
