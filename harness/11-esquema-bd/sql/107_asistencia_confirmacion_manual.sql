-- VisionHub -- 107_asistencia_confirmacion_manual.sql
-- KAN-16: permitir que el lider confirme manualmente si alguien "asiste a
-- esta CDP" (es_visita) sin que el trigger lo pise siempre con el calculo
-- automatico de membresia. El frontend ya decidia es_visita por persona
-- (lista de "Asistentes nuevos" vs. "Regular"/"Ninos" en Reportes.tsx) y lo
-- mandaba en el INSERT, pero fn_validar_asistencia lo descartaba siempre.
-- confirmado_manualmente = true respeta lo que mande el cliente; sin el
-- flag (false, el default), se mantiene el calculo automatico de siempre
-- -- compatibilidad total con cualquier otro caller existente.
--
-- NO aplicada contra la base real (sin CLI de Supabase disponible en esta
-- sesion) -- pendiente de aplicar, igual que 100/101.

ALTER TABLE casa_de_paz_asistencia
  ADD COLUMN confirmado_manualmente BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION fn_validar_asistencia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tiene_fecha BOOLEAN;
  v_iglesia_persona UUID;
BEGIN
  SELECT fecha_nacimiento IS NOT NULL, iglesia_id INTO v_tiene_fecha, v_iglesia_persona
  FROM persona WHERE id = NEW.persona_id;

  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
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
$$;
