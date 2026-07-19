-- VisionHub -- 34_multiplicacion.sql
-- Panel de Multiplicacion: cuando una Casa de Paz o una Red crece y se
-- divide en 2, la iglesia lo llama "multiplicacion", no "division". La
-- entidad original SIGUE SIENDO la misma (mismo id, mismo historial) y se
-- queda con quien no se mueve; la nueva entidad es la que se crea, y se le
-- asignan los miembros/Casas de Paz elegidos y (opcional) su lider. A
-- diferencia de la fusion, la multiplicacion no tiene "deshacer": es un
-- registro append-only de historial, sin ventana de reversion.

-- ============================================================
-- 1. Multiplicacion de Casa de Paz
-- ============================================================
CREATE TABLE multiplicacion_casa_de_paz (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_origen_id UUID NOT NULL REFERENCES casa_de_paz(id),
  casa_de_paz_nueva_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  cantidad_movidos      SMALLINT NOT NULL,
  fecha_multiplicacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo                TEXT NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_multiplicacion_cdp_distintas CHECK (casa_de_paz_origen_id <> casa_de_paz_nueva_id),
  CONSTRAINT chk_multiplicacion_cdp_motivo CHECK (btrim(motivo) <> ''),
  CONSTRAINT chk_multiplicacion_cdp_cantidad CHECK (cantidad_movidos > 0)
);

CREATE TRIGGER trg_auditoria_multiplicacion_casa_de_paz BEFORE INSERT OR UPDATE ON multiplicacion_casa_de_paz FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_multiplicacion_casa_de_paz BEFORE DELETE ON multiplicacion_casa_de_paz FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE multiplicacion_casa_de_paz ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_multiplicacion_cdp_select ON multiplicacion_casa_de_paz
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);
-- Sin policy de INSERT: todo pasa por fn_multiplicar_cdp (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION fn_multiplicar_cdp(
  p_origen_id UUID,
  p_nombre_nueva VARCHAR,
  p_persona_ids UUID[],
  p_lider_nuevo_id UUID,
  p_motivo TEXT,
  p_pin TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_red_id UUID;
  v_nueva_id UUID;
  v_cantidad SMALLINT;
  v_cargo_lider_id UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'MULTIPLICACION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la multiplicacion' USING ERRCODE = 'P0001';
  END IF;
  IF p_persona_ids IS NULL OR array_length(p_persona_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_MIEMBROS: hay que elegir al menos una persona que se va a la nueva Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_origen_id AND fecha_eliminacion IS NULL AND activo;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_CDP_INEXISTENTE: la casa de paz de origen no existe o esta inactiva' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO casa_de_paz (iglesia_id, nombre)
  VALUES (v_iglesia_id, NULLIF(btrim(p_nombre_nueva), ''))
  RETURNING id INTO v_nueva_id;

  IF v_red_id IS NOT NULL THEN
    INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
    VALUES (v_iglesia_id, v_nueva_id, v_red_id, CURRENT_DATE);
  END IF;

  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND persona_id = ANY(p_persona_ids)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  GET DIAGNOSTICS v_cantidad = ROW_COUNT;

  IF v_cantidad = 0 THEN
    RAISE EXCEPTION 'MULTIPLICACION_MIEMBROS_INVALIDOS: ninguna de las personas elegidas es miembro vigente de esta Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  SELECT v_iglesia_id, v_nueva_id, m.persona_id, m.es_principal, CURRENT_DATE
  FROM casa_de_paz_membresia m
  WHERE m.casa_de_paz_id = p_origen_id AND m.persona_id = ANY(p_persona_ids)
    AND m.fecha_fin = CURRENT_DATE AND m.fecha_eliminacion IS NULL;

  IF p_lider_nuevo_id IS NOT NULL THEN
    SELECT id INTO v_cargo_lider_id FROM cargo WHERE codigo = 'LIDER_CDP' AND activo LIMIT 1;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_iglesia_id, v_nueva_id, p_lider_nuevo_id, v_cargo_lider_id, CURRENT_DATE);
  END IF;

  INSERT INTO multiplicacion_casa_de_paz (iglesia_id, casa_de_paz_origen_id, casa_de_paz_nueva_id, cantidad_movidos, motivo)
  VALUES (v_iglesia_id, p_origen_id, v_nueva_id, v_cantidad, p_motivo);

  RETURN v_nueva_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_listar_multiplicaciones_cdp(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, fecha_multiplicacion TIMESTAMPTZ, motivo TEXT, cantidad_movidos SMALLINT,
  origen_id UUID, origen_etiqueta TEXT, nueva_id UUID, nueva_etiqueta TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    m.id, m.fecha_multiplicacion, m.motivo, m.cantidad_movidos,
    m.casa_de_paz_origen_id, fn_etiqueta_cdp(m.casa_de_paz_origen_id),
    m.casa_de_paz_nueva_id, fn_etiqueta_cdp(m.casa_de_paz_nueva_id)
  FROM multiplicacion_casa_de_paz m
  WHERE m.iglesia_id = p_iglesia_id AND m.fecha_eliminacion IS NULL
  ORDER BY m.fecha_multiplicacion DESC;
$$;

-- ============================================================
-- 2. Multiplicacion de Red -- solo Pastor/Supervisor, mismo criterio que la
-- fusion de Red (nunca el Lider de Red por si solo).
-- ============================================================
CREATE TABLE multiplicacion_red (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id           UUID NOT NULL REFERENCES iglesia(id),
  red_origen_id        UUID NOT NULL REFERENCES red(id),
  red_nueva_id         UUID NOT NULL REFERENCES red(id),
  cantidad_movidas     SMALLINT NOT NULL,
  fecha_multiplicacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo               TEXT NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_multiplicacion_red_distintas CHECK (red_origen_id <> red_nueva_id),
  CONSTRAINT chk_multiplicacion_red_motivo CHECK (btrim(motivo) <> ''),
  CONSTRAINT chk_multiplicacion_red_cantidad CHECK (cantidad_movidas > 0)
);

CREATE TRIGGER trg_auditoria_multiplicacion_red BEFORE INSERT OR UPDATE ON multiplicacion_red FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_multiplicacion_red BEFORE DELETE ON multiplicacion_red FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE multiplicacion_red ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_multiplicacion_red_select ON multiplicacion_red
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE OR REPLACE FUNCTION fn_multiplicar_red(
  p_origen_id UUID,
  p_nombre_nueva VARCHAR,
  p_cdp_ids UUID[],
  p_lider_nuevo_id UUID,
  p_motivo TEXT,
  p_pin TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_nueva_id UUID;
  v_cantidad SMALLINT;
  v_cargo_lider_id UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'MULTIPLICACION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la multiplicacion' USING ERRCODE = 'P0001';
  END IF;
  IF p_nombre_nueva IS NULL OR btrim(p_nombre_nueva) = '' THEN
    RAISE EXCEPTION 'MULTIPLICACION_NOMBRE_OBLIGATORIO: la red nueva necesita un nombre' USING ERRCODE = 'P0001';
  END IF;
  IF p_cdp_ids IS NULL OR array_length(p_cdp_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_CDP: hay que elegir al menos una Casa de Paz que se va a la nueva Red' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_origen_id AND fecha_eliminacion IS NULL AND activo;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MULTIPLICACION_RED_INEXISTENTE: la red de origen no existe o esta inactiva' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_operativo_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'MULTIPLICACION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden multiplicar redes'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO red (iglesia_id, nombre) VALUES (v_iglesia_id, btrim(p_nombre_nueva)) RETURNING id INTO v_nueva_id;

  UPDATE casa_de_paz_red
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND casa_de_paz_id = ANY(p_cdp_ids)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  GET DIAGNOSTICS v_cantidad = ROW_COUNT;

  IF v_cantidad = 0 THEN
    RAISE EXCEPTION 'MULTIPLICACION_CDP_INVALIDAS: ninguna de las Casas de Paz elegidas pertenece a esta Red' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
  SELECT v_iglesia_id, cdr.casa_de_paz_id, v_nueva_id, CURRENT_DATE
  FROM casa_de_paz_red cdr
  WHERE cdr.red_id = p_origen_id AND cdr.casa_de_paz_id = ANY(p_cdp_ids)
    AND cdr.fecha_fin = CURRENT_DATE AND cdr.fecha_eliminacion IS NULL;

  IF p_lider_nuevo_id IS NOT NULL THEN
    SELECT id INTO v_cargo_lider_id FROM cargo WHERE codigo = 'LIDER_RED' AND activo LIMIT 1;
    INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_iglesia_id, v_nueva_id, p_lider_nuevo_id, v_cargo_lider_id, CURRENT_DATE);
  END IF;

  INSERT INTO multiplicacion_red (iglesia_id, red_origen_id, red_nueva_id, cantidad_movidas, motivo)
  VALUES (v_iglesia_id, p_origen_id, v_nueva_id, v_cantidad, p_motivo);

  RETURN v_nueva_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_listar_multiplicaciones_red(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, fecha_multiplicacion TIMESTAMPTZ, motivo TEXT, cantidad_movidas SMALLINT,
  origen_id UUID, origen_nombre VARCHAR, nueva_id UUID, nueva_nombre VARCHAR
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    m.id, m.fecha_multiplicacion, m.motivo, m.cantidad_movidas,
    m.red_origen_id, ro.nombre, m.red_nueva_id, rn.nombre
  FROM multiplicacion_red m
  JOIN red ro ON ro.id = m.red_origen_id
  JOIN red rn ON rn.id = m.red_nueva_id
  WHERE m.iglesia_id = p_iglesia_id AND m.fecha_eliminacion IS NULL
  ORDER BY m.fecha_multiplicacion DESC;
$$;
