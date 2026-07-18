-- VisionHub -- 15_permisos.sql
-- Funciones de permiso reutilizadas por RLS y por otras funciones SECURITY DEFINER.

CREATE OR REPLACE FUNCTION fn_es_lider_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = fn_mi_persona_id()
      AND c.codigo = 'LIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_es_sublider_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = fn_mi_persona_id()
      AND c.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_es_lider_de_red(p_red_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_red_id AND rc.persona_id = fn_mi_persona_id()
      AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  );
$$;

-- Pastor/Supervisor de la iglesia, o lider/sublider vigente de esta CdP.
CREATE OR REPLACE FUNCTION fn_puede_reportar_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    fn_es_operativo_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR fn_es_lider_cdp(p_casa_de_paz_id)
    OR fn_es_sublider_cdp(p_casa_de_paz_id);
$$;

-- Movida de 14_finanzas.sql: es LANGUAGE SQL y llama a fn_es_lider_cdp/
-- fn_es_sublider_cdp, que no existian todavia alla.
CREATE OR REPLACE FUNCTION fn_puede_ver_ingresos_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    fn_es_rol_superior_de_cdp(p_casa_de_paz_id)
    OR fn_es_lider_cdp(p_casa_de_paz_id)
    OR (
      fn_es_sublider_cdp(p_casa_de_paz_id)
      AND fn_config_bool((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id), 'SUBLIDER_VE_OFRENDAS')
    );
$$;
