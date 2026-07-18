-- VisionHub -- 18_validaciones.sql
-- Obligatoriedad configurable de campos del reporte (10-panel-supervisor).

CREATE OR REPLACE FUNCTION fn_validar_campos_reporte()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TEMA_OBLIGATORIO') AND NEW.tema_id IS NULL THEN
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
$$;

CREATE TRIGGER trg_validar_campos_reporte
  BEFORE INSERT OR UPDATE ON casa_de_paz_reporte
  FOR EACH ROW EXECUTE FUNCTION fn_validar_campos_reporte();
