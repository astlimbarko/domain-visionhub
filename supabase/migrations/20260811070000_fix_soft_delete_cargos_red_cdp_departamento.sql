-- VisionHub -- KAN-178: mismo patron que la excepcion de baja suave que ya
-- tiene fn_validar_asignacion_rol (usuario_rol, agregada 2026-08-09 en
-- 20260809050000) pero que nunca se replico en los 3 triggers equivalentes
-- de red_cargo/casa_de_paz_cargo/departamento_cargo. Encontrado al intentar
-- dar de baja cargos de prueba duplicados/residuales de los Super Admin
-- (KAN-175/178): un simple UPDATE que solo pone fecha_eliminacion=now() en
-- una fila ya invalida (ej. un tercer "Lider de Red" duplicado sobre el
-- mismo red_id) disparaba el mismo chequeo de "duplicado"/"iglesia
-- distinta" que se usa para validar altas nuevas, bloqueando la baja de la
-- fila justamente invalida que se queria remover.
--
-- Se agrega el mismo bypass en los 3: si la unica cosa que cambia es
-- fecha_eliminacion (de NULL a NOT NULL) y el resto de columnas relevantes
-- sigue igual, se omite toda validacion y se deja pasar.

CREATE OR REPLACE FUNCTION public.fn_validar_red_cargo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.fecha_eliminacion IS NULL AND NEW.fecha_eliminacion IS NOT NULL
     AND NEW.red_id = OLD.red_id AND NEW.cargo_id = OLD.cargo_id AND NEW.persona_id = OLD.persona_id THEN
    RETURN NEW;
  END IF;

  SELECT codigo INTO v_codigo FROM cargo WHERE id = NEW.cargo_id;

  IF v_codigo IN ('LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED')
     AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM red_cargo rc
      WHERE rc.red_id = NEW.red_id AND rc.cargo_id = NEW.cargo_id
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
        AND rc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'RED_CARGO_DUPLICADO: la red % ya tiene un % vigente', NEW.red_id, v_codigo
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_validar_cdp_cargo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo VARCHAR;
  v_iglesia_persona UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.fecha_eliminacion IS NULL AND NEW.fecha_eliminacion IS NOT NULL
     AND NEW.casa_de_paz_id = OLD.casa_de_paz_id AND NEW.cargo_id = OLD.cargo_id
     AND NEW.persona_id = OLD.persona_id AND NEW.iglesia_id = OLD.iglesia_id THEN
    RETURN NEW;
  END IF;

  SELECT codigo INTO v_codigo FROM cargo WHERE id = NEW.cargo_id;

  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'CDP_CARGO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia % de esta casa de paz',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  IF v_codigo IN ('LIDER_CDP', 'ANFITRION') AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM casa_de_paz_cargo cc
      WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND cc.cargo_id = NEW.cargo_id
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        AND cc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'CDP_CARGO_DUPLICADO: la casa de paz % ya tiene un % vigente', NEW.casa_de_paz_id, v_codigo
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- SUBLIDER_CDP no tiene limite: de 0 a infinito
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_validar_departamento_cargo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_persona      UUID;
  v_iglesia_departamento UUID;
  v_codigo_cargo         VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.fecha_eliminacion IS NULL AND NEW.fecha_eliminacion IS NOT NULL
     AND NEW.departamento_id = OLD.departamento_id AND NEW.cargo_id = OLD.cargo_id
     AND NEW.persona_id = OLD.persona_id AND NEW.iglesia_id = OLD.iglesia_id THEN
    RETURN NEW;
  END IF;

  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_departamento FROM departamento WHERE id = NEW.departamento_id;
  IF v_iglesia_departamento IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_IGLESIA_DISTINTA: el departamento % no pertenece a la iglesia %',
      NEW.departamento_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  SELECT codigo INTO v_codigo_cargo FROM cargo WHERE id = NEW.cargo_id;
  IF v_codigo_cargo IS DISTINCT FROM 'LIDER_DEPARTAMENTO' THEN
    RAISE EXCEPTION 'DEPARTAMENTO_CARGO_INVALIDO: el cargo % no es un cargo departamental valido', v_codigo_cargo
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
