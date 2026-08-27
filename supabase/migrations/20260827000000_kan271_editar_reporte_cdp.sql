-- VisionHub -- KAN-271 (pedido explícito del owner, 2026-08-27): permitir
-- EDITAR un reporte de Casa de Paz ya enviado. Hasta hoy fn_puede_reportar_cdp
-- solo servía para CREAR (INSERT) -- la policy de UPDATE ya existía
-- (16_rls.sql) pero dormida: dependía de SUBLIDER_PUEDE_EDITAR_REPORTE
-- (default false, sin ningún consumidor real en el frontend) y no cubría a
-- Líder/Supervisor de Red en absoluto.
--
-- Regla de negocio pedida: Líder de Red, Supervisor de Red (cargo
-- SUBLIDER_RED), Líder de CdP y Sublíder de CdP pueden editar -- con un
-- límite de 7 días desde la fecha_reunion del reporte (no desde que se
-- cargó). Pasado ese plazo, nadie edita más (ni siquiera Pastor/Supervisor,
-- que de todas formas ya podían vía fn_es_operativo_en/fn_es_pastor_en --
-- se les mantiene sin el límite de fecha, es el mismo criterio que ya tenían
-- para el resto de las acciones administrativas).

CREATE OR REPLACE FUNCTION public.fn_puede_editar_reporte_cdp(p_reporte_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (
      fn_es_super_admin()
      OR fn_es_pastor_en(r.iglesia_id)
      OR fn_es_operativo_en(r.iglesia_id)
      OR (
        r.fecha_reunion >= CURRENT_DATE - 7
        AND (
          fn_es_lider_cdp(r.casa_de_paz_id)
          OR fn_es_sublider_cdp(r.casa_de_paz_id)
          OR EXISTS (
            SELECT 1 FROM casa_de_paz_red cdr
            WHERE cdr.casa_de_paz_id = r.casa_de_paz_id
              AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
              AND fn_es_lider_de_red(cdr.red_id)
          )
        )
      )
    )
  FROM casa_de_paz_reporte r
  WHERE r.id = p_reporte_id AND r.fecha_eliminacion IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.fn_puede_editar_reporte_cdp(UUID) TO authenticated;

-- pol_casa_de_paz_reporte_update: reemplaza la versión dormida
-- (SUBLIDER_PUEDE_EDITAR_REPORTE) por el nuevo gate de arriba.
DROP POLICY IF EXISTS pol_casa_de_paz_reporte_update ON casa_de_paz_reporte;
CREATE POLICY pol_casa_de_paz_reporte_update ON casa_de_paz_reporte FOR UPDATE
USING (
  iglesia_id IN (SELECT fn_mis_iglesias())
  AND fn_puede_editar_reporte_cdp(id)
);

-- casa_de_paz_asistencia (altas/bajas/cambios de es_menor durante la
-- edición): se agrega fn_puede_editar_reporte_cdp como camino alternativo,
-- sin tocar el gate existente (fn_puede_reportar_cdp) que ya usa el alta
-- normal -- ampliar, no angostar.
DROP POLICY IF EXISTS pol_casa_de_paz_asistencia_insert ON casa_de_paz_asistencia;
CREATE POLICY pol_casa_de_paz_asistencia_insert ON casa_de_paz_asistencia FOR INSERT
WITH CHECK (
  iglesia_id IN (SELECT fn_mis_iglesias())
  AND (
    fn_puede_reportar_cdp((SELECT casa_de_paz_id FROM casa_de_paz_reporte WHERE id = reporte_id))
    OR fn_puede_editar_reporte_cdp(reporte_id)
  )
);

DROP POLICY IF EXISTS pol_casa_de_paz_asistencia_update ON casa_de_paz_asistencia;
CREATE POLICY pol_casa_de_paz_asistencia_update ON casa_de_paz_asistencia FOR UPDATE
USING (
  iglesia_id IN (SELECT fn_mis_iglesias())
  AND (
    fn_puede_reportar_cdp((SELECT casa_de_paz_id FROM casa_de_paz_reporte WHERE id = reporte_id))
    OR fn_puede_editar_reporte_cdp(reporte_id)
  )
);

-- fn_registrar_ingresos_reporte: mismo criterio, se reusa tal cual al editar
-- (fn_upsert_ingreso_reporte ya actualiza en vez de duplicar filas).
CREATE OR REPLACE FUNCTION public.fn_registrar_ingresos_reporte(p_reporte_id uuid, p_total_ofrendas numeric, p_total_diezmos numeric, p_moneda_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reporte casa_de_paz_reporte;
  v_moneda_id UUID;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  IF NOT (fn_puede_reportar_cdp(v_reporte.casa_de_paz_id) OR fn_puede_editar_reporte_cdp(p_reporte_id)) THEN
    RAISE EXCEPTION 'INGRESO_SIN_PERMISO: no puede registrar ingresos de esta casa de paz'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_total_ofrendas IS NULL THEN
    RAISE EXCEPTION 'REPORTE_OFRENDAS_OBLIGATORIO: el total de ofrendas es obligatorio en el reporte, aunque sea 0'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(p_moneda_id, moneda_defecto_id) INTO v_moneda_id FROM iglesia WHERE id = v_reporte.iglesia_id;

  -- KAN-271: al EDITAR un reporte, si se cambia la moneda, fn_upsert_ingreso_reporte
  -- (que hace upsert por reporte_id+tipo+moneda_id) no encuentra la fila vieja
  -- en la moneda anterior -- sin esto quedarían 2 filas de ingreso sueltas
  -- (una por moneda) en vez de reemplazarse. Se cierra cualquier ingreso de
  -- este reporte en una moneda distinta a la que se está por guardar.
  UPDATE finanzas_ingreso
  SET fecha_eliminacion = now()
  WHERE reporte_id = p_reporte_id AND moneda_id <> v_moneda_id AND fecha_eliminacion IS NULL;

  PERFORM fn_upsert_ingreso_reporte(p_reporte_id, 'OFRENDA', p_total_ofrendas, v_moneda_id);
  PERFORM fn_upsert_ingreso_reporte(p_reporte_id, 'DIEZMO',  p_total_diezmos,  v_moneda_id);
END;
$$;

-- Notificación de edición: Sublíder edita -> avisa a Líder de esa CdP.
-- Nunca al revés (pedido explícito) -- por eso el trigger solo mira el caso
-- "actor es Sublíder y no también Líder", igual que ya hace
-- fn_notificar_reporte_sublider para el alta (57_notificaciones.sql,
-- parcheada en 112_fix_notificacion_reporte_doble_cargo.sql).
ALTER TABLE notificacion DROP CONSTRAINT chk_notificacion_tipo;
ALTER TABLE notificacion ADD CONSTRAINT chk_notificacion_tipo
  CHECK (tipo = ANY (ARRAY['REPORTE_SUBLIDER'::text, 'REPORTE_EDITADO_SUBLIDER'::text, 'SOLICITUD_ESTRUCTURA'::text, 'SOLICITUD_RESUELTA'::text]));

CREATE OR REPLACE FUNCTION public.fn_notificar_edicion_reporte_sublider()
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
        v_lider_id, 'REPORTE_EDITADO_SUBLIDER',
        'Tu sublíder editó un reporte',
        'Tu sublíder editó el reporte de la reunión del ' || to_char(NEW.fecha_reunion, 'DD/MM/YYYY'),
        'casa_de_paz_reporte', NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- WHEN excluye el revert de mejor esfuerzo (fn_revertir_reporte_cdp marca
-- fecha_eliminacion) -- eso no es una "edición" real, es deshacer un alta.
DROP TRIGGER IF EXISTS trg_notificar_reporte_editado ON casa_de_paz_reporte;
CREATE TRIGGER trg_notificar_reporte_editado
  AFTER UPDATE ON casa_de_paz_reporte
  FOR EACH ROW
  WHEN (NEW.fecha_eliminacion IS NULL)
  EXECUTE FUNCTION fn_notificar_edicion_reporte_sublider();
