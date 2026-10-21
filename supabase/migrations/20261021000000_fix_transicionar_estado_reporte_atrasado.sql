-- Fix estructural (2026-10-21): un reporte de CdP con fecha de reunión ANTERIOR
-- al estado vigente de una persona rompía TODO el reporte.
--
-- Caso real (Mariana Urquidi, red Kairos): intentaba cargar el reporte del
-- 2026-10-15, pero una asistente ya tenía un estado (NC) vigente desde el
-- 2026-10-20. El trigger de asistencia (fn_evaluar_estado_por_asistencia)
-- llamaba a fn_transicionar_estado con p_fecha = 2026-10-15, que hacía
--   UPDATE persona_estado SET fecha_fin = '2026-10-15'  (estado iniciado 10-20)
-- → fecha_fin (10-15) < fecha_inicio (10-20) → viola chk_persona_estado_fechas
-- (CHECK fecha_fin IS NULL OR fecha_fin >= fecha_inicio). El INSERT de asistencia
-- fallaba, se revertía el reporte entero y el líder veía "No se pudo enviar el
-- reporte", de forma intermitente (solo cuando algún asistente tenía un estado
-- más nuevo que la fecha del reporte).
--
-- No era el duplicado de persona que se investigó antes; ese ya se había
-- corregido y el error seguía por esta otra causa.
--
-- Arreglo: una transición de estado disparada por un evento (asistencia) cuya
-- fecha es ANTERIOR al inicio del estado vigente NO debe reescribir ese estado
-- más nuevo hacia atrás. Es una asistencia histórica/atrasada: el estado actual
-- refleja algo posterior y es el autoritativo. En ese caso se omite la
-- transición (RETURN), en vez de crear fechas inválidas.

CREATE OR REPLACE FUNCTION public.fn_transicionar_estado(
  p_persona_id uuid, p_sigla character varying, p_fecha date,
  p_motivo character varying, p_automatico boolean DEFAULT true
)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_estado_id    UUID;
  v_iglesia_id   UUID;
  v_actual       UUID;
  v_actual_inicio DATE;
BEGIN
  SELECT id INTO v_estado_id FROM estado WHERE sigla = p_sigla;
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id;

  SELECT estado_id, fecha_inicio INTO v_actual, v_actual_inicio
  FROM persona_estado
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  -- Ya está en ese estado: nada que hacer.
  IF v_actual = v_estado_id THEN RETURN; END IF;

  -- Transición atrasada: el estado vigente empezó DESPUÉS de la fecha del
  -- evento. No se reescribe hacia atrás (evita fecha_fin < fecha_inicio y
  -- respeta que el estado actual es más nuevo). Un reporte histórico no debe
  -- mover el estado presente de la persona.
  IF v_actual_inicio IS NOT NULL AND v_actual_inicio > p_fecha THEN
    RETURN;
  END IF;

  UPDATE persona_estado SET fecha_fin = p_fecha
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, motivo, es_automatico)
  VALUES (v_iglesia_id, p_persona_id, v_estado_id, p_fecha, p_motivo, p_automatico);
END;
$function$;
