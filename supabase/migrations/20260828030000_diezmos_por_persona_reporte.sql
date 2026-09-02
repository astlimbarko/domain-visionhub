-- VisionHub -- Diezmos por persona en el reporte de Casa de Paz.
-- Antes el diezmo se guardaba como UN solo total agregado (finanzas_ingreso
-- tipo DIEZMO con persona_id NULL, via fn_registrar_ingresos_reporte). Pedido
-- del owner: cada diezmante se registra individualmente (nombre + monto +
-- celular opcional), buscando la persona en la BD o creandola a mano. El total
-- de diezmos pasa a ser la SUMA de las filas por persona.
--
-- finanzas_ingreso ya tiene la columna persona_id (14_finanzas.sql), asi que
-- no hay cambio de esquema: cada diezmante es una fila DIEZMO con persona_id +
-- monto. fn_registrar_ingresos_reporte NO se toca: el frontend ahora le pasa
-- p_total_diezmos = NULL, lo que hace que su fn_upsert_ingreso_reporte de baja
-- logica cualquier DIEZMO agregado viejo (persona_id NULL) que hubiera quedado
-- de un reporte anterior -- y las filas por persona las maneja esta funcion.

CREATE OR REPLACE FUNCTION public.fn_registrar_diezmos_reporte(
  p_reporte_id UUID, p_diezmos JSONB, p_moneda_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte  casa_de_paz_reporte;
  v_tipo_id  UUID;
  v_moneda_id UUID;
  v_item     JSONB;
  v_persona_id UUID;
  v_monto    NUMERIC;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORTE_INEXISTENTE: el reporte % no existe', p_reporte_id USING ERRCODE = 'P0001';
  END IF;

  -- Mismo gate de permiso que fn_registrar_ingresos_reporte / RLS.
  IF NOT fn_puede_reportar_cdp(v_reporte.casa_de_paz_id) THEN
    RAISE EXCEPTION 'INGRESO_SIN_PERMISO: no puede registrar diezmos de esta casa de paz'
      USING ERRCODE = 'P0001';
  END IF;

  -- Tipo DIEZMO: misma resolucion que fn_upsert_ingreso_reporte (propio de la
  -- iglesia si existe, si no el global).
  SELECT id INTO v_tipo_id FROM finanzas_tipo_ingreso
  WHERE codigo = 'DIEZMO' AND (iglesia_id = v_reporte.iglesia_id OR iglesia_id IS NULL)
  ORDER BY iglesia_id NULLS LAST LIMIT 1;

  SELECT COALESCE(p_moneda_id, moneda_defecto_id) INTO v_moneda_id
  FROM iglesia WHERE id = v_reporte.iglesia_id;

  -- Reemplazo total: se dan de baja los diezmos previos del reporte (agregado
  -- viejo o por persona de una edicion anterior) y se reinsertan los actuales.
  UPDATE finanzas_ingreso
  SET fecha_eliminacion = now()
  WHERE reporte_id = p_reporte_id AND tipo_ingreso_id = v_tipo_id AND fecha_eliminacion IS NULL;

  IF p_diezmos IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_diezmos)
    LOOP
      v_persona_id := NULLIF(v_item->>'persona_id', '')::UUID;
      v_monto := NULLIF(v_item->>'monto', '')::NUMERIC;

      -- monto > 0 (constraint chk_ingreso_monto) y persona obligatoria: cada
      -- diezmo se atribuye a una persona (existente o lead recien creado por el
      -- frontend, igual que las visitas). Se saltean items invalidos en vez de
      -- reventar todo el reporte.
      IF v_persona_id IS NULL OR v_monto IS NULL OR v_monto <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO finanzas_ingreso (iglesia_id, tipo_ingreso_id, reporte_id, casa_de_paz_id, persona_id, monto, moneda_id, fecha)
      VALUES (v_reporte.iglesia_id, v_tipo_id, p_reporte_id, v_reporte.casa_de_paz_id, v_persona_id, v_monto, v_moneda_id, v_reporte.fecha_reunion);
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_diezmos_reporte(UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_diezmos_reporte(UUID, JSONB, UUID) TO authenticated;
