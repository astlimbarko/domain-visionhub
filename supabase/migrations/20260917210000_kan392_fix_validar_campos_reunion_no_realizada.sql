-- VisionHub -- KAN-392, bug real encontrado al verificar en vivo
-- (2026-09-17): fn_validar_campos_reporte (trigger en casa_de_paz_reporte)
-- exigía tema/disertador/testimonios/comentarios en TODO insert, sin
-- excepción para reunion_no_realizada=true -- el guardado de "semana sin
-- reunión" fallaba siempre con CAMPO_OBLIGATORIO ("tema"). Confirmado en
-- vivo con Playwright contra el dev server (rama de Magnus,
-- feat/kan392-393-reunion-no-realizada-2026-09-17).
--
-- Fix: ninguno de los 4 campos obligatorios configurables tiene sentido
-- cuando no hubo reunión -- se salta todo el chequeo si reunion_no_realizada.

CREATE OR REPLACE FUNCTION public.fn_validar_campos_reporte()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.reunion_no_realizada THEN
    RETURN NEW;
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TEMA_OBLIGATORIO')
     AND NEW.tema_id IS NULL
     AND (NEW.tema_especial_txt IS NULL OR btrim(NEW.tema_especial_txt) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "tema" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_DISERTADOR_OBLIGATORIO') AND NEW.disertador_id IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "disertador" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TESTIMONIOS_OBLIGATORIO')
     AND (NEW.testimonios IS NULL OR btrim(NEW.testimonios) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "testimonios" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_COMENTARIOS_OBLIGATORIO')
     AND (NEW.comentarios IS NULL OR btrim(NEW.comentarios) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "comentarios" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
