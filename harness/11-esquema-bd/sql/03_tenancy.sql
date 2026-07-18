-- VisionHub -- 03_tenancy.sql
-- cobertura, moneda, iglesia_moneda, iglesia (SIN pastor_id ni supervisor_id todavia -- ciclo 1)

CREATE TABLE cobertura (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               VARCHAR(200) NOT NULL,
  sede                 VARCHAR(100),
  cobertura_padre_id   UUID REFERENCES cobertura(id),
  activo               BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_cobertura_no_autopadre CHECK (cobertura_padre_id IS DISTINCT FROM id)
);

CREATE TRIGGER trg_auditoria_cobertura BEFORE INSERT OR UPDATE ON cobertura FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_cobertura BEFORE DELETE ON cobertura FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- moneda: tabla catalogo, reemplaza al moneda_enum original (decision del owner, 2026-07-19)
CREATE TABLE moneda (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               CHAR(3) NOT NULL UNIQUE,
  nombre               VARCHAR(50) NOT NULL,
  simbolo              VARCHAR(5) NOT NULL,
  decimales            SMALLINT NOT NULL DEFAULT 2,
  activo               BOOLEAN NOT NULL DEFAULT true,
  orden                SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_moneda BEFORE INSERT OR UPDATE ON moneda FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_moneda BEFORE DELETE ON moneda FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE iglesia_moneda (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id           UUID NOT NULL, -- FK agregada tras crear iglesia, ver mas abajo
  moneda_id            UUID NOT NULL REFERENCES moneda(id),
  activa               BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TABLE iglesia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefijo           VARCHAR(100) NOT NULL DEFAULT 'Centro de Vida',
  sufijo            VARCHAR(100) NOT NULL,
  nombre            VARCHAR(200) GENERATED ALWAYS AS (prefijo || ' ' || sufijo) STORED,
  ciudad            VARCHAR(100) NOT NULL,
  correo            VARCHAR(150),
  iglesia_padre_id  UUID REFERENCES iglesia(id),
  cobertura_id      UUID NOT NULL REFERENCES cobertura(id),
  moneda_defecto_id UUID NOT NULL REFERENCES moneda(id),
  activo            BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_iglesia_no_autopadre CHECK (iglesia_padre_id IS DISTINCT FROM id)
);
-- pastor_id y supervisor_id se agregan en 04_persona.sql (cierra el ciclo 1)

CREATE TRIGGER trg_auditoria_iglesia BEFORE INSERT OR UPDATE ON iglesia FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_iglesia BEFORE DELETE ON iglesia FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE iglesia_moneda ADD CONSTRAINT fk_iglesia_moneda_iglesia FOREIGN KEY (iglesia_id) REFERENCES iglesia(id);
CREATE UNIQUE INDEX uq_iglesia_moneda ON iglesia_moneda (iglesia_id, moneda_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_iglesia_moneda BEFORE INSERT OR UPDATE ON iglesia_moneda FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_iglesia_moneda BEFORE DELETE ON iglesia_moneda FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Ciclo de iglesia_padre_id: se corta con un disparador (recorre hacia arriba, tope 50 saltos)
CREATE OR REPLACE FUNCTION fn_iglesia_sin_ciclo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_actual UUID := NEW.iglesia_padre_id;
  v_saltos INT := 0;
BEGIN
  WHILE v_actual IS NOT NULL LOOP
    IF v_actual = NEW.id THEN
      RAISE EXCEPTION 'IGLESIA_CICLO: la iglesia % no puede ser descendiente de si misma', NEW.id
        USING ERRCODE = 'P0001';
    END IF;
    v_saltos := v_saltos + 1;
    IF v_saltos > 50 THEN
      RAISE EXCEPTION 'IGLESIA_CICLO: jerarquia demasiado profunda o ciclo detectado'
        USING ERRCODE = 'P0001';
    END IF;
    SELECT iglesia_padre_id INTO v_actual FROM iglesia WHERE id = v_actual;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_iglesia_sin_ciclo
  BEFORE INSERT OR UPDATE ON iglesia
  FOR EACH ROW EXECUTE FUNCTION fn_iglesia_sin_ciclo();
