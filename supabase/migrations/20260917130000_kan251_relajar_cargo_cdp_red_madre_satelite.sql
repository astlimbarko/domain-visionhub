-- VisionHub -- KAN-251, punto 1/4 (2026-09-17): compartir cargos de Red/CdP
-- entre iglesia madre y su satélite vigente -- pedido explícito del owner,
-- confirmado con caso real (Supervisor de la Visión en Acción de Centro de
-- Vida 4 Anillo con rol en Centro de Vida Montero, su satélite).
--
-- CUIDADO (mismo criterio que pide el propio ticket): esto NO toca
-- fn_mis_iglesias() ni ningún chequeo de acceso a datos (personas,
-- finanzas, reportes, estructura) -- solo relaja el chequeo puntual de "la
-- persona debe pertenecer a la iglesia del cargo" para el caso específico
-- madre<->satélite VIGENTE (tipo='SATELITE', no 'HIJA' -- una vez graduada
-- a Hija, este helper deja de aplicar automáticamente, sin tocar nada más).
--
-- A diferencia de fn_es_operativo_en_o_padre_de (101_calendario_padre_satelite.sql,
-- 2026-08-04), que NO filtra por tipo (aplica a cualquier iglesia con
-- padre, incluida una ya graduada a Hija) -- inconsistencia real detectada
-- y documentada en sesión anterior (visionhub-analisis-iglesia-satelite-2026-08-22),
-- este helper nuevo SÍ filtra por tipo='SATELITE' a propósito, para que
-- graduar a Hija (KAN-387) corte el permiso de verdad sin tener que tocar
-- este código de nuevo.

CREATE OR REPLACE FUNCTION public.fn_son_madre_satelite_vigente(p_iglesia_a uuid, p_iglesia_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM iglesia i
    WHERE i.tipo = 'SATELITE' AND i.fecha_eliminacion IS NULL
      AND (
        (i.id = p_iglesia_a AND i.iglesia_padre_id = p_iglesia_b)
        OR (i.id = p_iglesia_b AND i.iglesia_padre_id = p_iglesia_a)
      )
  );
$function$;

-- fn_validar_cdp_cargo: relajar el chequeo CDP_CARGO_IGLESIA_DISTINTA.
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
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id
     AND NOT fn_son_madre_satelite_vigente(v_iglesia_persona, NEW.iglesia_id) THEN
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
