-- Fix estructural (2026-10-03): asignar un SUBLÍDER/ANFITRIÓN/ENCARGADO que ya
-- existe en el sistema fallaba para Pastor y Super Admin.
--
-- Causa raíz: el frontend asignaba el LÍDER por RPC (fn_asignar_cargo_cdp /
-- fn_asignar_cargo_red, SECURITY DEFINER, con permisos correctos) pero los
-- demás cargos por INSERT directo del cliente, sujeto a la política RLS de
-- INSERT de casa_de_paz_cargo / red_cargo. Esa política solo permite a
-- SUPERVISOR_VISION_ACCION / líder de la CdP / líder de la Red -- NO al Pastor
-- ni al Super Admin. Por eso el INSERT directo los rechazaba con
-- "new row violates row-level security policy".
--
-- Solución: el frontend pasa a usar estas RPC para TODOS los cargos (ver
-- casas-de-paz.service.ts). Para que eso funcione con los cargos EXCLUSIVOS que
-- no son el líder (ANFITRION en CdP; ENCARGADO_DEPARTAMENTOS_RED /
-- ENCARGADO_MINISTERIO_RED en Red), la RPC ahora cierra el cargo vigente del
-- mismo tipo antes de insertar -- igual que ya hacía para el líder y que antes
-- hacía el cliente. Sin esto, el trigger fn_validar_cdp_cargo rechazaría el 2do
-- vigente (CDP_CARGO_DUPLICADO). Los cargos NO exclusivos (SUBLIDER_CDP,
-- SUBLIDER_RED) no cierran nada: se pueden tener varios.

-- ── CdP ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_cdp(p_cdp_id uuid, p_persona_id uuid, p_codigo text, p_cargo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
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

  -- Cerrar el cargo vigente del mismo tipo si es EXCLUSIVO (reemplazo), para
  -- LIDER_CDP y ANFITRION. SUBLIDER_CDP no es exclusivo: no se cierra nada.
  IF p_codigo IN ('LIDER_CDP', 'ANFITRION') THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = p_cdp_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_cdp_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  -- KAN-280: LIDER_CDP y SUBLIDER_CDP son los 2 valores de rol_sistema_enum
  -- que aplican acá (ANFITRION no es un rol de acceso, no tiene valor en
  -- ese enum -- no corresponde crearle usuario_rol).
  IF p_codigo IN ('LIDER_CDP', 'SUBLIDER_CDP') THEN
    PERFORM private.fn_asegurar_usuario_rol_por_cargo(p_persona_id, v_iglesia_id, p_codigo::rol_sistema_enum);
    PERFORM private.fn_asegurar_membresia_cdp_por_cargo(p_persona_id, v_iglesia_id, p_cdp_id);
  END IF;

  RETURN v_id;
END;
$function$;

-- ── Red ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_red(p_red_id uuid, p_persona_id uuid, p_codigo text, p_cargo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR fn_es_lider_de_red(p_red_id)) THEN
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

  -- Cerrar el cargo vigente del mismo tipo si es EXCLUSIVO (reemplazo), para
  -- LIDER_RED y los encargados exclusivos. SUBLIDER_RED no es exclusivo.
  IF p_codigo IN ('LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED') THEN
    UPDATE red_cargo SET fecha_fin = CURRENT_DATE
    WHERE red_id = p_red_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_red_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  -- Nota: no se toca usuario_rol acá a propósito -- la versión original de esta
  -- RPC tampoco lo hacía, y el acceso de los cargos de Red se gestiona por otra
  -- vía. Sólo se agregó el cierre de exclusivos de arriba respecto al original.

  RETURN v_id;
END;
$function$;
