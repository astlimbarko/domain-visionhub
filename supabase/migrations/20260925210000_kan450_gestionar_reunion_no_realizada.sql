-- KAN-450 (pedido explícito del owner, 2026-09-25): las burbujas de
-- "reunión no realizada" del calendario de Historial de Reportes no se
-- podían tocar en absoluto -- a diferencia de los reportes reales
-- (verdes), que sí se pueden editar/anular dentro de la ventana
-- configurable que controla Supervisión de la Visión en Acción
-- (fn_puede_editar_reporte_cdp / DIAS_LIMITE_EDICION_REPORTE_CDP-RED).
--
-- Se agregan 2 acciones, ambas respetando esa misma ventana:
--   1. Corregir fecha/motivo de la marca "no realizada".
--   2. Convertirla en reporte real (soft-delete de esta fila) para poder
--      cargar el reporte completo desde /reportes?fecha=... .
--
-- Ambas van en RPC SECURITY DEFINER (no un UPDATE directo desde el
-- cliente): un UPDATE plano que toca `fecha_eliminacion` dispara de nuevo
-- la policy de UPDATE (WITH CHECK usa la misma expresión que USING por
-- default) -- y fn_puede_editar_reporte_cdp filtra `fecha_eliminacion IS
-- NULL` en su propio SELECT, así que se auto-rechaza a sí mismo (probado
-- en vivo: 403 real). Mismo patrón ya usado por fn_anular_reporte_cdp.

CREATE FUNCTION public.fn_corregir_reunion_no_realizada(
  p_reporte_id UUID,
  p_fecha_reunion DATE,
  p_motivo TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reporte casa_de_paz_reporte;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id AND fecha_eliminacion IS NULL;

  IF v_reporte.id IS NULL OR NOT v_reporte.reunion_no_realizada THEN
    RAISE EXCEPTION 'REUNION_NO_REALIZADA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_puede_editar_reporte_cdp(p_reporte_id) THEN
    RAISE EXCEPTION 'REUNION_NO_REALIZADA_SIN_PERMISO: no tenés permiso para corregir esto (o ya pasó la ventana de edición)'
      USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'REUNION_NO_REALIZADA_MOTIVO_VACIO: el motivo es obligatorio' USING ERRCODE = 'P0001';
  END IF;

  UPDATE casa_de_paz_reporte
  SET fecha_reunion = p_fecha_reunion, motivo_no_realizada = p_motivo, actualizado_por = auth.uid()
  WHERE id = p_reporte_id;
END;
$function$;

CREATE FUNCTION public.fn_convertir_no_realizada_en_reporte(p_reporte_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reporte casa_de_paz_reporte;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id AND fecha_eliminacion IS NULL;

  IF v_reporte.id IS NULL OR NOT v_reporte.reunion_no_realizada THEN
    RAISE EXCEPTION 'REUNION_NO_REALIZADA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_puede_editar_reporte_cdp(p_reporte_id) THEN
    RAISE EXCEPTION 'REUNION_NO_REALIZADA_SIN_PERMISO: no tenés permiso para convertir esto (o ya pasó la ventana de edición)'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE casa_de_paz_reporte SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE id = p_reporte_id;
END;
$function$;
