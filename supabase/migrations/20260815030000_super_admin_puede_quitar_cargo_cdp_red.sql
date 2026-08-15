-- VisionHub -- RLS UPDATE de casa_de_paz_cargo/red_cargo permite Super Admin (KAN-204)
-- Mismo hueco que KAN-203 pero en la baja, no en la asignacion: "quitar"
-- (el boton X en AsignarCargoDialog) hace un UPDATE directo por PostgREST
-- (quitarCargoCdp/quitarCargoRed en casas-de-paz.service.ts), sujeto a RLS
-- -- no pasa por ninguna funcion SECURITY DEFINER con su propio chequeo.
-- La politica de UPDATE nunca incluia fn_es_super_admin(), asi que para un
-- Super Admin el UPDATE afectaba 0 filas SIN error (PostgREST no falla en
-- un update de 0 filas) -- el dialogo pedia confirmacion, el usuario
-- confirmaba, pero el cargo jamas se quitaba y no aparecia ningun aviso de
-- error. Reportado por el owner en vivo (2026-08-15).
DROP POLICY IF EXISTS pol_casa_de_paz_cargo_update ON public.casa_de_paz_cargo;
CREATE POLICY pol_casa_de_paz_cargo_update ON public.casa_de_paz_cargo FOR UPDATE TO authenticated
USING (
  fn_es_super_admin()
  OR (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR EXISTS (
        SELECT 1 FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = casa_de_paz_cargo.casa_de_paz_id
          AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND fn_es_lider_de_red(cdr.red_id)
      )
    )
  )
)
WITH CHECK (
  fn_es_super_admin()
  OR (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR EXISTS (
        SELECT 1 FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = casa_de_paz_cargo.casa_de_paz_id
          AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND fn_es_lider_de_red(cdr.red_id)
      )
    )
  )
);

DROP POLICY IF EXISTS pol_red_cargo_update ON public.red_cargo;
CREATE POLICY pol_red_cargo_update ON public.red_cargo FOR UPDATE TO authenticated
USING (
  fn_es_super_admin()
  OR (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id)))
)
WITH CHECK (
  fn_es_super_admin()
  OR (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id)))
);
