-- VisionHub -- 58_solicitudes_estructura.sql
-- El Supervisor (SUPERVISOR_VISION_ACCION) ya podia fusionar/multiplicar
-- Casas de Paz y Redes, y designar Lider de Red/CdP, de forma directa e
-- instantanea (igual que Pastor). Pedido del owner (2026-07-31): esas
-- acciones estructurales, cuando las hace el Supervisor sobre una Red que
-- ya tiene Lider de Red vigente, dejan de aplicarse al instante -- generan
-- una solicitud pendiente que notifica a ese Lider de Red, quien la aprueba
-- o rechaza. El Pastor sigue actuando directo (autoridad superior al Lider
-- de Red) y el propio Lider de Red tambien sigue actuando directo sobre su
-- Red -- el gate solo alcanza al Supervisor, y solo cuando hay alguien a
-- quien pedirle autorizacion (Red sin Lider vigente = se aplica directo).

CREATE OR REPLACE FUNCTION fn_es_supervisor_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND iglesia_id = p_iglesia_id
      AND rol = 'SUPERVISOR_VISION_ACCION' AND fecha_eliminacion IS NULL
  );
$$;

CREATE TABLE solicitud_estructura (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id              UUID NOT NULL REFERENCES iglesia(id),
  red_id                  UUID NOT NULL REFERENCES red(id), -- red cuyo lider vigente debe aprobar
  tipo                    TEXT NOT NULL,
  payload                 JSONB NOT NULL,
  solicitante_persona_id  UUID NOT NULL REFERENCES persona(id),
  estado                  TEXT NOT NULL DEFAULT 'PENDIENTE',
  motivo_rechazo          TEXT,
  fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_resolucion        TIMESTAMPTZ,
  resuelta_por_persona_id UUID REFERENCES persona(id),
  CONSTRAINT chk_solicitud_estructura_tipo CHECK (
    tipo IN ('FUSIONAR_CDP', 'FUSIONAR_RED', 'MULTIPLICAR_CDP', 'MULTIPLICAR_RED', 'CAMBIAR_LIDER_RED', 'CAMBIAR_LIDER_CDP')
  ),
  CONSTRAINT chk_solicitud_estructura_estado CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA'))
);

CREATE INDEX idx_solicitud_estructura_red_pendiente ON solicitud_estructura (red_id) WHERE estado = 'PENDIENTE';

ALTER TABLE solicitud_estructura ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_solicitud_estructura_select ON solicitud_estructura
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()));
-- Sin INSERT/UPDATE directo: nace y se resuelve solo desde las funciones de abajo.

-- ============================================================
-- Gate en las 4 acciones existentes: se re-declaran completas (CREATE OR
-- REPLACE) agregando el chequeo de Supervisor + Lider vigente antes de
-- ejecutar. El resto del cuerpo es identico al de 30_fusiones_y_pin.sql /
-- 34_multiplicacion.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_fusionar_cdp(p_origen_id UUID, p_destino_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_iglesia_origen UUID;
  v_red_destino UUID;
  v_fusion_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
BEGIN
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'FUSION_MISMA_CDP: no se puede fusionar una casa de paz consigo misma' USING ERRCODE = 'P0001';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_destino_id AND fecha_eliminacion IS NULL;
  SELECT iglesia_id INTO v_iglesia_origen FROM casa_de_paz WHERE id = p_origen_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_origen IS NULL THEN
    RAISE EXCEPTION 'FUSION_CDP_INEXISTENTE: alguna de las casas de paz no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id IS DISTINCT FROM v_iglesia_origen THEN
    RAISE EXCEPTION 'FUSION_IGLESIAS_DISTINTAS: las dos casas de paz deben ser de la misma iglesia' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_destino FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_destino_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR (v_red_destino IS NOT NULL AND fn_es_lider_de_red(v_red_destino))) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: se requiere ser Lider de la Red destino, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  -- Gate: Supervisor (no Pastor, no el propio Lider de la Red destino) sobre
  -- una Red con Lider vigente -> queda pendiente de su autorizacion.
  IF v_red_destino IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_destino) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_destino AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_destino, 'FUSIONAR_CDP',
        jsonb_build_object('origen_id', p_origen_id, 'destino_id', p_destino_id, 'motivo', p_motivo), fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de fusión de Casas de Paz',
        'El Supervisor pidió fusionar dos Casas de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO fusion_casa_de_paz (iglesia_id, casa_de_paz_origen_id, casa_de_paz_destino_id, motivo)
  VALUES (v_iglesia_id, p_origen_id, p_destino_id, p_motivo)
  RETURNING id INTO v_fusion_id;

  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  SELECT v_iglesia_id, p_destino_id, m.persona_id, m.es_principal, CURRENT_DATE
  FROM casa_de_paz_membresia m
  WHERE m.casa_de_paz_id = p_origen_id AND m.fecha_fin = CURRENT_DATE AND m.fecha_eliminacion IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM casa_de_paz_membresia m2
      WHERE m2.persona_id = m.persona_id AND m2.casa_de_paz_id = p_destino_id
        AND m2.fecha_fin IS NULL AND m2.fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_cargo
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz SET activo = false WHERE id = p_origen_id;

  RETURN v_fusion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_fusionar_red(p_origen_id UUID, p_destino_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_iglesia_origen UUID;
  v_fusion_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
BEGIN
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'FUSION_MISMA_RED: no se puede fusionar una red consigo misma' USING ERRCODE = 'P0001';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_destino_id AND fecha_eliminacion IS NULL;
  SELECT iglesia_id INTO v_iglesia_origen FROM red WHERE id = p_origen_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_origen IS NULL THEN
    RAISE EXCEPTION 'FUSION_RED_INEXISTENTE: alguna de las redes no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id IS DISTINCT FROM v_iglesia_origen THEN
    RAISE EXCEPTION 'FUSION_IGLESIAS_DISTINTAS: las dos redes deben ser de la misma iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_operativo_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden fusionar redes'
      USING ERRCODE = 'P0001';
  END IF;

  -- Gate: Supervisor sobre la Red destino (la que sobrevive), si tiene Lider vigente.
  IF fn_es_supervisor_en(v_iglesia_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_destino_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, p_destino_id, 'FUSIONAR_RED',
        jsonb_build_object('origen_id', p_origen_id, 'destino_id', p_destino_id, 'motivo', p_motivo), fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de fusión de Redes',
        'El Supervisor pidió fusionar otra Red dentro de la tuya. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO fusion_red (iglesia_id, red_origen_id, red_destino_id, motivo)
  VALUES (v_iglesia_id, p_origen_id, p_destino_id, p_motivo)
  RETURNING id INTO v_fusion_id;

  UPDATE casa_de_paz_red
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
  SELECT v_iglesia_id, cdr.casa_de_paz_id, p_destino_id, CURRENT_DATE
  FROM casa_de_paz_red cdr
  WHERE cdr.red_id = p_origen_id AND cdr.fecha_fin = CURRENT_DATE AND cdr.fecha_eliminacion IS NULL;

  UPDATE red_cargo
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE red SET activo = false WHERE id = p_origen_id;

  RETURN v_fusion_id;
END;
$$;

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
  v_lider_vigente UUID;
  v_solicitud_id UUID;
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

  -- Gate: Supervisor sobre una Red con Lider vigente.
  IF v_red_id IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_id, 'MULTIPLICAR_CDP',
        jsonb_build_object('origen_id', p_origen_id, 'nombre_nueva', p_nombre_nueva,
          'persona_ids', to_jsonb(p_persona_ids), 'lider_nuevo_id', p_lider_nuevo_id, 'motivo', p_motivo),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de multiplicación de Casa de Paz',
        'El Supervisor pidió multiplicar una Casa de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
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
  v_lider_vigente UUID;
  v_solicitud_id UUID;
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

  -- Gate: Supervisor sobre la Red de origen (la que se divide), si tiene Lider vigente.
  IF fn_es_supervisor_en(v_iglesia_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_origen_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, p_origen_id, 'MULTIPLICAR_RED',
        jsonb_build_object('origen_id', p_origen_id, 'nombre_nueva', p_nombre_nueva,
          'cdp_ids', to_jsonb(p_cdp_ids), 'lider_nuevo_id', p_lider_nuevo_id, 'motivo', p_motivo),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de multiplicación de Red',
        'El Supervisor pidió multiplicar tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
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

-- ============================================================
-- Cambiar Lider de Red / Lider de CdP: hoy es logica de cliente (2 llamadas
-- sueltas: cerrar el cargo vigente + insertar el nuevo, en
-- casas-de-paz.service.ts). Se agregan estas 2 RPC nuevas -- mismo trabajo,
-- pero server-side y con el mismo gate -- para poder interceptarlas igual
-- que las 4 de arriba. El frontend las usa solo para el codigo LIDER_RED /
-- LIDER_CDP; para el resto de los cargos (sublider, anfitrion, etc.) sigue
-- llamando a las funciones de cliente existentes, sin cambios.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_asignar_cargo_red(p_red_id UUID, p_persona_id UUID, p_codigo TEXT, p_cargo_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_INEXISTENTE: la red no existe' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR fn_es_lider_de_red(p_red_id)) THEN
    RAISE EXCEPTION 'CARGO_SIN_PERMISO: se requiere ser Lider de la Red, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo = 'LIDER_RED' AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(p_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, p_red_id, 'CAMBIAR_LIDER_RED',
        jsonb_build_object('red_id', p_red_id, 'persona_id', p_persona_id, 'codigo', p_codigo, 'cargo_id', p_cargo_id),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de cambio de Líder de Red',
        'El Supervisor pidió designar un nuevo Líder para tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  IF p_codigo = 'LIDER_RED' THEN
    UPDATE red_cargo SET fecha_fin = CURRENT_DATE
    WHERE red_id = p_red_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_red_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_asignar_cargo_cdp(p_cdp_id UUID, p_persona_id UUID, p_codigo TEXT, p_cargo_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_red_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_cdp_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: la casa de paz no existe' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
    RAISE EXCEPTION 'CARGO_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo = 'LIDER_CDP' AND v_red_id IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_id, 'CAMBIAR_LIDER_CDP',
        jsonb_build_object('cdp_id', p_cdp_id, 'persona_id', p_persona_id, 'codigo', p_codigo, 'cargo_id', p_cargo_id),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de cambio de Líder de Casa de Paz',
        'El Supervisor pidió designar un nuevo Líder para una Casa de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  IF p_codigo = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = p_cdp_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_cdp_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- Resolucion de solicitudes: aprobar re-ejecuta la accion original con el
-- payload guardado (el gate de arriba no se vuelve a disparar porque quien
-- aprueba es el propio Lider de la Red, o Pastor/Supervisor de respaldo).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_aprobar_solicitud_estructura(p_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sol solicitud_estructura%ROWTYPE;
  v_resultado UUID;
BEGIN
  SELECT * INTO v_sol FROM solicitud_estructura WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLICITUD_NO_ENCONTRADA: no existe esa solicitud' USING ERRCODE = 'P0001';
  END IF;
  IF v_sol.estado <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'SOLICITUD_YA_RESUELTA: esta solicitud ya fue resuelta' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(v_sol.red_id) OR fn_es_operativo_en(v_sol.iglesia_id)) THEN
    RAISE EXCEPTION 'SOLICITUD_SIN_PERMISO: se requiere ser el Lider de esa Red, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  CASE v_sol.tipo
    WHEN 'FUSIONAR_CDP' THEN
      SELECT fn_fusionar_cdp(
        (v_sol.payload->>'origen_id')::UUID, (v_sol.payload->>'destino_id')::UUID, v_sol.payload->>'motivo'
      ) INTO v_resultado;
    WHEN 'FUSIONAR_RED' THEN
      SELECT fn_fusionar_red(
        (v_sol.payload->>'origen_id')::UUID, (v_sol.payload->>'destino_id')::UUID, v_sol.payload->>'motivo'
      ) INTO v_resultado;
    WHEN 'MULTIPLICAR_CDP' THEN
      SELECT fn_multiplicar_cdp(
        (v_sol.payload->>'origen_id')::UUID, v_sol.payload->>'nombre_nueva',
        (SELECT array_agg(x::UUID) FROM jsonb_array_elements_text(v_sol.payload->'persona_ids') x),
        NULLIF(v_sol.payload->>'lider_nuevo_id', '')::UUID, v_sol.payload->>'motivo'
      ) INTO v_resultado;
    WHEN 'MULTIPLICAR_RED' THEN
      SELECT fn_multiplicar_red(
        (v_sol.payload->>'origen_id')::UUID, v_sol.payload->>'nombre_nueva',
        (SELECT array_agg(x::UUID) FROM jsonb_array_elements_text(v_sol.payload->'cdp_ids') x),
        NULLIF(v_sol.payload->>'lider_nuevo_id', '')::UUID, v_sol.payload->>'motivo'
      ) INTO v_resultado;
    WHEN 'CAMBIAR_LIDER_RED' THEN
      SELECT fn_asignar_cargo_red(
        (v_sol.payload->>'red_id')::UUID, (v_sol.payload->>'persona_id')::UUID,
        v_sol.payload->>'codigo', (v_sol.payload->>'cargo_id')::UUID
      ) INTO v_resultado;
    WHEN 'CAMBIAR_LIDER_CDP' THEN
      SELECT fn_asignar_cargo_cdp(
        (v_sol.payload->>'cdp_id')::UUID, (v_sol.payload->>'persona_id')::UUID,
        v_sol.payload->>'codigo', (v_sol.payload->>'cargo_id')::UUID
      ) INTO v_resultado;
    ELSE
      RAISE EXCEPTION 'SOLICITUD_TIPO_DESCONOCIDO: tipo % no soportado', v_sol.tipo USING ERRCODE = 'P0001';
  END CASE;

  UPDATE solicitud_estructura
  SET estado = 'APROBADA', fecha_resolucion = now(), resuelta_por_persona_id = fn_mi_persona_id()
  WHERE id = p_id;

  PERFORM fn_crear_notificacion(v_sol.solicitante_persona_id, 'SOLICITUD_RESUELTA',
    'Tu solicitud fue aprobada', 'El Líder de Red autorizó la acción que solicitaste.', 'solicitud_estructura', p_id);

  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION fn_rechazar_solicitud_estructura(p_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sol solicitud_estructura%ROWTYPE;
BEGIN
  SELECT * INTO v_sol FROM solicitud_estructura WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLICITUD_NO_ENCONTRADA: no existe esa solicitud' USING ERRCODE = 'P0001';
  END IF;
  IF v_sol.estado <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'SOLICITUD_YA_RESUELTA: esta solicitud ya fue resuelta' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(v_sol.red_id) OR fn_es_operativo_en(v_sol.iglesia_id)) THEN
    RAISE EXCEPTION 'SOLICITUD_SIN_PERMISO: se requiere ser el Lider de esa Red, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  UPDATE solicitud_estructura
  SET estado = 'RECHAZADA', motivo_rechazo = p_motivo, fecha_resolucion = now(), resuelta_por_persona_id = fn_mi_persona_id()
  WHERE id = p_id;

  PERFORM fn_crear_notificacion(v_sol.solicitante_persona_id, 'SOLICITUD_RESUELTA',
    'Tu solicitud fue rechazada',
    coalesce('El Líder de Red rechazó tu solicitud: ' || p_motivo, 'El Líder de Red rechazó tu solicitud.'),
    'solicitud_estructura', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_mis_solicitudes_pendientes()
RETURNS TABLE (
  id UUID, red_id UUID, tipo TEXT, payload JSONB, fecha_creacion TIMESTAMPTZ,
  solicitante_nombre TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.red_id, s.tipo, s.payload, s.fecha_creacion, fn_nombre_completo(p)
  FROM solicitud_estructura s
  JOIN persona p ON p.id = s.solicitante_persona_id
  WHERE s.estado = 'PENDIENTE' AND fn_es_lider_de_red(s.red_id)
  ORDER BY s.fecha_creacion DESC;
$$;
