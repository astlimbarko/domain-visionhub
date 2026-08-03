-- VisionHub -- 91_fn_es_lider_de_red_incluye_sublider.sql
-- "El Supervisor de la Red en Acción puede hacer lo mismo que el Líder de
-- Red, ya que es de apoyo" (owner, 2026-08-02) -- paridad completa, no un
-- rol acotado. fn_mis_roles_dashboard (90_) ya unifica el listado para que
-- el frontend use el mismo RolUI/nav, pero cada función de backend que
-- verifica el acceso a una Red puntual (dashboard, Control de Reportes,
-- Visitas, Evangelismo de Red, asignación de metas, etc.) pasa por este
-- único helper -- 17 archivos lo usan. Bug real encontrado en QA: al probar
-- con una cuenta SUBLIDER_RED real, `fn_dashboard_lider_red` rechazaba con
-- "DASHBOARD_FUERA_DE_ALCANCE: sin cargo vigente en la red" porque este
-- helper solo reconocía LIDER_RED. Un solo cambio acá arregla el acceso en
-- las 17 funciones de una sola vez, sin tocar cada una.
CREATE OR REPLACE FUNCTION fn_es_lider_de_red(p_red_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_red_id AND rc.persona_id = fn_mi_persona_id()
      AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED') AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  );
$$;

-- Version iglesia-wide (42_invitacion_lideres.sql) -- usada solo por
-- trg_validar_asignacion_rol para no bloquear un INSERT de SUBLIDER_CDP que
-- fn_invitar_lider ya validó con precisión. Misma paridad.
CREATE OR REPLACE FUNCTION fn_es_lider_de_red_en_iglesia(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id JOIN red r ON r.id = rc.red_id
    WHERE r.iglesia_id = p_iglesia_id AND rc.persona_id = fn_mi_persona_id()
      AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED') AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  );
$$;
