-- VisionHub -- caso real reportado por el owner (2026-09-04): una persona
-- con cargo (Sublider de su propia CdP, Supervisora de su Red) tambien
-- asiste de forma regular a OTRA Casa de Paz que no es la suya, y no
-- aparecia en el buscador de "Asistencia regular" de esa otra CdP -- los
-- pools salen de casa_de_paz_membresia, y ella solo tenia membresia en su
-- propia CdP. Ya se habia intentado resolver esto con un buscador global que
-- solo sumaba a la persona al reporte puntual (sin dejar ningun registro
-- real de membresia) -- el owner lo rechazo (commit 2b53093, revertido en
-- 7d3996f) porque no arreglaba el dato de fondo: cada semana habria que
-- volver a buscarla.
--
-- Este fix es distinto: crea una membresia SECUNDARIA real y persistente
-- (es_principal = false) en la CdP que visita, sin tocar su membresia
-- principal (donde tiene sus cargos). La tabla ya estaba disenada para
-- esto -- el unico indice unico exige una sola membresia PRINCIPAL activa
-- por persona (uq_casa_de_paz_membresia_principal, harness/11-esquema-bd/
-- sql/08_estructura.sql), pero no limita las secundarias. Con esto, la
-- persona aparece sola en "Asistencia regular" de esa CdP en todos los
-- reportes futuros, sin volver a completar ningun formulario.

CREATE OR REPLACE FUNCTION public.fn_agregar_miembro_secundario_cdp(p_persona_id uuid, p_casa_de_paz_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_iglesia_cdp UUID;
  v_iglesia_persona UUID;
BEGIN
  -- Mismo permiso que ya exige poder cargar un reporte de esta CdP (líder,
  -- sublíder, o un rol operativo/pastor por encima) -- quien puede reportar
  -- asistencia de la CdP puede decidir quién es miembro de ella.
  IF NOT fn_puede_reportar_cdp(p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'MIEMBRO_SECUNDARIO_SIN_PERMISO: no tenés permiso para agregar miembros a esta Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_cdp FROM casa_de_paz WHERE id = p_casa_de_paz_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_cdp IS NULL THEN
    RAISE EXCEPTION 'MIEMBRO_SECUNDARIO_CDP_INEXISTENTE: la Casa de Paz no existe' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_persona IS NULL OR v_iglesia_persona <> v_iglesia_cdp THEN
    RAISE EXCEPTION 'MIEMBRO_SECUNDARIO_PERSONA_INVALIDA: la persona no existe en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotente: si ya tiene una membresía activa (principal o secundaria)
  -- en esta misma CdP, no hace nada -- no tiene sentido duplicar la fila ni
  -- fallar si alguien la agrega dos veces por error.
  IF EXISTS (
    SELECT 1 FROM casa_de_paz_membresia
    WHERE persona_id = p_persona_id AND casa_de_paz_id = p_casa_de_paz_id
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_iglesia_cdp, p_casa_de_paz_id, p_persona_id, false, CURRENT_DATE);
END;
$function$;
