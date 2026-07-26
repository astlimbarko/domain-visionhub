-- VisionHub -- 47_departamento_cargo.sql
-- 14-afirmacion. Modelo de asignacion departamental: persona + departamento +
-- cargo (reutiliza LIDER_DEPARTAMENTO, ya sembrado) + iglesia. NO se agrega
-- ningun valor a rol_sistema_enum -- el acceso a Afirmacion (y a futuros
-- departamentos) se deriva de esta tabla, no de un rol rigido. Mismo patron
-- que red_cargo/casa_de_paz_cargo (08_estructura.sql).

CREATE TABLE departamento_cargo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  departamento_id UUID NOT NULL REFERENCES departamento(id),
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
  CONSTRAINT chk_departamento_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- Un solo lider vigente por departamento (mismo patron que
-- uq_ministerio_lider_vigente / uq_cdp_cargo_vigente para LIDER_CDP).
CREATE UNIQUE INDEX uq_departamento_cargo_lider_vigente
  ON departamento_cargo (departamento_id, cargo_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE INDEX idx_departamento_cargo_iglesia ON departamento_cargo (iglesia_id) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_departamento_cargo_persona ON departamento_cargo (persona_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_departamento_cargo BEFORE INSERT OR UPDATE ON departamento_cargo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_departamento_cargo BEFORE DELETE ON departamento_cargo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Validacion: la persona y el departamento deben pertenecer a la misma
-- iglesia que NEW.iglesia_id, y el cargo debe ser LIDER_DEPARTAMENTO (unico
-- cargo departamental que existe hoy). Mismo patron que fn_validar_persona_cargo.
CREATE OR REPLACE FUNCTION fn_validar_departamento_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_iglesia_persona      UUID;
  v_iglesia_departamento UUID;
  v_codigo_cargo         VARCHAR;
BEGIN
  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_departamento FROM departamento WHERE id = NEW.departamento_id;
  IF v_iglesia_departamento IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_IGLESIA_DISTINTA: el departamento % no pertenece a la iglesia %',
      NEW.departamento_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  SELECT codigo INTO v_codigo_cargo FROM cargo WHERE id = NEW.cargo_id;
  IF v_codigo_cargo IS DISTINCT FROM 'LIDER_DEPARTAMENTO' THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_INVALIDO: el cargo % no es un cargo departamental valido', v_codigo_cargo
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_departamento_cargo
  BEFORE INSERT OR UPDATE ON departamento_cargo
  FOR EACH ROW EXECUTE FUNCTION fn_validar_departamento_cargo();

-- ============================================================
-- RLS: lectura por iglesia; escritura solo Pastor/Supervisor (hoy solo
-- Supervisor, fn_es_operativo_en ya no incluye a Pastor desde 43_). La
-- designacion real de esta primera entrega se hace por DB (bootstrap),
-- igual que el primer SUPER_ADMIN -- ver Fase A3 del implementation-plan.
-- ============================================================

ALTER TABLE departamento_cargo ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_departamento_cargo_select ON departamento_cargo
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_departamento_cargo_insert ON departamento_cargo
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

CREATE POLICY pol_departamento_cargo_update ON departamento_cargo
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id))
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));
