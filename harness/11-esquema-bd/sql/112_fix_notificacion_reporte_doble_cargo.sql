-- VisionHub -- 112_fix_notificacion_reporte_doble_cargo.sql
-- Bug real reportado por el owner 2026-08-21: cuando el Lider de CdP envia
-- el reporte, la notificacion sale como si lo hubiera subido su sublider.
-- Confirmado el escenario exacto: esa persona tiene AMBOS cargos vigentes
-- (LIDER_CDP y SUBLIDER_CDP) de la misma Casa de Paz -- posible desde que
-- existe multi-cargo (20260809020000_estructura_permitir_multiples_cargos.sql).
--
-- fn_notificar_reporte_sublider (57_notificaciones.sql) solo chequeaba si el
-- actor tenia el cargo SUBLIDER_CDP para decidir si avisar al Lider. Con
-- doble cargo, v_es_sublider daba true, y como el actor TAMBIEN es el
-- Lider de esa CdP, v_lider_id terminaba siendo su propio persona_id --
-- se autonotificaba "Tu sublider cargo el reporte", describiendose a si
-- mismo como si fuera otra persona.
--
-- Fix: si la misma persona tiene TAMBIEN el cargo de Lider de esta CdP, su
-- accion cuenta como accion del Lider -- no dispara el aviso de sublider en
-- absoluto (no solo se evita autonotificar; conceptualmente no es un
-- "sublider avisandole a su lider", es la misma persona en su rol superior).
-- Se agrega ademas v_lider_id <> v_actor_persona_id como defensa en
-- profundidad, por si algun dato quedara inconsistente.

CREATE OR REPLACE FUNCTION fn_notificar_reporte_sublider()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_persona_id UUID := fn_mi_persona_id();
  v_es_sublider BOOLEAN;
  v_es_lider BOOLEAN;
  v_lider_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND cc.persona_id = v_actor_persona_id
      AND c.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  ) INTO v_es_sublider;

  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND cc.persona_id = v_actor_persona_id
      AND c.codigo = 'LIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  ) INTO v_es_lider;

  IF v_es_sublider AND NOT v_es_lider THEN
    SELECT cc.persona_id INTO v_lider_id
    FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
      AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    LIMIT 1;

    IF v_lider_id IS NOT NULL AND v_lider_id <> v_actor_persona_id THEN
      PERFORM fn_crear_notificacion(
        v_lider_id, 'REPORTE_SUBLIDER',
        'Nuevo reporte de tu sublíder',
        'Tu sublíder cargó el reporte de la reunión del ' || to_char(NEW.fecha_reunion, 'DD/MM/YYYY'),
        'casa_de_paz_reporte', NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
