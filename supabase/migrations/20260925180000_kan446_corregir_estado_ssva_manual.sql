-- KAN-446 (2026-09-25, pedido explícito del owner): hasta hoy no existía
-- ningún lugar de la app donde corregir a mano el estado SSVA de una
-- persona (SIM/NC/CRE) -- solo el toggle de RE (que ni siquiera escribe en
-- persona_estado, ver KAN-390). Caso real: alguien se registra desde el
-- botón "+" de Asistencia sin marcar "¿Aceptó a Cristo?" (queda SIM
-- automático vía fn_recalcular_estados_cdp_reporte al enviar el reporte),
-- pero en realidad sí aceptó y el líder necesita poder corregirlo después,
-- sin tener que reabrir/reenviar el reporte de esa semana.
--
-- Mismo patrón que ya usan fn_recalcular_estados_cdp_reporte y
-- marcarNuevoConvertidoSiCorresponde: cierra la fila vigente de
-- persona_estado (fecha_fin = hoy) y abre una nueva, marcada
-- es_automatico=false para distinguirla de las reclasificaciones que hace
-- el sistema solo.
CREATE FUNCTION public.fn_corregir_estado_ssva_manual(p_persona_id UUID, p_estado_sigla TEXT, p_motivo TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_estado_id UUID;
BEGIN
  SELECT p.iglesia_id INTO v_iglesia_id FROM persona p WHERE p.id = p_persona_id AND p.fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'PERSONA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_estado_id FROM estado WHERE sigla = p_estado_sigla AND fecha_eliminacion IS NULL;
  IF v_estado_id IS NULL THEN
    RAISE EXCEPTION 'ESTADO_SSVA_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE persona_estado
  SET fecha_fin = current_date
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
  VALUES (v_iglesia_id, p_persona_id, v_estado_id, current_date, false, coalesce(p_motivo, 'Corrección manual desde Reporte de Casa de Paz'));
END;
$function$;
