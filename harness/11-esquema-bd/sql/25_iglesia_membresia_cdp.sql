-- VisionHub -- 25_iglesia_membresia_cdp.sql
-- Aclaracion del owner (2026-07-18): una Casa de Paz puede pertenecer
-- administrativamente a una Iglesia (la del lider: cargo, red, ofrendas) pero
-- estar fisicamente en la ciudad de otra Iglesia hermana (el domicilio del
-- Anfitrion). Ejemplo real: un lider de Santa Cruz abre una CdP en Montero;
-- la CdP y sus ofrendas siguen siendo de Santa Cruz, pero cuando exista el
-- censo de membresia (Miembro_Iglesia, Modulo 3 / Afirmacion), esas personas
-- deben contar como membresia de Montero, no de Santa Cruz.
--
-- Esto NO es "un lider con cargo en dos iglesias" (eso sigue sin soportarse
-- a proposito, ver el CHECK que se agrega mas abajo). El lider, la CdP, la
-- red y las ofrendas quedan 100% dentro de una sola Iglesia, como siempre.
-- Lo unico que cruza es, a futuro, el conteo de membresia de las personas.
--
-- El Modulo 1 NO usa esta columna para nada (Miembro_Iglesia todavia no
-- existe): se agrega ahora para que el Modulo 3 no necesite migrar el
-- esquema ni tocar datos historicos. Ver 99-modulos-futuros.md.

ALTER TABLE casa_de_paz
  ADD COLUMN iglesia_membresia_id UUID REFERENCES iglesia(id),
  ADD CONSTRAINT chk_iglesia_membresia_distinta
    CHECK (iglesia_membresia_id IS NULL OR iglesia_membresia_id <> iglesia_id);

-- Requisito 16 (03-estructura): solo un Rol_Superior fija la Iglesia_Membresia,
-- ni siquiera el propio Lider de esa CdP (que si puede editar el resto de la
-- fila, via pol_casa_de_paz_update de 24_permisos_meta_propia.sql).
CREATE OR REPLACE FUNCTION fn_validar_iglesia_membresia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.iglesia_membresia_id IS DISTINCT FROM OLD.iglesia_membresia_id
     AND NOT fn_es_rol_superior_de_cdp(NEW.id) THEN
    RAISE EXCEPTION 'CDP_MEMBRESIA_SOLO_ROL_SUPERIOR: solo un lider de red, supervisor o pastor puede fijar la iglesia de membresia de la casa de paz %', NEW.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_iglesia_membresia
  BEFORE UPDATE ON casa_de_paz
  FOR EACH ROW
  WHEN (NEW.iglesia_membresia_id IS DISTINCT FROM OLD.iglesia_membresia_id)
  EXECUTE FUNCTION fn_validar_iglesia_membresia();

-- Defensa en profundidad encontrada de paso: casa_de_paz_cargo (a diferencia
-- de persona_cargo, ver fn_validar_persona_cargo) no verificaba que la
-- persona asignada perteneciera a la misma Iglesia que la Casa_De_Paz. Nada
-- en el diseño quiere permitir esto -- el caso real de arriba no lo necesita,
-- la CdP entera sigue siendo de una sola Iglesia -- asi que se cierra.
CREATE OR REPLACE FUNCTION fn_validar_cdp_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo VARCHAR;
  v_iglesia_persona UUID;
BEGIN
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
$$;
