-- VisionHub -- 82_roles_globales_jovenes_matrimonios.sql
-- Bloque 5 del pedido del owner (2026-08-02): dos roles transversales de
-- solo lectura, ortogonales al RolUI (mismo patron que Lider de Afirmacion,
-- 48_funciones_afirmacion.sql / 51_flag_afirmacion_iglesias.sql), asignados
-- como cargo Tipo B de nivel IGLESIA via persona_cargo (igual que
-- SUPERVISOR_VISION_ACCION) en vez de un departamento_cargo, porque no estan
-- atados a ninguno de los 4 departamentos existentes.
--
-- Decisiones del owner:
-- - "Joven" = rango de edad configurable (EDAD_JOVEN_MIN/MAX, mismo patron
--   que EDAD_MINIMA_CREYENTE), no una etiqueta manual en el perfil.
-- - "Matrimonio" = pareja como unidad, inferida de familia.tipo_relacion
--   'CONYUGE' (ya existe, 09_parentela.sql) -- no hay tabla de parejas.
-- - Acceso de solo lectura -- estas RPC no escriben nada.

-- ============================================================
-- 1. Catalogo de cargo + configuracion de rango de edad
-- ============================================================

INSERT INTO cargo (codigo, nombre, tipo, nivel, orden) VALUES
  ('LIDER_JOVENES', 'Lider de Jovenes', 'B', 'IGLESIA', 22),
  ('ENCARGADO_MATRIMONIOS', 'Encargado de Matrimonios', 'B', 'IGLESIA', 23)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, nivel = EXCLUDED.nivel;

INSERT INTO configuracion_definicion (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, modulo, orden) VALUES
  ('EDAD_JOVEN_MIN', 'Edad minima para Jovenes', 'Edad minima, en anios, para que una persona aparezca en el listado global de Jovenes.', 'NUMERICO', '13', 0, 100, 'anios', 'ROLES_GLOBALES', 1, 30),
  ('EDAD_JOVEN_MAX', 'Edad maxima para Jovenes', 'Edad maxima, en anios, para que una persona aparezca en el listado global de Jovenes.', 'NUMERICO', '30', 0, 100, 'anios', 'ROLES_GLOBALES', 1, 31)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, valor_defecto = EXCLUDED.valor_defecto, valor_min = EXCLUDED.valor_min, valor_max = EXCLUDED.valor_max;

-- ============================================================
-- 2. Funciones de acceso (mismo patron que fn_es_lider_afirmacion_en)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_es_lider_jovenes_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona_cargo pc JOIN cargo c ON c.id = pc.cargo_id
    WHERE pc.iglesia_id = p_iglesia_id AND pc.persona_id = fn_mi_persona_id()
      AND c.codigo = 'LIDER_JOVENES' AND pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_es_encargado_matrimonios_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona_cargo pc JOIN cargo c ON c.id = pc.cargo_id
    WHERE pc.iglesia_id = p_iglesia_id AND pc.persona_id = fn_mi_persona_id()
      AND c.codigo = 'ENCARGADO_MATRIMONIOS' AND pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL
  );
$$;

-- fn_mis_iglesias_detalle: RETURNS TABLE cambia de forma -> DROP + CREATE
-- (mismo caso que 51_flag_afirmacion_iglesias.sql cuando sumo su columna).
DROP FUNCTION IF EXISTS fn_mis_iglesias_detalle();

CREATE FUNCTION fn_mis_iglesias_detalle()
RETURNS TABLE (
  id UUID, nombre VARCHAR, ciudad VARCHAR, es_operativo BOOLEAN, es_pastor BOOLEAN,
  es_lider_afirmacion BOOLEAN, es_lider_jovenes BOOLEAN, es_encargado_matrimonios BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id), fn_es_pastor_en(i.id),
         fn_es_lider_afirmacion_en(i.id), fn_es_lider_jovenes_en(i.id), fn_es_encargado_matrimonios_en(i.id)
  FROM iglesia i
  WHERE i.id IN (SELECT fn_mis_iglesias())
    AND i.activo
    AND i.fecha_eliminacion IS NULL
  ORDER BY i.nombre;
$$;

-- ============================================================
-- 3. Listados globales de solo lectura
-- ============================================================

CREATE OR REPLACE FUNCTION fn_jovenes_iglesia(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, nombre_completo TEXT, sexo sexo_enum, edad INT,
  casa_de_paz_etiqueta TEXT, red_nombre TEXT, estado_sigla TEXT, telefono_principal TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_edad_min NUMERIC; v_edad_max NUMERIC;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_jovenes_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'SIN_ACCESO: se requiere ser Lider de Jovenes, Pastor o Supervisor' USING ERRCODE = 'P0001';
  END IF;

  v_edad_min := fn_criterio(p_iglesia_id, 'EDAD_JOVEN_MIN');
  v_edad_max := fn_criterio(p_iglesia_id, 'EDAD_JOVEN_MAX');

  RETURN QUERY
  SELECT
    p.id, fn_nombre_completo(p), p.sexo,
    EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT,
    (SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
     WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT r.nombre FROM casa_de_paz_membresia cm
     JOIN casa_de_paz_red cr ON cr.casa_de_paz_id = cm.casa_de_paz_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
     JOIN red r ON r.id = cr.red_id
     WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT e.sigla FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
     WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL),
    (SELECT t.numero FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
     WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL AND NOT p.oculto
    AND p.fecha_nacimiento IS NOT NULL
    AND EXTRACT(YEAR FROM age(p.fecha_nacimiento)) BETWEEN v_edad_min AND v_edad_max
  ORDER BY fn_nombre_completo(p);
END;
$$;

CREATE OR REPLACE FUNCTION fn_matrimonios_iglesia(p_iglesia_id UUID)
RETURNS TABLE (
  persona1_id UUID, persona1_nombre TEXT, persona1_sexo sexo_enum,
  persona2_id UUID, persona2_nombre TEXT, persona2_sexo sexo_enum,
  casa_de_paz_etiqueta TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_encargado_matrimonios_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'SIN_ACCESO: se requiere ser Encargado de Matrimonios, Pastor o Supervisor' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    p1.id, fn_nombre_completo(p1), p1.sexo,
    p2.id, fn_nombre_completo(p2), p2.sexo,
    (SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
     WHERE cm.persona_id = p1.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL LIMIT 1)
  FROM (
    -- familia no guarda la relacion en ambos sentidos siempre (sin trigger
    -- reciproco) -- LEAST/GREATEST normaliza el par para no duplicar filas
    -- si en algun caso si esta cargada en los dos sentidos.
    SELECT DISTINCT LEAST(f.persona_id, f.familiar_id) AS p1, GREATEST(f.persona_id, f.familiar_id) AS p2
    FROM familia f
    JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id AND tr.codigo = 'CONYUGE'
    WHERE f.fecha_eliminacion IS NULL AND f.iglesia_id = p_iglesia_id
  ) par
  JOIN persona p1 ON p1.id = par.p1 AND p1.fecha_eliminacion IS NULL
  JOIN persona p2 ON p2.id = par.p2 AND p2.fecha_eliminacion IS NULL
  WHERE NOT p1.oculto AND NOT p2.oculto
  ORDER BY fn_nombre_completo(p1);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_jovenes_iglesia(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_matrimonios_iglesia(UUID) TO authenticated;
