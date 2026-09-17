-- VisionHub -- KAN-251, punto 2/4 continuación (2026-09-17): la RLS de
-- usuario_rol (pol_usuario_rol_insert) tiene el MISMO chequeo que ya se
-- relajó dentro del trigger fn_validar_asignacion_rol (migración
-- 20260917140000) -- son 2 capas independientes, hay que relajar las dos o
-- la RLS bloquea antes de que el trigger llegue a evaluar nada. Probado en
-- vivo con auth simulado (Pastor de Génesis intentando asignar
-- SUPERVISOR_VISION_ACCION en la CdP satélite de prueba): el trigger ya
-- dejaba pasar, la RLS todavía no.

DROP POLICY IF EXISTS pol_usuario_rol_insert ON usuario_rol;

CREATE POLICY pol_usuario_rol_insert ON usuario_rol FOR INSERT TO authenticated WITH CHECK (
  iglesia_id IS NULL
  OR iglesia_id IN (SELECT fn_mis_iglesias())
  OR EXISTS (
    SELECT 1 FROM iglesia x
    WHERE fn_son_madre_satelite_vigente(iglesia_id, x.id) AND x.id IN (SELECT fn_mis_iglesias())
  )
);
