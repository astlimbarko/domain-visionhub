-- VisionHub -- 105_evangelismo_bloquear_sublider_registro.sql
-- Bug real encontrado en QA (2026-08-06), buscando activamente formas de
-- romper los permisos de cada rol en un sandbox (sin tocar datos reales).
--
-- Evangelismo.tsx documenta como decision explicita del owner (2026-07-31):
-- "El sublider ve Evangelismo en modo solo lectura -- no puede registrar
-- evangelizados ni tocar la meta propia". El frontend cumple: el boton
-- "Nuevo evangelizado" y "Guardar" (meta propia) estan ocultos para
-- esSublider. La meta propia SI esta bien protegida en el backend
-- (pol_casa_de_paz_update exige fn_es_lider_cdp(id) OR fn_es_rol_superior_de_cdp(id),
-- que no incluye sublider) -- pero pol_evangelismo_insert/update
-- (16_rls.sql) reusaban fn_puede_reportar_cdp, que SI incluye
-- fn_es_sublider_cdp() (a proposito, para que el sublider pueda subir
-- reportes semanales -- un permiso legitimo y distinto). Resultado: un
-- Sublider de CdP que baje directo a la API (bypaseando el boton oculto)
-- SI podia insertar/actualizar registros de evangelismo, contradiciendo la
-- decision del owner -- la restriccion solo existia en el frontend.
--
-- Fix: nueva funcion fn_puede_registrar_evangelismo, misma logica que ya usa
-- pol_casa_de_paz_update para la meta propia (fn_es_lider_cdp OR
-- fn_es_rol_superior_de_cdp -- excluye sublider a proposito). Se reemplazan
-- las dos policies de evangelismo para usarla en vez de fn_puede_reportar_cdp.
-- fn_puede_reportar_cdp NO se toca -- casa_de_paz_reporte/casa_de_paz_asistencia
-- siguen permitiendo al sublider subir reportes, que es el comportamiento
-- correcto y ya probado.

CREATE OR REPLACE FUNCTION fn_puede_registrar_evangelismo(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_lider_cdp(p_casa_de_paz_id) OR fn_es_rol_superior_de_cdp(p_casa_de_paz_id);
$$;

DROP POLICY IF EXISTS pol_evangelismo_insert ON evangelismo;
CREATE POLICY pol_evangelismo_insert ON evangelismo
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_registrar_evangelismo(casa_de_paz_id));

DROP POLICY IF EXISTS pol_evangelismo_update ON evangelismo;
CREATE POLICY pol_evangelismo_update ON evangelismo
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_registrar_evangelismo(casa_de_paz_id));
