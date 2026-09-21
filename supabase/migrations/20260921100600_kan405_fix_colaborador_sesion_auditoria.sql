-- VisionHub -- KAN-405 seguimiento (2026-09-21, mismo día): fix de un bug
-- real encontrado en vivo probando "Pausar".
--
-- trg_auditoria_colaborador_sesion usa fn_auditoria() (02_funciones_base.sql),
-- que en TG_OP='UPDATE' siempre lee/escribe NEW.fecha_eliminacion y
-- NEW.eliminado_por -- pero colaborador_sesion se creó sin esas 2 columnas
-- (a proposito, no hay concepto de "borrado logico" para una sesion, el
-- ciclo de vida ya lo cubre el enum `estado`). Resultado: CUALQUIER UPDATE
-- sobre colaborador_sesion (pausar/reanudar/finalizar/extender) fallaba en
-- runtime con "record new has no field fecha_eliminacion" -- el INSERT
-- (redimir codigo) no lo disparaba porque esa rama del trigger no toca esas
-- columnas.
--
-- Fix: agregar las 2 columnas para que la tabla tenga la forma que
-- fn_auditoria() espera (mismo patron que TODAS las demas tablas del
-- proyecto con este trigger) -- no se usan para borrado logico real, quedan
-- siempre NULL, pero el trigger las necesita para no romper.
ALTER TABLE colaborador_sesion
  ADD COLUMN fecha_eliminacion TIMESTAMPTZ,
  ADD COLUMN eliminado_por     UUID REFERENCES auth.users(id);
