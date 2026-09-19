-- VisionHub -- KAN-402 (2026-09-18, pedido explícito del owner): el carnet
-- de identidad (CI) compuesto solo por ceros (cualquier cantidad: "0",
-- "00000000", etc.) es un placeholder para "todavía no lo sé, se completa
-- después" -- no debe contar como duplicado entre sí. El índice único
-- uq_persona_ci ya excluía NULL y personas eliminadas; se agrega la misma
-- excepción para "puros ceros" con un regex ancla (^0+$).
DROP INDEX IF EXISTS uq_persona_ci;
CREATE UNIQUE INDEX uq_persona_ci ON public.persona (ci)
  WHERE (ci IS NOT NULL AND fecha_eliminacion IS NULL AND ci !~ '^0+$');
