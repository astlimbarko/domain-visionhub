-- VisionHub -- 07_contacto.sql
-- Modelo hibrido (00-fundacion): direccion/telefono + su tabla de asignacion.
-- direccion_asignacion y telefono_asignacion nacen SIN casa_de_paz_id (ciclo 2,
-- se cierra con ALTER TABLE en 08_estructura.sql).

CREATE TABLE direccion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id     UUID NOT NULL REFERENCES iglesia(id),
  ciudad         VARCHAR(100),
  zona           VARCHAR(100),
  anillo         VARCHAR(20),
  calle          VARCHAR(150),
  numero         VARCHAR(20),
  referencia     TEXT,
  url_gps        TEXT,
  observaciones  TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_direccion BEFORE INSERT OR UPDATE ON direccion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_direccion BEFORE DELETE ON direccion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE direccion_asignacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  direccion_id    UUID NOT NULL REFERENCES direccion(id),
  persona_id      UUID REFERENCES persona(id),
  iglesia_ref_id  UUID REFERENCES iglesia(id),
  es_principal    BOOLEAN NOT NULL DEFAULT false,
  activo          BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
  -- casa_de_paz_id y su CHECK "una sola entidad" se agregan en 08_estructura.sql
);

CREATE UNIQUE INDEX uq_direccion_principal_persona
  ON direccion_asignacion (persona_id)
  WHERE es_principal AND activo AND persona_id IS NOT NULL AND fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_direccion_asignacion BEFORE INSERT OR UPDATE ON direccion_asignacion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_direccion_asignacion BEFORE DELETE ON direccion_asignacion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE tipo_telefono (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  VARCHAR(30) NOT NULL UNIQUE,
  nombre  VARCHAR(100) NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_tipo_telefono BEFORE INSERT OR UPDATE ON tipo_telefono FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_tipo_telefono BEFORE DELETE ON tipo_telefono FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE telefono (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  tipo_telefono_id  UUID NOT NULL REFERENCES tipo_telefono(id),
  numero            VARCHAR(20) NOT NULL,
  observaciones     TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_telefono BEFORE INSERT OR UPDATE ON telefono FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_telefono BEFORE DELETE ON telefono FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE telefono_asignacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  telefono_id     UUID NOT NULL REFERENCES telefono(id),
  persona_id      UUID REFERENCES persona(id),
  iglesia_ref_id  UUID REFERENCES iglesia(id),
  es_principal    BOOLEAN NOT NULL DEFAULT false,
  activo          BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
  -- casa_de_paz_id se agrega en 08_estructura.sql
);

CREATE TRIGGER trg_auditoria_telefono_asignacion BEFORE INSERT OR UPDATE ON telefono_asignacion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_telefono_asignacion BEFORE DELETE ON telefono_asignacion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE motivo_llegada (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  VARCHAR(30) NOT NULL UNIQUE,
  nombre  VARCHAR(100) NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_motivo_llegada BEFORE INSERT OR UPDATE ON motivo_llegada FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_motivo_llegada BEFORE DELETE ON motivo_llegada FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE persona_llegada (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id         UUID NOT NULL REFERENCES iglesia(id),
  persona_id         UUID NOT NULL REFERENCES persona(id),
  motivo_llegada_id  UUID NOT NULL REFERENCES motivo_llegada(id),
  fecha_ingreso      DATE NOT NULL,
  invitado_por_id    UUID REFERENCES persona(id),
  invitado_por_txt   VARCHAR(200),
  comentarios        TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_llegada_invitador CHECK (NOT (invitado_por_id IS NOT NULL AND invitado_por_txt IS NOT NULL)),
  CONSTRAINT chk_llegada_fecha CHECK (fecha_ingreso <= CURRENT_DATE)
);

CREATE TRIGGER trg_auditoria_persona_llegada BEFORE INSERT OR UPDATE ON persona_llegada FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_llegada BEFORE DELETE ON persona_llegada FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();
