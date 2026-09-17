-- VisionHub -- KAN-397 (2026-09-17): casa_de_paz_membresia no tenía
-- ningún trigger de validación que confirmara que persona.iglesia_id
-- coincide con NEW.iglesia_id -- gap encontrado investigando KAN-251,
-- documentado ahí sin tocar, ahora corregido con su propio ticket.
--
-- Mismo patrón que fn_validar_cdp_cargo / fn_validar_asistencia: usa
-- fn_son_madre_satelite_vigente como escape para el par vigente.

CREATE OR REPLACE FUNCTION public.fn_validar_casa_de_paz_membresia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_persona UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.fecha_eliminacion IS NULL AND NEW.fecha_eliminacion IS NOT NULL
     AND NEW.casa_de_paz_id = OLD.casa_de_paz_id AND NEW.persona_id = OLD.persona_id
     AND NEW.iglesia_id = OLD.iglesia_id THEN
    RETURN NEW;
  END IF;

  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id
     AND NOT fn_son_madre_satelite_vigente(v_iglesia_persona, NEW.iglesia_id) THEN
    RAISE EXCEPTION 'MEMBRESIA_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validar_casa_de_paz_membresia
  BEFORE INSERT OR UPDATE ON casa_de_paz_membresia
  FOR EACH ROW EXECUTE FUNCTION fn_validar_casa_de_paz_membresia();
