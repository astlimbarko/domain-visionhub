-- VisionHub -- KAN-252 (fix urgente): fn_persona_normalizar (trigger BEFORE
-- INSERT OR UPDATE en persona) nunca tuvo su propio SET search_path -- no
-- daba problema porque nada la disparaba desde una funcion con
-- search_path vacio. Hoy, al agregar el UPDATE persona SET
-- ministerio_declarado dentro de fn_guardar_membresia_extendida (que SI
-- corre con search_path = '' a proposito), el trigger paso a ejecutarse
-- heredando ese search_path vacio -- su referencia sin calificar a
-- "persona_detalle" dejo de resolverse ("relation persona_detalle does
-- not exist"), bloqueando ese guardado. Se corrige fijando su propio
-- search_path, igual que el resto de las funciones del esquema.
CREATE OR REPLACE FUNCTION public.fn_persona_normalizar()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.correo IS NOT NULL THEN
    NEW.correo := lower(btrim(NEW.correo));
    IF NEW.correo = '' THEN NEW.correo := NULL; END IF;
  END IF;

  IF NEW.apellido_casada IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM persona_detalle
    WHERE persona_id = NEW.id AND estado_civil = 'CASADO' AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'APELLIDO_CASADA_SIN_MATRIMONIO: apellido_casada requiere estado_civil = CASADO'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
