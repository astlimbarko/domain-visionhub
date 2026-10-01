-- KAN-490 (harness/23 B): guardado compartido de la Casa de Paz capturada en
-- las puertas de entrada (Altar / Bautismo / RSIL). Hasta ahora, en esas 3
-- pantallas, la CdP elegida al dar de alta una persona se DESCARTABA (TODO
-- harness/23). Esta RPC la aplica de verdad, sobre una persona ya creada
-- (crearPersona en el frontend):
--   * persona_llegada: invitado_por_id (persona real) o invitado_por_txt
--     (nombre libre). Motivo INVITACION_PERSONAL si hubo invitador, si no OTRO.
--   * casa_de_paz_membresia: si viene casa_de_paz_id (es_principal, con la
--     iglesia REAL de la CdP para que funcione con satélites). Si no viene,
--     la persona queda SIN CdP -> va a designación (harness/23 Req 2).
-- El frontend (SelectorCasaDePaz) ya resuelve la CdP final: cuando el invitador
-- es del sistema y tiene CdP, se auto-sugiere su casa_de_paz_id (con override),
-- así acá no hace falta derivarla. Membresía desde 0 usa su propia RPC
-- (fn_guardar_membresia_nuevos); esta es para Altar/Bautismo/RSIL.

CREATE OR REPLACE FUNCTION public.fn_asignar_entrada_cdp(p_persona_id uuid, p_iglesia_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitador_id   uuid := NULLIF(p_payload->>'invitador_persona_id', '')::uuid;
  v_invitador_txt  text := NULLIF(trim(p_payload->>'invitador_txt'), '');
  v_casa_de_paz_id uuid := NULLIF(p_payload->>'casa_de_paz_id', '')::uuid;
  v_motivo_id      uuid;
  v_cdp_iglesia_id uuid;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  -- La persona debe existir y ser de esta iglesia (defensa).
  IF NOT EXISTS (SELECT 1 FROM persona WHERE id = p_persona_id AND iglesia_id = p_iglesia_id
                 AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_PERSONA_INVALIDA: la persona no existe en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  -- CdP: validar que sea de esta iglesia o de una satélite/hija.
  IF v_casa_de_paz_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM casa_de_paz cdp JOIN iglesia ig ON ig.id = cdp.iglesia_id
      WHERE cdp.id = v_casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
        AND (cdp.iglesia_id = p_iglesia_id OR ig.iglesia_padre_id = p_iglesia_id)
    ) THEN
      RAISE EXCEPTION 'MEMBRESIA_CDP_INVALIDA: la Casa de Paz no pertenece a esta iglesia ni a sus satélites'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Llegada (invitado_por). Solo si todavía no tiene una fila de llegada.
  IF NOT EXISTS (SELECT 1 FROM persona_llegada WHERE persona_id = p_persona_id AND fecha_eliminacion IS NULL) THEN
    SELECT id INTO v_motivo_id FROM motivo_llegada
    WHERE codigo = CASE WHEN v_invitador_id IS NOT NULL OR v_invitador_txt IS NOT NULL
                        THEN 'INVITACION_PERSONAL' ELSE 'OTRO' END;
    INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                                 invitado_por_id, invitado_por_txt)
    VALUES (p_iglesia_id, p_persona_id, v_motivo_id, CURRENT_DATE, v_invitador_id, v_invitador_txt);
  END IF;

  -- Membresía de CdP (con la iglesia real de la CdP, para satélites).
  IF v_casa_de_paz_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM casa_de_paz_membresia WHERE persona_id = p_persona_id
                     AND es_principal AND fecha_fin IS NULL AND fecha_eliminacion IS NULL) THEN
    SELECT iglesia_id INTO v_cdp_iglesia_id FROM casa_de_paz WHERE id = v_casa_de_paz_id;
    INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
    VALUES (COALESCE(v_cdp_iglesia_id, p_iglesia_id), v_casa_de_paz_id, p_persona_id, true, CURRENT_DATE);
  END IF;

  RETURN jsonb_build_object(
    'persona_id', p_persona_id,
    'casa_de_paz_id', v_casa_de_paz_id,
    'sin_casa_de_paz', v_casa_de_paz_id IS NULL
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_asignar_entrada_cdp(uuid, uuid, jsonb) TO authenticated;
