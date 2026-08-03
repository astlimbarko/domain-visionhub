-- 95: security_invoker en las 7 vistas expuestas (v_*) + indices faltantes en
-- tablas de cargo/membresia.
--
-- Motivo (vistas): las vistas v_persona, v_casa_de_paz, v_red, v_iglesia,
-- v_persona_cargo_vigente, v_reporte_evangelismo y v_reporte_totales fueron
-- creadas por "postgres" (rolbypassrls = true) sin security_invoker=true.
-- Postgres corre una vista sin esa opcion con los permisos del dueno, no de
-- quien consulta -- entonces cualquier usuario autenticado que le pegue
-- directo a la vista via la API REST se salta las politicas RLS de la tabla
-- base (ej. persona.pol_persona_select limita a "solo mi iglesia"; via
-- v_persona eso no aplicaba). El comentario original en 16_rls.sql ("se
-- exponen ademas de las tablas base") ya daba a entender que debian respetar
-- las mismas politicas -- esto solo corrige el default que faltaba.
--
-- No rompe las funciones SECURITY DEFINER que usan estas vistas por dentro
-- (fn_alertas_supervisor, fn_dashboard_lider_cdp, fn_dashboard_lider_red,
-- fn_dashboard_supervisor, fn_evaluar_estado_por_asistencia): al ser
-- SECURITY DEFINER, el "invoker" efectivo durante su ejecucion sigue siendo
-- el dueno de la funcion, no cambia nada para ellas. La unica funcion no-
-- definer que dependia de una de estas vistas (fn_kpi_asistencia_ultima,
-- via v_reporte_totales) pasa a respetar RLS tambien, que es el
-- comportamiento correcto.
ALTER VIEW public.v_persona SET (security_invoker = true);
ALTER VIEW public.v_casa_de_paz SET (security_invoker = true);
ALTER VIEW public.v_red SET (security_invoker = true);
ALTER VIEW public.v_iglesia SET (security_invoker = true);
ALTER VIEW public.v_persona_cargo_vigente SET (security_invoker = true);
ALTER VIEW public.v_reporte_evangelismo SET (security_invoker = true);
ALTER VIEW public.v_reporte_totales SET (security_invoker = true);

-- Motivo (indices): red_cargo y casa_de_paz_cargo solo tenian indice en su
-- propia pkey (id) -- ninguna busqueda por persona_id/red_id/casa_de_paz_id
-- (que es como las consulta fn_es_lider_cdp, fn_es_lider_de_red,
-- fn_personas_de_red, etc.) tenia indice de apoyo. casa_de_paz_membresia
-- tampoco tenia indice general por casa_de_paz_id. La condicion parcial
-- calca exactamente el patron real de esas consultas
-- (fecha_fin IS NULL AND fecha_eliminacion IS NULL).
CREATE INDEX IF NOT EXISTS idx_red_cargo_persona
  ON public.red_cargo (persona_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE INDEX IF NOT EXISTS idx_red_cargo_red
  ON public.red_cargo (red_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE INDEX IF NOT EXISTS idx_casa_de_paz_cargo_persona
  ON public.casa_de_paz_cargo (persona_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE INDEX IF NOT EXISTS idx_casa_de_paz_cargo_cdp
  ON public.casa_de_paz_cargo (casa_de_paz_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE INDEX IF NOT EXISTS idx_casa_de_paz_membresia_cdp
  ON public.casa_de_paz_membresia (casa_de_paz_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;
