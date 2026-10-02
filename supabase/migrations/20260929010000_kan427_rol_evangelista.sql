-- KAN-427: rol "Evangelista" -- capacidad ortogonal otorgable a cualquier
-- Persona (con o sin cargo estructural), NO relacionada con el efesio
-- "Evangelista" del censo (persona_censo_membresia.efesio_tipo, dato
-- descriptivo sin ningun acceso al sistema -- ver Glosario de
-- harness/19-evangelista-personal/requirements.md).
--
-- Mismo patron que colaborador_codigo/colaborador_sesion (KAN-405) y
-- persona_proceso_afirmacion (KAN-481): trigger fn_auditoria() para
-- creado_por/fecha_creacion, RLS habilitado SIN policies para
-- `authenticated` -- todo el acceso pasa por RPC SECURITY DEFINER, nunca
-- por escritura directa via PostgREST.
--
-- Nombre de tabla `persona_evangelista` (no reusar el codigo EVANGELISTA
-- de cargo/efesio_tipo, evita cualquier colision de grep/lectura futura
-- con el censo -- aclaracion del owner, 2026-09-29).

CREATE TABLE persona_evangelista (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          UUID NOT NULL REFERENCES persona(id),
  iglesia_id          UUID NOT NULL REFERENCES iglesia(id),
  activo              BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por          UUID REFERENCES auth.users(id),
  fecha_actualizacion TIMESTAMPTZ,
  actualizado_por     UUID REFERENCES auth.users(id),
  fecha_eliminacion   TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_persona_evangelista ON persona_evangelista (persona_id, iglesia_id)
  WHERE fecha_eliminacion IS NULL;
CREATE INDEX ix_persona_evangelista_iglesia ON persona_evangelista (iglesia_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_persona_evangelista
  BEFORE INSERT OR UPDATE ON persona_evangelista FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_evangelista
  BEFORE DELETE ON persona_evangelista FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE persona_evangelista ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Capacidad: ¿la persona que llama es Evangelista en esta iglesia?
-- ============================================================
CREATE OR REPLACE FUNCTION fn_es_evangelista_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona_evangelista
    WHERE persona_id = fn_mi_persona_id() AND iglesia_id = p_iglesia_id
      AND activo AND fecha_eliminacion IS NULL
  );
$$;

-- ============================================================
-- Permiso para otorgar/revocar el rol -- confirmado con el owner
-- (2026-09-29): NO es un solo cargo, son varios en simultaneo. El chequeo
-- de Lider/Sublider de CdP se arma inline (iglesia-wide) en vez de llamar
-- a fn_es_lider_cdp/fn_es_sublider_cdp (esas toman un casa_de_paz_id
-- puntual, no sirven aca) -- mismo criterio EXISTS que esas funciones,
-- solo que sin acotar a una CdP. fn_es_lider_de_red_en_iglesia ya cubre
-- Lider Y Supervisor de Red (paridad completa, ver
-- harness/11-esquema-bd/sql/91_fn_es_lider_de_red_incluye_sublider.sql).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_puede_otorgar_evangelista(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    fn_es_operativo_en(p_iglesia_id)
    OR fn_es_lider_evangelismo_en(p_iglesia_id)
    OR fn_es_lider_de_red_en_iglesia(p_iglesia_id)
    OR EXISTS (
      SELECT 1 FROM casa_de_paz_cargo cc
      JOIN cargo c ON c.id = cc.cargo_id
      JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
      WHERE cdp.iglesia_id = p_iglesia_id AND cc.persona_id = fn_mi_persona_id()
        AND c.codigo IN ('LIDER_CDP', 'SUBLIDER_CDP')
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    );
$$;

-- ============================================================
-- Otorgar el rol -- requiere que la persona ya pertenezca, como miembro
-- activo, a alguna Casa de Paz (Requisito 1, AC 2.1, confirmado
-- 2026-09-29). La excepcion de Efesios sin CdP (Requisito 9) queda fuera
-- de alcance de este momento -- no se implementa aca todavia.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_otorgar_evangelista(p_persona_id UUID, p_iglesia_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT fn_puede_otorgar_evangelista(p_iglesia_id) THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_PERMISO: no tiene permiso para otorgar este rol' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM persona WHERE id = p_persona_id AND iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'EVANGELISTA_PERSONA_INEXISTENTE: la persona no existe en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM casa_de_paz_membresia
    WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_CDP: la persona no pertenece a ninguna Casa de Paz todavia -- no se le puede otorgar el rol Evangelista' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona_evangelista (persona_id, iglesia_id, activo)
  VALUES (p_persona_id, p_iglesia_id, true)
  ON CONFLICT (persona_id, iglesia_id) WHERE fecha_eliminacion IS NULL
  DO UPDATE SET activo = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_revocar_evangelista(p_persona_id UUID, p_iglesia_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_puede_otorgar_evangelista(p_iglesia_id) THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_PERMISO: no tiene permiso para revocar este rol' USING ERRCODE = 'P0001';
  END IF;

  UPDATE persona_evangelista SET activo = false
  WHERE persona_id = p_persona_id AND iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_es_evangelista_en(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_puede_otorgar_evangelista(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_otorgar_evangelista(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_revocar_evangelista(UUID, UUID) TO authenticated;
