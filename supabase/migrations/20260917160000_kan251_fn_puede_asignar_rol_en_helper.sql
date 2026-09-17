-- VisionHub -- KAN-251 (2026-09-17), corrección real encontrada probando
-- en vivo con auth simulado: la RLS de usuario_rol (migración 20260917150000)
-- seguía bloqueando aunque la MISMA expresión evaluada como SELECT suelto
-- daba true. Causa: `EXISTS (SELECT 1 FROM iglesia x WHERE ...)` dentro de
-- la política queda sujeta a la RLS de SELECT de `iglesia`
-- (pol_iglesia_select, `id IN fn_mis_iglesias()`) porque el `FROM iglesia`
-- ahí NO corre dentro de una función SECURITY DEFINER -- corre como el rol
-- `authenticated` de verdad, con su propia RLS de lectura. Se movió TODA
-- la lógica a una función nueva, SECURITY DEFINER, que no expone ningún
-- `FROM iglesia` crudo fuera de una función -- así queda protegida de este
-- mismo problema en cualquier política futura que la use.

CREATE OR REPLACE FUNCTION public.fn_puede_asignar_rol_en(p_iglesia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_iglesia_id IN (SELECT fn_mis_iglesias())
    OR EXISTS (
      SELECT 1 FROM iglesia x
      WHERE fn_son_madre_satelite_vigente(p_iglesia_id, x.id) AND x.id IN (SELECT fn_mis_iglesias())
    );
$function$;

DROP POLICY IF EXISTS pol_usuario_rol_insert ON usuario_rol;

CREATE POLICY pol_usuario_rol_insert ON usuario_rol FOR INSERT TO authenticated WITH CHECK (
  iglesia_id IS NULL OR fn_puede_asignar_rol_en(iglesia_id)
);
