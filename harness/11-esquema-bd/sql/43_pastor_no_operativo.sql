-- VisionHub -- 43_pastor_no_operativo.sql
-- El Pastor deja de ser operativo. Hasta ahora fn_es_operativo_en devolvia
-- true para Pastor OR Supervisor de la Vision en Accion, asi que un Pastor
-- tenia via RLS los mismos privilegios de escritura que un Supervisor:
-- crear Redes/CdP, asignar lideres, fusionar/multiplicar. El spec de roles
-- (Rol 5, Pastor) es explicito: el Pastor solo supervisa y consulta
-- informacion global (Dashboard + Reportes), no hace movimientos
-- estructurales. Decision del owner, 2026-07-19.
--
-- 1. fn_es_operativo_en ya NO incluye a Pastor. El efecto se propaga solo a
-- todo lo que ya dependia de este patron (paneles, fusiones,
-- multiplicaciones, creacion de Red/CdP, asignacion de cargos,
-- fn_mis_roles_dashboard, fn_mis_iglesias_detalle, etc.) sin tocar cada
-- politica una por una. Las politicas de solo lectura no usan esta funcion
-- (usan iglesia_id IN fn_mis_iglesias()), asi que el Pastor sigue pudiendo
-- leer toda la estructura -- solo pierde la escritura.
CREATE OR REPLACE FUNCTION fn_es_operativo_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND iglesia_id = p_iglesia_id
      AND rol = 'SUPERVISOR_VISION_ACCION' AND fecha_eliminacion IS NULL
  );
$$;

-- 2. El frontend hoy no tiene forma de saber "soy pastor de esta iglesia"
-- de forma independiente de es_operativo -- por eso determinarRolUI()
-- adivinaba el rol Pastor a partir de "tiene acceso a mas de una iglesia".
-- Se expone es_pastor explicito. RETURNS TABLE no admite agregar una
-- columna via CREATE OR REPLACE, hace falta DROP + CREATE.
DROP FUNCTION IF EXISTS fn_mis_iglesias_detalle();

CREATE FUNCTION fn_mis_iglesias_detalle()
RETURNS TABLE (id UUID, nombre VARCHAR, ciudad VARCHAR, es_operativo BOOLEAN, es_pastor BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id), fn_es_pastor_en(i.id)
  FROM iglesia i
  WHERE i.id IN (SELECT fn_mis_iglesias())
    AND i.activo
    AND i.fecha_eliminacion IS NULL
  ORDER BY i.nombre;
$$;
