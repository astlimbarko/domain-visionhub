-- VisionHub -- kan374_375_ventana_edicion_reporte_configurable.sql
-- KAN-375: la ventana de edicion de un reporte semanal (fn_puede_editar_
-- reporte_cdp, KAN-271) estaba hardcodeada en "CURRENT_DATE - 7" -- se
-- expone como parametro configurable por iglesia (mismo patron ya usado
-- por DIAS_PLAZO_REPORTE, categoria CONTROL_REPORTES del Panel Supervisor,
-- fn_criterio) en vez de una constante fija en el codigo.
--
-- KAN-374 ("basada en fecha de registro y rol"): el ancla ya es
-- fecha_reunion (no fecha_creacion) y el chequeo de rol ya distingue
-- Pastor/Supervisor/operativo (sin limite) de Lider/Sublider de CdP y
-- Lider/Supervisor de Red (con ventana) -- eso ya estaba bien, no se
-- cambia. Lo unico que hoy no varia es el TAMAÑO de la ventana por rol
-- (Pastor/Supervisor ya la tienen ilimitada, que es la unica diferencia
-- de rol que el ticket original describia) -- no se inventan valores
-- nuevos por rol sin que el owner los defina.

INSERT INTO public.configuracion_definicion
  (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, orden)
VALUES (
  'DIAS_LIMITE_EDICION_REPORTE',
  'Días límite para editar un reporte',
  'Días desde la fecha de la reunión dentro de los cuales el Líder/Sublíder de CdP o el Líder/Supervisor de Red pueden editar un reporte ya enviado. Pastor/Supervisor/operativo de la iglesia no tienen este límite.',
  'NUMERICO',
  '7',
  '1',
  '60',
  'días',
  'CONTROL_REPORTES',
  42
)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  valor_min = EXCLUDED.valor_min,
  valor_max = EXCLUDED.valor_max,
  orden = EXCLUDED.orden;

CREATE OR REPLACE FUNCTION public.fn_puede_editar_reporte_cdp(p_reporte_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (
      fn_es_super_admin()
      OR fn_es_pastor_en(r.iglesia_id)
      OR fn_es_operativo_en(r.iglesia_id)
      OR (
        r.fecha_reunion >= CURRENT_DATE - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE')::int
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
