-- VisionHub -- fn_validar_campos_membresia_persona es BEFORE INSERT OR UPDATE
-- sin filtro de columnas: exige CI/fecha_nacimiento en CUALQUIER UPDATE a
-- persona mientras membresia_completada sea true, no solo cuando se marca
-- completada por primera vez. Bug real reportado por el owner (2026-09-03):
-- el modal "Un par de datos mas" (fn_guardar_actualizacion_telefono) hace un
-- UPDATE de persona.telefono_declarado -- inocuo -- y ese UPDATE dispara el
-- trigger, que revienta con "CAMPO_OBLIGATORIO: el campo ci es obligatorio"
-- para cualquier persona que quedo membresia_completada=true ANTES de que su
-- iglesia activara MEMBRESIA_CI_OBLIGATORIO (2026-08-25) y todavia no tenga
-- CI cargado -- aunque el UPDATE no toque el CI para nada. El frontend, al no
-- reconocer el 400, lo muestra como "revisa tu conexion". Reproducido en vivo
-- impersonando un usuario real (persona_id e9f078b4-1dbe-4a6d-b231-872e4ad957a4).
--
-- Fix: el chequeo de CI/fecha_nacimiento obligatorios solo debe correr en la
-- TRANSICION a completada (INSERT con membresia_completada true, o UPDATE
-- donde antes no lo estaba) -- no en cada UPDATE subsiguiente de una persona
-- ya completada.

CREATE OR REPLACE FUNCTION public.fn_validar_campos_membresia_persona()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF btrim(NEW.primer_nombre) = '' THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "primer_nombre" no puede estar vacío' USING ERRCODE = 'P0001';
  END IF;

  IF btrim(NEW.primer_apellido) = '' THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "primer_apellido" no puede estar vacío' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.membresia_completada
     AND (TG_OP = 'INSERT' OR OLD.membresia_completada IS DISTINCT FROM true)
     AND fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO') AND NEW.ci IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "ci" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.membresia_completada
     AND (TG_OP = 'INSERT' OR OLD.membresia_completada IS DISTINCT FROM true)
     AND fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO') AND NEW.fecha_nacimiento IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "fecha_nacimiento" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
