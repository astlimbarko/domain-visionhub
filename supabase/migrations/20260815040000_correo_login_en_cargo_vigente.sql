-- VisionHub -- fn_cargo_vigente_cdp / fn_cargo_vigente_red (KAN-205)
-- Bug real 2026-08-15 (reportado por el owner con captura, p.png): el
-- diálogo de asignar cargo mostraba "Sin nombre" para una persona sin
-- nombre cargado, en vez de caer a su correo -- porque el correo que se
-- consultaba (persona.correo) es un campo de perfil aparte, casi siempre
-- vacío, distinto del correo real de inicio de sesión (que vive en
-- auth.users, no accesible desde una consulta PostgREST normal). Regla
-- pedida explícitamente por el owner para todo VisionHub: "si no hay
-- nombre, mostrar correo, siempre".
--
-- Reemplaza las consultas client-side (.from('casa_de_paz_cargo').select(...)
-- / .from('red_cargo').select(...)) por 2 RPC nuevas que resuelven el correo
-- real vía auth.users (accesible solo dentro de una función SECURITY
-- DEFINER), con el mismo gate de visibilidad que ya usan fn_puede_ver_cdp/
-- fn_puede_ver_red (ambas ya incluyen fn_es_super_admin()).
CREATE OR REPLACE FUNCTION public.fn_cargo_vigente_cdp(p_cdp_id uuid, p_codigo text)
RETURNS TABLE(id uuid, persona_id uuid, fecha_inicio date, correo text, nombre_completo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    cc.id,
    cc.persona_id,
    cc.fecha_inicio,
    COALESCE(NULLIF(trim(p.correo), ''), au.email) AS correo,
    trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre_completo
  FROM casa_de_paz_cargo cc
  JOIN cargo ca ON ca.id = cc.cargo_id
  JOIN persona p ON p.id = cc.persona_id
  LEFT JOIN auth.users au ON au.id = p.usuario_id
  WHERE cc.casa_de_paz_id = p_cdp_id
    AND ca.codigo = p_codigo
    AND cc.fecha_fin IS NULL
    AND cc.fecha_eliminacion IS NULL
    AND public.fn_puede_ver_cdp(p_cdp_id);
$$;

CREATE OR REPLACE FUNCTION public.fn_cargo_vigente_red(p_red_id uuid, p_codigo text)
RETURNS TABLE(id uuid, persona_id uuid, fecha_inicio date, correo text, nombre_completo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    rc.id,
    rc.persona_id,
    rc.fecha_inicio,
    COALESCE(NULLIF(trim(p.correo), ''), au.email) AS correo,
    trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre_completo
  FROM red_cargo rc
  JOIN cargo ca ON ca.id = rc.cargo_id
  JOIN persona p ON p.id = rc.persona_id
  LEFT JOIN auth.users au ON au.id = p.usuario_id
  WHERE rc.red_id = p_red_id
    AND ca.codigo = p_codigo
    AND rc.fecha_fin IS NULL
    AND public.fn_puede_ver_red(p_red_id);
$$;

REVOKE ALL ON FUNCTION public.fn_cargo_vigente_cdp(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cargo_vigente_cdp(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_cargo_vigente_red(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cargo_vigente_red(uuid, text) TO authenticated;
