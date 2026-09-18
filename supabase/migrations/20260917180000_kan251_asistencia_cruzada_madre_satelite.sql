-- VisionHub -- KAN-251, punto 4/4 (2026-09-17): visitas/asistencia
-- cruzada. Investigado como pide el ticket antes de tocar nada: el
-- bloqueo real es fn_validar_asistencia (trigger en casa_de_paz_asistencia),
-- exactamente el mismo patrón que fn_validar_cdp_cargo (punto 1) --
-- ASISTENCIA_IGLESIA_DISTINTA si persona.iglesia_id <> NEW.iglesia_id.
-- Mismo escape ya probado (fn_son_madre_satelite_vigente).
--
-- Hallazgo aparte, fuera de alcance de este ticket (no se toca acá): NO
-- existe ningún chequeo equivalente en casa_de_paz_membresia (membresía
-- formal) -- hoy nada impide que una persona de una iglesia sin ninguna
-- relación quede como miembro formal de una CdP de otra iglesia. Es un
-- gap preexistente, no introducido por este cambio -- documentar aparte.

CREATE OR REPLACE FUNCTION public.fn_validar_asistencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tiene_fecha BOOLEAN;
  v_iglesia_persona UUID;
BEGIN
  SELECT fecha_nacimiento IS NOT NULL, iglesia_id INTO v_tiene_fecha, v_iglesia_persona
  FROM persona WHERE id = NEW.persona_id;

  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id
     AND NOT fn_son_madre_satelite_vigente(v_iglesia_persona, NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ASISTENCIA_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_tiene_fecha AND NEW.es_menor IS NULL THEN
    RAISE EXCEPTION 'ASISTENCIA_EDAD_INDEFINIDA: la persona % no tiene fecha de nacimiento; indique es_menor',
      NEW.persona_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT NEW.confirmado_manualmente THEN
    NEW.es_visita := NOT EXISTS (
      SELECT 1 FROM casa_de_paz_membresia m
      JOIN casa_de_paz_reporte r ON r.id = NEW.reporte_id
      WHERE m.persona_id = NEW.persona_id AND m.casa_de_paz_id = r.casa_de_paz_id
        AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
    );
  END IF;

  RETURN NEW;
END;
$function$;
