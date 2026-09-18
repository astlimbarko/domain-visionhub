-- VisionHub -- KAN-388, corrección de precisión pedida por el owner
-- (2026-09-17): "Los anuncios cargan más rápido" estaba con
-- alcance_codigo='GLOBAL' -- error de clasificación real, no un bug de
-- fn_avances_visibles. `ROUTES.ANUNCIOS` (verificado en permisos.ts) solo
-- está en RUTAS_LIDER_RED y RUTAS_SUPERVISOR/RUTAS_PASTOR -- Líder/
-- Sublíder de CdP no tienen la funcionalidad de Anuncios en absoluto, así
-- que no tiene sentido que la vean como avance.
UPDATE avance SET alcance_codigo = 'RED' WHERE titulo = 'Los anuncios cargan más rápido';
