-- VisionHub -- 22_permisos_panel_supervisor.sql
-- Hallazgo al construir la pantalla de Panel del Supervisor en el frontend:
-- `departamento` y `iglesia_moneda` quedaron con la politica GENERICA de
-- 16_rls.sql ("iglesia_id IN fn_mis_iglesias()"), que permite escribir a
-- CUALQUIER usuario con acceso a la iglesia -- un LIDER_CDP comun podia
-- activar/desactivar un departamento o una moneda via la API REST directa,
-- aunque el panel del frontend nunca se lo iba a mostrar. Viola 03-estructura
-- Requisito 6.3 ("solo el Supervisor activa/desactiva Departamentos") y el
-- principio de 10-panel-supervisor Requisito 1 ("solo Pastor/Supervisor").
--
-- Se reemplazan las policies de UPDATE (e INSERT, por prolijidad: activar una
-- moneda nueva tambien es una decision de configuracion) de esas dos tablas
-- por unas que exigen fn_es_operativo_en. SELECT no cambia: seguir viendo que
-- departamentos/monedas existen no es un problema, escribirlos si.

DROP POLICY IF EXISTS pol_departamento_insert ON departamento;
DROP POLICY IF EXISTS pol_departamento_update ON departamento;

CREATE POLICY pol_departamento_insert ON departamento
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

CREATE POLICY pol_departamento_update ON departamento
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id))
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

DROP POLICY IF EXISTS pol_iglesia_moneda_insert ON iglesia_moneda;
DROP POLICY IF EXISTS pol_iglesia_moneda_update ON iglesia_moneda;

CREATE POLICY pol_iglesia_moneda_insert ON iglesia_moneda
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

CREATE POLICY pol_iglesia_moneda_update ON iglesia_moneda
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id))
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));
