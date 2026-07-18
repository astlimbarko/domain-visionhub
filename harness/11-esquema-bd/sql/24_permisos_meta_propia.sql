-- VisionHub -- 24_permisos_meta_propia.sql
-- Hallazgo al construir el frontend de Evangelismo (06-evangelismo-cdp):
-- `casa_de_paz` quedo con la politica UPDATE
-- generica de 16_rls.sql ("iglesia_id IN fn_mis_iglesias()"), que permite a
-- CUALQUIER usuario con acceso a la iglesia escribir CUALQUIER columna de
-- CUALQUIER Casa de Paz -- incluida meta_evangelismo. Viola 06-evangelismo-cdp
-- Requisito 3.5 ("solo el Lider de esa CdP o un Rol_Superior fija la Meta
-- Propia"). Mismo patron que 22_permisos_panel_supervisor.sql.

DROP POLICY IF EXISTS pol_casa_de_paz_update ON casa_de_paz;

CREATE POLICY pol_casa_de_paz_update ON casa_de_paz
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_lider_cdp(id) OR fn_es_rol_superior_de_cdp(id))
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_lider_cdp(id) OR fn_es_rol_superior_de_cdp(id))
  );
