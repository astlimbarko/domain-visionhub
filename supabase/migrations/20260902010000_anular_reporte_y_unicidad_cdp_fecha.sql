-- VisionHub -- 20260902010000_anular_reporte_y_unicidad_cdp_fecha.sql
-- Pedido del owner (2026-09-02, sesion de Matias): un lider de Casa de Paz cargo
-- DOS reportes para la misma reunion (misma fecha_reunion) -- uno con 0 asistentes
-- y otro con 8 -- y no hay forma de saber cual "vale" ni de borrar el equivocado.
--
-- Se descubrio que NADA impedia el duplicado: el indice unico
-- (casa_de_paz_id, fecha_reunion) que la spec del harness (10_reporte.sql)
-- declara desde hace tiempo NUNCA se habia desplegado a la base real (verificado:
-- no existe en prod). Un mismo reporte enviado dos veces creaba 2 filas vigentes,
-- y Control de Reportes (mapa CdP:semana -> un reporte) mostraba una de las dos
-- de forma no determinista. En prod habia 5 grupos de reportes duplicados.
--
-- Este cambio hace 3 cosas:
--   1) fn_anular_reporte_cdp: da de baja LOGICA un reporte (y su asistencia; los
--      ingresos caen solos por trg_reporte_cascada_ingresos), con el MISMO
--      permiso y ventana de 7 dias que ya usa la edicion (fn_puede_editar_
--      reporte_cdp, KAN-271). No es un DELETE duro (trg_no_delete lo prohibe en
--      toda la app) ni una via para borrar reportes ajenos/viejos.
--   2) Resuelve los duplicados YA existentes: por cada (CdP, fecha_reunion)
--      repetida conserva el reporte mas completo (mas asistentes; empate -> el
--      mas reciente) y anula el resto -- baja logica, reversible.
--   3) Crea el indice unico que faltaba, para que la causa de fondo no vuelva.

-- ============================================================
-- 1) fn_anular_reporte_cdp
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_anular_reporte_cdp(p_reporte_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte casa_de_paz_reporte;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  -- Ya no existe o ya estaba anulado: idempotente, no es error.
  IF v_reporte.id IS NULL OR v_reporte.fecha_eliminacion IS NOT NULL THEN
    RETURN;
  END IF;

  -- Mismo gate que la edicion (rol + ventana de 7 dias desde fecha_reunion;
  -- Pastor/Supervisor/Super Admin sin limite de fecha).
  IF NOT fn_puede_editar_reporte_cdp(p_reporte_id) THEN
    RAISE EXCEPTION 'REPORTE_ANULAR_SIN_PERMISO: no tenes permiso para anular este reporte (o ya pasaron los 7 dias desde la reunion)'
      USING ERRCODE = 'P0001';
  END IF;

  -- La asistencia no tiene cascada propia -- se baja a mano. Los ingresos
  -- (finanzas_ingreso) caen solos via trg_reporte_cascada_ingresos al setear
  -- fecha_eliminacion en el reporte.
  UPDATE casa_de_paz_asistencia SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE reporte_id = p_reporte_id AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz_reporte SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE id = p_reporte_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_anular_reporte_cdp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_anular_reporte_cdp(UUID) TO authenticated;

-- ============================================================
-- 2) Dedup de los reportes duplicados ya existentes
-- ============================================================
-- Perdedores: todo reporte vigente que NO sea el "ganador" de su grupo
-- (CdP, fecha_reunion) con >1 fila. Ganador = mas asistentes; empate = mas
-- reciente por fecha_creacion.
CREATE TEMP TABLE _reportes_duplicados_perdedores ON COMMIT DROP AS
WITH ranked AS (
  SELECT cr.id,
    row_number() OVER (
      PARTITION BY cr.casa_de_paz_id, cr.fecha_reunion
      ORDER BY (SELECT count(*) FROM casa_de_paz_asistencia a
                WHERE a.reporte_id = cr.id AND a.fecha_eliminacion IS NULL) DESC,
               cr.fecha_creacion DESC
    ) AS rn
  FROM casa_de_paz_reporte cr
  WHERE cr.fecha_eliminacion IS NULL
    AND (cr.casa_de_paz_id, cr.fecha_reunion) IN (
      SELECT casa_de_paz_id, fecha_reunion FROM casa_de_paz_reporte
      WHERE fecha_eliminacion IS NULL
      GROUP BY casa_de_paz_id, fecha_reunion HAVING count(*) > 1
    )
)
SELECT id FROM ranked WHERE rn > 1;

UPDATE casa_de_paz_asistencia SET fecha_eliminacion = now()
WHERE reporte_id IN (SELECT id FROM _reportes_duplicados_perdedores) AND fecha_eliminacion IS NULL;

-- Baja logica del reporte perdedor: trg_reporte_cascada_ingresos da de baja sus
-- finanzas_ingreso al setear fecha_eliminacion.
UPDATE casa_de_paz_reporte SET fecha_eliminacion = now()
WHERE id IN (SELECT id FROM _reportes_duplicados_perdedores);

-- ============================================================
-- 3) Indice unico que faltaba (spec harness 10_reporte.sql, nunca desplegado)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_reporte_cdp_fecha
  ON casa_de_paz_reporte (casa_de_paz_id, fecha_reunion)
  WHERE fecha_eliminacion IS NULL;
