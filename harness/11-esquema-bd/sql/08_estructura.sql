-- VisionHub -- 08_estructura.sql
-- Iglesia -> Red -> Casa de Paz -> Persona. Cierra el ciclo 2 (direccion/telefono
-- asignacion -> casa_de_paz).

CREATE TABLE red (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  nombre      VARCHAR(150) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_red BEFORE INSERT OR UPDATE ON red FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_red BEFORE DELETE ON red FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE casa_de_paz (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  nombre      VARCHAR(150) NOT NULL,
  capacidad   SMALLINT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_casa_de_paz BEFORE INSERT OR UPDATE ON casa_de_paz FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_de_paz BEFORE DELETE ON casa_de_paz FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE casa_de_paz_red (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  red_id          UUID NOT NULL REFERENCES red(id),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_cdp_red_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_cdp_red_vigente ON casa_de_paz_red (casa_de_paz_id) WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;
CREATE INDEX idx_cdp_red_vigente ON casa_de_paz_red (casa_de_paz_id) WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_casa_de_paz_red BEFORE INSERT OR UPDATE ON casa_de_paz_red FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_de_paz_red BEFORE DELETE ON casa_de_paz_red FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE cargo (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  VARCHAR(40) NOT NULL UNIQUE,
  nombre  VARCHAR(100) NOT NULL,
  tipo    tipo_cargo_enum NOT NULL,
  nivel   VARCHAR(20) NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_cargo BEFORE INSERT OR UPDATE ON cargo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_cargo BEFORE DELETE ON cargo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE persona_cargo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  persona_id    UUID NOT NULL REFERENCES persona(id),
  cargo_id      UUID NOT NULL REFERENCES cargo(id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_persona_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TRIGGER trg_auditoria_persona_cargo BEFORE INSERT OR UPDATE ON persona_cargo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_cargo BEFORE DELETE ON persona_cargo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Un solo Tipo A vigente por persona, y solo el Pastor asigna cargos ministeriales
-- (PASTOR/PROFETA/EVANGELISTA/MAESTRO/APOSTOL -- decision del owner, mirar.txt #7).
CREATE OR REPLACE FUNCTION fn_validar_persona_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tipo   tipo_cargo_enum;
  v_codigo VARCHAR;
  v_iglesia_persona UUID;
BEGIN
  SELECT tipo, codigo INTO v_tipo, v_codigo FROM cargo WHERE id = NEW.cargo_id;

  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'CARGO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  IF v_codigo IN ('PASTOR', 'PROFETA', 'EVANGELISTA', 'MAESTRO', 'APOSTOL')
     AND NEW.fecha_fin IS NULL
     AND NOT fn_es_pastor_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'CARGO_MINISTERIAL_SOLO_PASTOR: el cargo % solo puede asignarlo el Pastor de la iglesia %', v_codigo, NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tipo = 'A' AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM persona_cargo pc
      JOIN cargo c ON c.id = pc.cargo_id
      WHERE pc.persona_id = NEW.persona_id AND c.tipo = 'A'
        AND pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL
        AND pc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'CARGO_TIPO_A_DUPLICADO: la persona % ya tiene un cargo Tipo A vigente', NEW.persona_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_persona_cargo
  BEFORE INSERT OR UPDATE ON persona_cargo
  FOR EACH ROW EXECUTE FUNCTION fn_validar_persona_cargo();

CREATE VIEW v_persona_cargo_vigente AS
  SELECT pc.*, c.codigo, c.nombre AS cargo_nombre, c.tipo, c.nivel
  FROM persona_cargo pc
  JOIN cargo c ON c.id = pc.cargo_id
  WHERE pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL;

CREATE TABLE red_cargo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  red_id        UUID NOT NULL REFERENCES red(id),
  persona_id    UUID NOT NULL REFERENCES persona(id),
  cargo_id      UUID NOT NULL REFERENCES cargo(id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_red_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TRIGGER trg_auditoria_red_cargo BEFORE INSERT OR UPDATE ON red_cargo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_red_cargo BEFORE DELETE ON red_cargo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_validar_red_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo VARCHAR;
BEGIN
  SELECT codigo INTO v_codigo FROM cargo WHERE id = NEW.cargo_id;

  IF v_codigo IN ('LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED')
     AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM red_cargo rc
      WHERE rc.red_id = NEW.red_id AND rc.cargo_id = NEW.cargo_id
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
        AND rc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'RED_CARGO_DUPLICADO: la red % ya tiene un % vigente', NEW.red_id, v_codigo
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_red_cargo
  BEFORE INSERT OR UPDATE ON red_cargo
  FOR EACH ROW EXECUTE FUNCTION fn_validar_red_cargo();

CREATE TABLE casa_de_paz_cargo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  persona_id      UUID NOT NULL REFERENCES persona(id),
  cargo_id        UUID NOT NULL REFERENCES cargo(id),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_cdp_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TRIGGER trg_auditoria_casa_de_paz_cargo BEFORE INSERT OR UPDATE ON casa_de_paz_cargo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_de_paz_cargo BEFORE DELETE ON casa_de_paz_cargo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_validar_cdp_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo VARCHAR;
BEGIN
  SELECT codigo INTO v_codigo FROM cargo WHERE id = NEW.cargo_id;

  IF v_codigo IN ('LIDER_CDP', 'ANFITRION') AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM casa_de_paz_cargo cc
      WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND cc.cargo_id = NEW.cargo_id
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        AND cc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'CDP_CARGO_DUPLICADO: la casa de paz % ya tiene un % vigente', NEW.casa_de_paz_id, v_codigo
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- SUBLIDER_CDP no tiene limite: de 0 a infinito
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_cdp_cargo
  BEFORE INSERT OR UPDATE ON casa_de_paz_cargo
  FOR EACH ROW EXECUTE FUNCTION fn_validar_cdp_cargo();

CREATE TABLE casa_de_paz_membresia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  persona_id      UUID NOT NULL REFERENCES persona(id),
  es_principal    BOOLEAN NOT NULL DEFAULT true,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_membresia_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_membresia_principal_vigente
  ON casa_de_paz_membresia (persona_id) WHERE es_principal AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_casa_de_paz_membresia BEFORE INSERT OR UPDATE ON casa_de_paz_membresia FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_de_paz_membresia BEFORE DELETE ON casa_de_paz_membresia FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE ministerio (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  codigo      VARCHAR(40) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_ministerio_codigo_iglesia ON ministerio (iglesia_id, codigo) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_ministerio BEFORE INSERT OR UPDATE ON ministerio FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_ministerio BEFORE DELETE ON ministerio FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE ministerio_persona (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id     UUID NOT NULL REFERENCES iglesia(id),
  ministerio_id  UUID NOT NULL REFERENCES ministerio(id),
  persona_id     UUID NOT NULL REFERENCES persona(id),
  es_lider       BOOLEAN NOT NULL DEFAULT false,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_ministerio_persona_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_ministerio_lider_vigente ON ministerio_persona (ministerio_id) WHERE es_lider AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_ministerio_persona BEFORE INSERT OR UPDATE ON ministerio_persona FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_ministerio_persona BEFORE DELETE ON ministerio_persona FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Cruce red x ministerio, con "Sin Red" para quien sirve sin CdP asignada
-- (decision del owner, PENDIENTES.md #6, 2026-07-17).
CREATE OR REPLACE FUNCTION fn_ministerio_por_red(p_iglesia_id UUID)
RETURNS TABLE (red_nombre VARCHAR, ministerio_nombre VARCHAR, cantidad BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(r.nombre, 'Sin Red'), m.nombre, count(DISTINCT mp.persona_id)
  FROM ministerio_persona mp
  JOIN ministerio m ON m.id = mp.ministerio_id
  LEFT JOIN casa_de_paz_membresia mem ON mem.persona_id = mp.persona_id
       AND mem.es_principal AND mem.fecha_fin IS NULL AND mem.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = mem.casa_de_paz_id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE mp.iglesia_id = p_iglesia_id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
  GROUP BY r.nombre, m.nombre
  ORDER BY COALESCE(r.nombre, 'Sin Red'), m.nombre;
$$;

CREATE TABLE departamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  codigo      VARCHAR(20) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_departamento BEFORE INSERT OR UPDATE ON departamento FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_departamento BEFORE DELETE ON departamento FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Redes incompletas: regla blanda (avisa, no bloquea)
CREATE OR REPLACE FUNCTION fn_redes_incompletas(p_iglesia_id UUID)
RETURNS TABLE (red_id UUID, red_nombre VARCHAR, falta_departamentos BOOLEAN, falta_ministerio BOOLEAN)
LANGUAGE sql STABLE
AS $$
  SELECT r.id, r.nombre,
         NOT EXISTS (SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
                     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
                       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL),
         NOT EXISTS (SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
                     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_MINISTERIO_RED'
                       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL)
  FROM red r
  WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL;
$$;

CREATE OR REPLACE FUNCTION fn_validar_red_desactivacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.activo AND NOT NEW.activo THEN
    IF EXISTS (
      SELECT 1 FROM casa_de_paz_red cdr
      JOIN casa_de_paz c ON c.id = cdr.casa_de_paz_id
      WHERE cdr.red_id = NEW.id AND cdr.fecha_fin IS NULL AND c.activo AND c.fecha_eliminacion IS NULL
    ) THEN
      RAISE EXCEPTION 'RED_CON_CDP_ACTIVAS: la red % tiene casas de paz vigentes; reasignelas antes de desactivar', NEW.nombre
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_red_desactivacion
  BEFORE UPDATE ON red
  FOR EACH ROW EXECUTE FUNCTION fn_validar_red_desactivacion();

CREATE OR REPLACE FUNCTION fn_cdp_desactivacion_cierra_membresias()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.activo AND NOT NEW.activo THEN
    UPDATE casa_de_paz_membresia SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = NEW.id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cdp_desactivacion_cierra_membresias
  BEFORE UPDATE ON casa_de_paz
  FOR EACH ROW EXECUTE FUNCTION fn_cdp_desactivacion_cierra_membresias();

-- Cierra el ciclo 2
ALTER TABLE direccion_asignacion ADD COLUMN casa_de_paz_id UUID REFERENCES casa_de_paz(id);
ALTER TABLE direccion_asignacion ADD CONSTRAINT chk_direccion_una_sola_entidad CHECK (
  (persona_id IS NOT NULL)::int + (iglesia_ref_id IS NOT NULL)::int + (casa_de_paz_id IS NOT NULL)::int = 1
);

ALTER TABLE telefono_asignacion ADD COLUMN casa_de_paz_id UUID REFERENCES casa_de_paz(id);
ALTER TABLE telefono_asignacion ADD CONSTRAINT chk_telefono_una_sola_entidad CHECK (
  (persona_id IS NOT NULL)::int + (iglesia_ref_id IS NOT NULL)::int + (casa_de_paz_id IS NOT NULL)::int = 1
);
