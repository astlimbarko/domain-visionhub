-- VisionHub -- 106_revertir_bloqueo_sublider_evangelismo.sql
-- Revierte 105_evangelismo_bloquear_sublider_registro.sql a pedido explicito
-- del owner (2026-08-06): "restaura todo excepto lo de la correccion de
-- asignacion de metas del supervisor" -- se interpreto (confirmado por el
-- owner via pregunta directa) como: deshacer el endurecimiento de permisos
-- que agregue por mi cuenta durante el QA (105), mantener todo lo demas tal
-- cual quedo, incluida la correccion real que motivo el QA (el vinculo
-- persona.usuario_id del Supervisor, que no es un cambio de esquema).
--
-- pol_evangelismo_insert/update vuelven a usar fn_puede_reportar_cdp (la
-- definicion original de 16_rls.sql), o sea el Sublider de CdP recupera el
-- permiso de insertar/actualizar registros de evangelismo directo por API.
-- fn_puede_registrar_evangelismo queda definida pero sin uso (no se borra,
-- por si se retoma esta restriccion mas adelante -- convencion de migraciones
-- append-only de este proyecto).

DROP POLICY IF EXISTS pol_evangelismo_insert ON evangelismo;
CREATE POLICY pol_evangelismo_insert ON evangelismo
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

DROP POLICY IF EXISTS pol_evangelismo_update ON evangelismo;
CREATE POLICY pol_evangelismo_update ON evangelismo
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));
