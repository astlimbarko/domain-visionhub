-- VisionHub -- 26_reporte_semana.sql
-- Aclaracion del owner (2026-07-18): un Reporte no es "uno por fecha exacta",
-- es "uno por semana". Una Casa de Paz puede reunirse mas de una vez en la
-- misma semana (recupera una reunion atrasada, o se adelanta a la semana
-- siguiente) y eso esta bien -- lo que nunca puede pasar es que dos reportes
-- cuenten para la misma semana. `fecha_reunion` sigue siendo el dia real en
-- que se hizo la reunion; `semana_inicio` (el lunes ISO de esa semana) es lo
-- que se usa para la unicidad.
--
-- `uq_reporte_cdp_fecha` (por fecha exacta) queda reemplazado por
-- `uq_reporte_cdp_semana` (por semana). El formulario sigue pidiendo una
-- sola fecha (la de la reunion real); el sistema calcula sola la semana y
-- avisa si esa semana ya tiene reporte.

-- date_trunc('week', date) no es IMMUTABLE (Postgres la resuelve a la
-- variante timestamptz, que depende del huso horario), asi que no sirve para
-- una columna generada. Aritmetica pura con ISODOW si es IMMUTABLE.
ALTER TABLE casa_de_paz_reporte
  ADD COLUMN semana_inicio DATE
    GENERATED ALWAYS AS (fecha_reunion - (EXTRACT(ISODOW FROM fecha_reunion)::integer - 1)) STORED;

DROP INDEX IF EXISTS uq_reporte_cdp_fecha;

CREATE UNIQUE INDEX uq_reporte_cdp_semana
  ON casa_de_paz_reporte (casa_de_paz_id, semana_inicio)
  WHERE fecha_eliminacion IS NULL;
