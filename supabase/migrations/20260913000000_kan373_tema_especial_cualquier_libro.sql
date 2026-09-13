-- VisionHub -- kan373_tema_especial_cualquier_libro.sql
-- KAN-373: "Tema especial fuera del libro" ya existia en la plomeria
-- (columna tema_especial_txt, tipo, guardado) pero estaba atado a que el
-- catalogo cdp_tema tuviera una fila es_especial=true PARA ESE LIBRO
-- puntual -- solo 2 de 13 libros la tienen, asi que en el resto no habia
-- forma de cargar un tema libre. El frontend ahora ofrece la opcion
-- "Tema especial" en cualquier libro (sentinel, no depende del catalogo);
-- este fix es el lado del backend: fn_validar_campos_reporte exigia
-- tema_id NOT NULL sin excepcion cuando REPORTE_TEMA_OBLIGATORIO esta
-- activo -- ahora acepta tema_especial_txt como alternativa valida.

CREATE OR REPLACE FUNCTION public.fn_validar_campos_reporte()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
