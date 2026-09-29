-- KAN-480: fn_afirmacion_estadisticas_personas (KAN-479) hace una
-- subconsulta correlacionada contra persona_llegada por cada persona, una
-- vez por cada una de sus 9 sub-consultas -- sin indice por persona_id,
-- Postgres hace un Seq Scan completo de la tabla en cada llamada (confirmado
-- con EXPLAIN ANALYZE). Con pocos datos no se nota, pero escala mal.

CREATE INDEX IF NOT EXISTS idx_persona_llegada_persona_activa
  ON public.persona_llegada (persona_id)
  WHERE fecha_eliminacion IS NULL;
