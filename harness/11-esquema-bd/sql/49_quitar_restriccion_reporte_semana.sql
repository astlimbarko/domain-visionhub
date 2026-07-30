-- VisionHub -- 49_quitar_restriccion_reporte_semana.sql
-- Revierte 26_reporte_semana.sql: ya no existe el límite de "un Reporte por
-- semana" por Casa de Paz. Pedido del owner (2026-07-29) -- una CdP puede
-- enviar más de un Reporte en la misma semana sin que el sistema lo bloquee
-- ni lo avise como error.

DROP INDEX IF EXISTS uq_reporte_cdp_semana;

ALTER TABLE casa_de_paz_reporte
  DROP COLUMN IF EXISTS semana_inicio;
