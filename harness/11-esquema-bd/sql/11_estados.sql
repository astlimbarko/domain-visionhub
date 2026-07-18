-- VisionHub -- 11_estados.sql
-- Estados SSVA: SIM, NC, CRE, RE activos; DA, DI sembrados inactivos (Modulo 4).
-- RE -> CRE confirmado por el owner (PENDIENTES.md #2, 2026-07-17).

CREATE TABLE estado (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla        VARCHAR(5) NOT NULL UNIQUE,
  nombre       VARCHAR(50) NOT NULL,
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  orden        SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_estado BEFORE INSERT OR UPDATE ON estado FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_estado BEFORE DELETE ON estado FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE persona_estado (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  persona_id    UUID NOT NULL REFERENCES persona(id),
  estado_id     UUID NOT NULL REFERENCES estado(id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  motivo        VARCHAR(200),
  es_automatico BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_persona_estado_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_persona_estado_vigente ON persona_estado (persona_id) WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;
CREATE INDEX idx_persona_estado_persona ON persona_estado (persona_id, fecha_inicio DESC);

CREATE TRIGGER trg_auditoria_persona_estado BEFORE INSERT OR UPDATE ON persona_estado FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_estado BEFORE DELETE ON persona_estado FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_validar_estado_activo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_sigla VARCHAR; v_activo BOOLEAN;
BEGIN
  SELECT sigla, activo INTO v_sigla, v_activo FROM estado WHERE id = NEW.estado_id;
  IF NOT v_activo THEN
    RAISE EXCEPTION 'ESTADO_NO_DISPONIBLE: el estado % no esta activo en este modulo', v_sigla
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_estado_activo
  BEFORE INSERT OR UPDATE ON persona_estado
  FOR EACH ROW EXECUTE FUNCTION fn_validar_estado_activo();

CREATE OR REPLACE FUNCTION fn_transicionar_estado(
  p_persona_id UUID, p_sigla VARCHAR, p_fecha DATE, p_motivo VARCHAR, p_automatico BOOLEAN DEFAULT true
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_estado_id  UUID;
  v_iglesia_id UUID;
  v_actual     UUID;
BEGIN
  SELECT id INTO v_estado_id FROM estado WHERE sigla = p_sigla;
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id;

  SELECT estado_id INTO v_actual FROM persona_estado
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF v_actual = v_estado_id THEN RETURN; END IF;

  UPDATE persona_estado SET fecha_fin = p_fecha
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, motivo, es_automatico)
  VALUES (v_iglesia_id, p_persona_id, v_estado_id, p_fecha, p_motivo, p_automatico);
END;
$$;

CREATE TABLE migracion_propuesta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  persona_id      UUID NOT NULL REFERENCES persona(id),
  cdp_origen_id   UUID NOT NULL REFERENCES casa_de_paz(id),
  cdp_destino_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  visitas         SMALLINT NOT NULL,
  fecha_propuesta DATE NOT NULL,
  resuelta        BOOLEAN NOT NULL DEFAULT false,
  aceptada        BOOLEAN,
  resuelta_por    UUID REFERENCES auth.users(id),
  fecha_resolucion TIMESTAMPTZ,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_migracion_pendiente ON migracion_propuesta (persona_id, cdp_destino_id) WHERE NOT resuelta;

CREATE TRIGGER trg_auditoria_migracion_propuesta BEFORE INSERT OR UPDATE ON migracion_propuesta FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_migracion_propuesta BEFORE DELETE ON migracion_propuesta FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Definida antes que el disparador central, que la invoca.
CREATE OR REPLACE FUNCTION fn_evaluar_membresia_cdp(p_persona_id UUID, p_casa_de_paz_id UUID, p_fecha DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_visitas    INT;
  v_es_miembro BOOLEAN;
  v_principal  UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id;
  v_visitas := fn_visitas_consecutivas(p_persona_id, p_casa_de_paz_id);

  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_membresia
    WHERE persona_id = p_persona_id AND casa_de_paz_id = p_casa_de_paz_id
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) INTO v_es_miembro;

  SELECT casa_de_paz_id INTO v_principal FROM casa_de_paz_membresia
  WHERE persona_id = p_persona_id AND es_principal AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT v_es_miembro AND v_visitas >= fn_criterio(v_iglesia_id, 'VISITAS_PARA_MIEMBRO') THEN
    INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
    VALUES (v_iglesia_id, p_casa_de_paz_id, p_persona_id, v_principal IS NULL, p_fecha);
  END IF;

  IF v_principal IS NOT NULL AND v_principal <> p_casa_de_paz_id
     AND v_visitas >= fn_criterio(v_iglesia_id, 'VISITAS_PARA_MIGRAR') THEN
    INSERT INTO migracion_propuesta (iglesia_id, persona_id, cdp_origen_id, cdp_destino_id, visitas, fecha_propuesta)
    VALUES (v_iglesia_id, p_persona_id, v_principal, p_casa_de_paz_id, v_visitas, p_fecha)
    ON CONFLICT (persona_id, cdp_destino_id) WHERE resuelta = false DO NOTHING;
  END IF;
END;
$$;

-- Disparador central: todas las transiciones automaticas del Modulo 1.
CREATE OR REPLACE FUNCTION fn_evaluar_estado_por_asistencia()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte      casa_de_paz_reporte;
  v_persona      persona;
  v_estado_sigla VARCHAR;
  v_asistencia_previa DATE;
  v_dias_ausente INT;
  v_es_menor     BOOLEAN;
  v_edad_min     NUMERIC;
  v_visitas      INT;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = NEW.reporte_id;
  SELECT * INTO v_persona FROM persona WHERE id = NEW.persona_id;

  SELECT e.sigla INTO v_estado_sigla
  FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
  WHERE pe.persona_id = NEW.persona_id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL;

  -- 1. RECONCILIADO: se evalua primero, tiene prioridad sobre NC/RE -> CRE
  SELECT MAX(r2.fecha_reunion) INTO v_asistencia_previa
  FROM casa_de_paz_asistencia a2 JOIN casa_de_paz_reporte r2 ON r2.id = a2.reporte_id
  WHERE a2.persona_id = NEW.persona_id AND a2.id <> NEW.id AND a2.fecha_eliminacion IS NULL
    AND r2.fecha_reunion < v_reporte.fecha_reunion;

  IF v_asistencia_previa IS NOT NULL THEN
    v_dias_ausente := v_reporte.fecha_reunion - v_asistencia_previa;

    IF v_dias_ausente >= fn_criterio(v_persona.iglesia_id, 'DIAS_PARA_RE') THEN
      PERFORM fn_transicionar_estado(NEW.persona_id, 'RE', v_reporte.fecha_reunion,
        format('Retorno tras %s dias sin asistir', v_dias_ausente), true);
      PERFORM fn_evaluar_membresia_cdp(NEW.persona_id, v_reporte.casa_de_paz_id, v_reporte.fecha_reunion);
      RETURN NEW;
    END IF;
  END IF;

  -- 2. NC/RE -> CRE con 2 visitas consecutivas (RE->CRE confirmado, PENDIENTES.md #2)
  IF v_estado_sigla IN ('NC', 'RE') THEN
    v_edad_min := fn_criterio(v_persona.iglesia_id, 'EDAD_MINIMA_CREYENTE');

    IF v_persona.fecha_nacimiento IS NOT NULL THEN
      v_es_menor := EXTRACT(YEAR FROM age(v_reporte.fecha_reunion, v_persona.fecha_nacimiento)) < v_edad_min;
    ELSE
      v_es_menor := COALESCE(NEW.es_menor, true);
    END IF;

    IF NOT v_es_menor THEN
      v_visitas := fn_visitas_consecutivas(NEW.persona_id, v_reporte.casa_de_paz_id);
      IF v_visitas >= fn_criterio(v_persona.iglesia_id, 'VISITAS_PARA_CRE') THEN
        PERFORM fn_transicionar_estado(NEW.persona_id, 'CRE', v_reporte.fecha_reunion,
          format('%s visitas consecutivas', v_visitas), true);
      END IF;
    END IF;
  END IF;

  -- 3. Membresia y migracion
  PERFORM fn_evaluar_membresia_cdp(NEW.persona_id, v_reporte.casa_de_paz_id, v_reporte.fecha_reunion);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evaluar_estado
  AFTER INSERT ON casa_de_paz_asistencia
  FOR EACH ROW EXECUTE FUNCTION fn_evaluar_estado_por_asistencia();

-- Semaforo de inactividad (dashboard del lider). NO es un estado del SSVA.
CREATE OR REPLACE FUNCTION fn_inactividad_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (
  persona_id UUID, nombre TEXT, ultima_asistencia DATE, reuniones_faltadas INT, supera_umbral BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH miembros AS (
    SELECT m.persona_id, m.iglesia_id FROM casa_de_paz_membresia m
    WHERE m.casa_de_paz_id = p_casa_de_paz_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  ),
  ultima AS (
    SELECT mi.persona_id, MAX(r.fecha_reunion) AS ultima_fecha
    FROM miembros mi
    LEFT JOIN casa_de_paz_asistencia a ON a.persona_id = mi.persona_id AND a.fecha_eliminacion IS NULL
    LEFT JOIN casa_de_paz_reporte r ON r.id = a.reporte_id AND r.casa_de_paz_id = p_casa_de_paz_id AND r.fecha_eliminacion IS NULL
    GROUP BY mi.persona_id
  )
  SELECT u.persona_id, fn_nombre_completo(p), u.ultima_fecha,
         (SELECT count(*)::int FROM casa_de_paz_reporte r2
          WHERE r2.casa_de_paz_id = p_casa_de_paz_id AND r2.fecha_eliminacion IS NULL
            AND (u.ultima_fecha IS NULL OR r2.fecha_reunion > u.ultima_fecha)) AS faltadas,
         (SELECT count(*) FROM casa_de_paz_reporte r3
          WHERE r3.casa_de_paz_id = p_casa_de_paz_id AND r3.fecha_eliminacion IS NULL
            AND (u.ultima_fecha IS NULL OR r3.fecha_reunion > u.ultima_fecha))
         >= fn_criterio(mi.iglesia_id, 'INASISTENCIAS_PARA_INACTIVO') AS supera_umbral
  FROM ultima u
  JOIN persona p ON p.id = u.persona_id
  JOIN miembros mi ON mi.persona_id = u.persona_id
  ORDER BY u.ultima_fecha NULLS FIRST;
END;
$$;
