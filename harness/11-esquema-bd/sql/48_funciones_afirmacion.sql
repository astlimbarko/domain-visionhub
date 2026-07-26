-- VisionHub -- 48_funciones_afirmacion.sql
-- 14-afirmacion. Funciones de acceso para el modelo departamental. Mismo
-- patron SECURITY DEFINER que fn_es_lider_cdp/fn_es_lider_de_red (15_permisos.sql).

CREATE OR REPLACE FUNCTION fn_es_lider_departamento(p_iglesia_id UUID, p_departamento_codigo VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM departamento_cargo dc
    JOIN departamento d ON d.id = dc.departamento_id
    JOIN cargo c ON c.id = dc.cargo_id
    WHERE dc.iglesia_id = p_iglesia_id
      AND dc.persona_id = fn_mi_persona_id()
      AND d.codigo = p_departamento_codigo
      AND c.codigo = 'LIDER_DEPARTAMENTO'
      AND dc.fecha_fin IS NULL AND dc.fecha_eliminacion IS NULL
  );
$$;

-- Azucar de legibilidad para RLS/RPC: el caso concreto de esta entrega.
CREATE OR REPLACE FUNCTION fn_es_lider_afirmacion_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_lider_departamento(p_iglesia_id, 'AFIRMACION');
$$;
