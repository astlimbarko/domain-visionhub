-- VisionHub -- 14_finanzas.sql
-- Ofrendas/diezmos. moneda_id reemplaza a moneda_enum (ver 03_tenancy.sql).

CREATE TABLE finanzas_tipo_ingreso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID REFERENCES iglesia(id),
  codigo      VARCHAR(30) NOT NULL,
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

CREATE UNIQUE INDEX uq_tipo_ingreso_codigo
  ON finanzas_tipo_ingreso (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo)
  WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_finanzas_tipo_ingreso BEFORE INSERT OR UPDATE ON finanzas_tipo_ingreso FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_finanzas_tipo_ingreso BEFORE DELETE ON finanzas_tipo_ingreso FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE finanzas_ingreso (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id       UUID NOT NULL REFERENCES iglesia(id),
  tipo_ingreso_id  UUID NOT NULL REFERENCES finanzas_tipo_ingreso(id),
  reporte_id       UUID REFERENCES casa_de_paz_reporte(id),
  casa_de_paz_id   UUID REFERENCES casa_de_paz(id),
  persona_id       UUID REFERENCES persona(id),
  monto            NUMERIC(12,2) NOT NULL,
  moneda_id        UUID NOT NULL REFERENCES moneda(id),
  fecha            DATE NOT NULL,
  observaciones    TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_ingreso_monto CHECK (monto > 0),
  CONSTRAINT chk_ingreso_fecha CHECK (fecha <= CURRENT_DATE)
);

CREATE INDEX idx_ingreso_cdp_fecha ON finanzas_ingreso (casa_de_paz_id, fecha) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_ingreso_reporte ON finanzas_ingreso (reporte_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_finanzas_ingreso BEFORE INSERT OR UPDATE ON finanzas_ingreso FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_finanzas_ingreso BEFORE DELETE ON finanzas_ingreso FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_ingreso_moneda_defecto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.moneda_id IS NULL THEN
    SELECT moneda_defecto_id INTO NEW.moneda_id FROM iglesia WHERE id = NEW.iglesia_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ingreso_moneda_defecto
  BEFORE INSERT ON finanzas_ingreso
  FOR EACH ROW EXECUTE FUNCTION fn_ingreso_moneda_defecto();

-- Solo monedas activadas por la iglesia (mirar.txt #2, 2026-07-19)
CREATE OR REPLACE FUNCTION fn_validar_moneda_activa_iglesia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM iglesia_moneda im
    WHERE im.iglesia_id = NEW.iglesia_id AND im.moneda_id = NEW.moneda_id AND im.activa AND im.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'MONEDA_NO_ACTIVA: la moneda % no esta activada para esta iglesia', NEW.moneda_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_moneda_activa
  BEFORE INSERT OR UPDATE ON finanzas_ingreso
  FOR EACH ROW EXECUTE FUNCTION fn_validar_moneda_activa_iglesia();

CREATE OR REPLACE FUNCTION fn_ingresos_cdp(p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (tipo_codigo VARCHAR, tipo_nombre VARCHAR, moneda_codigo CHAR(3), moneda_simbolo VARCHAR, total NUMERIC)
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
  SELECT t.codigo, t.nombre, m.codigo, m.simbolo, sum(i.monto)
  FROM finanzas_ingreso i
  JOIN finanzas_tipo_ingreso t ON t.id = i.tipo_ingreso_id
  JOIN moneda m ON m.id = i.moneda_id
  WHERE i.casa_de_paz_id = p_casa_de_paz_id AND i.fecha BETWEEN p_desde AND p_hasta AND i.fecha_eliminacion IS NULL
  GROUP BY t.codigo, t.nombre, m.codigo, m.simbolo, t.orden, m.orden
  ORDER BY t.orden, m.orden;
END;
$$;

CREATE OR REPLACE FUNCTION fn_ingresos_red(p_red_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (casa_de_paz_nombre VARCHAR, tipo_codigo VARCHAR, moneda_codigo CHAR(3), moneda_simbolo VARCHAR, total NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT c.nombre, t.codigo, m.codigo, m.simbolo, sum(i.monto)
  FROM finanzas_ingreso i
  JOIN finanzas_tipo_ingreso t ON t.id = i.tipo_ingreso_id
  JOIN moneda m ON m.id = i.moneda_id
  JOIN casa_de_paz c ON c.id = i.casa_de_paz_id
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  WHERE cdr.red_id = p_red_id AND i.fecha BETWEEN p_desde AND p_hasta AND i.fecha_eliminacion IS NULL
  GROUP BY c.nombre, t.codigo, m.codigo, m.simbolo, t.orden, m.orden
  ORDER BY c.nombre, t.orden, m.orden;
END;
$$;

CREATE OR REPLACE FUNCTION fn_ingresos_comparativo(p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (moneda_id UUID, moneda_codigo CHAR(3), total_actual NUMERIC, total_anterior NUMERIC, variacion_pct NUMERIC)
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
  WITH
  dias AS (SELECT (p_hasta - p_desde) AS n),
  actual AS (
    SELECT i.moneda_id, sum(i.monto) AS total FROM finanzas_ingreso i
    WHERE i.casa_de_paz_id = p_casa_de_paz_id AND i.fecha BETWEEN p_desde AND p_hasta AND i.fecha_eliminacion IS NULL
    GROUP BY i.moneda_id
  ),
  anterior AS (
    SELECT i.moneda_id, sum(i.monto) AS total FROM finanzas_ingreso i, dias d
    WHERE i.casa_de_paz_id = p_casa_de_paz_id AND i.fecha BETWEEN (p_desde - d.n - 1) AND (p_desde - 1) AND i.fecha_eliminacion IS NULL
    GROUP BY i.moneda_id
  ),
  monedas AS (SELECT moneda_id FROM actual UNION SELECT moneda_id FROM anterior)
  SELECT mo.moneda_id, m.codigo,
         COALESCE(a.total, 0), COALESCE(p.total, 0),
         CASE WHEN COALESCE(p.total, 0) = 0 THEN NULL ELSE round(((COALESCE(a.total,0) - p.total) / p.total) * 100, 2) END
  FROM monedas mo
  JOIN moneda m ON m.id = mo.moneda_id
  LEFT JOIN actual a ON a.moneda_id = mo.moneda_id
  LEFT JOIN anterior p ON p.moneda_id = mo.moneda_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_upsert_ingreso_reporte(p_reporte_id UUID, p_tipo VARCHAR, p_monto NUMERIC, p_moneda_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte casa_de_paz_reporte;
  v_tipo_id UUID;
  v_existente UUID;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  SELECT id INTO v_tipo_id FROM finanzas_tipo_ingreso
  WHERE codigo = p_tipo AND (iglesia_id = v_reporte.iglesia_id OR iglesia_id IS NULL)
  ORDER BY iglesia_id NULLS LAST LIMIT 1;

  SELECT id INTO v_existente FROM finanzas_ingreso
  WHERE reporte_id = p_reporte_id AND tipo_ingreso_id = v_tipo_id AND moneda_id = p_moneda_id
    AND persona_id IS NULL AND fecha_eliminacion IS NULL;

  IF COALESCE(p_monto, 0) = 0 THEN
    IF v_existente IS NOT NULL THEN
      UPDATE finanzas_ingreso SET fecha_eliminacion = now() WHERE id = v_existente;
    END IF;
    RETURN;
  END IF;

  IF v_existente IS NOT NULL THEN
    UPDATE finanzas_ingreso SET monto = p_monto WHERE id = v_existente;
  ELSE
    INSERT INTO finanzas_ingreso (iglesia_id, tipo_ingreso_id, reporte_id, casa_de_paz_id, monto, moneda_id, fecha)
    VALUES (v_reporte.iglesia_id, v_tipo_id, p_reporte_id, v_reporte.casa_de_paz_id, p_monto, p_moneda_id, v_reporte.fecha_reunion);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_registrar_ingresos_reporte(
  p_reporte_id UUID, p_total_ofrendas NUMERIC, p_total_diezmos NUMERIC, p_moneda_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte casa_de_paz_reporte;
  v_moneda_id UUID;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  IF NOT fn_puede_reportar_cdp(v_reporte.casa_de_paz_id) THEN
    RAISE EXCEPTION 'INGRESO_SIN_PERMISO: no puede registrar ingresos de esta casa de paz'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(p_moneda_id, moneda_defecto_id) INTO v_moneda_id FROM iglesia WHERE id = v_reporte.iglesia_id;

  PERFORM fn_upsert_ingreso_reporte(p_reporte_id, 'OFRENDA', p_total_ofrendas, v_moneda_id);
  PERFORM fn_upsert_ingreso_reporte(p_reporte_id, 'DIEZMO',  p_total_diezmos,  v_moneda_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_reporte_cascada_ingresos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_eliminacion IS NOT NULL AND OLD.fecha_eliminacion IS NULL THEN
    UPDATE finanzas_ingreso SET fecha_eliminacion = now() WHERE reporte_id = NEW.id AND fecha_eliminacion IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reporte_cascada_ingresos
  AFTER UPDATE ON casa_de_paz_reporte
  FOR EACH ROW EXECUTE FUNCTION fn_reporte_cascada_ingresos();

-- NOTA: fn_puede_ver_ingresos_cdp se crea en 15_permisos.sql: es LANGUAGE SQL
-- y llama a fn_es_lider_cdp/fn_es_sublider_cdp, que no existen todavia aqui.
