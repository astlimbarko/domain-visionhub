-- VisionHub -- 32_ministerios.sql
-- Cierra 03-estructura Requisito 5 (Ministerios). Las tablas (ministerio,
-- ministerio_persona), el seed de los 14 ministerios y los permisos RLS ya
-- existian (08_estructura.sql, seed_04_por_iglesia.sql, 27_permisos_estructura.sql).
-- Falta el listado para el frontend -- PostgREST no arma estos JOINs con un
-- select embebido -- mismo patron que fn_listar_redes/fn_listar_cdp.

CREATE OR REPLACE FUNCTION fn_listar_ministerios(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, nombre VARCHAR, activo BOOLEAN, orden SMALLINT,
  lider_nombre TEXT, participantes_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    m.id, m.nombre, m.activo, m.orden,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN ministerio_persona mp ON mp.persona_id = p.id
     WHERE mp.ministerio_id = m.id AND mp.es_lider
       AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL LIMIT 1) AS lider_nombre,
    (SELECT count(*) FROM ministerio_persona mp
     WHERE mp.ministerio_id = m.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL) AS participantes_count
  FROM ministerio m
  WHERE m.iglesia_id = p_iglesia_id AND m.fecha_eliminacion IS NULL
  ORDER BY m.orden, m.nombre;
$$;

CREATE OR REPLACE FUNCTION fn_listar_participantes_ministerio(p_ministerio_id UUID)
RETURNS TABLE (
  id UUID, persona_id UUID, nombre_completo TEXT, es_lider BOOLEAN, red_nombre TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    mp.id, mp.persona_id, fn_nombre_completo(p) AS nombre_completo, mp.es_lider,
    COALESCE(r.nombre, 'Sin Red')
  FROM ministerio_persona mp
  JOIN persona p ON p.id = mp.persona_id
  LEFT JOIN casa_de_paz_membresia mem ON mem.persona_id = mp.persona_id
       AND mem.es_principal AND mem.fecha_fin IS NULL AND mem.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = mem.casa_de_paz_id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE mp.ministerio_id = p_ministerio_id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
  ORDER BY mp.es_lider DESC, nombre_completo;
$$;

-- Bug real encontrado al probar el frontend: pol_ministerio_persona_insert/update
-- (27_permisos_estructura.sql) hacia un EXISTS inline sobre ministerio_persona
-- dentro de su propia politica -- "infinite recursion detected in policy for
-- relation ministerio_persona" (42P17). El resto de politicas de esta sesion
-- evitan eso envolviendo el chequeo en una funcion SECURITY DEFINER (mismo
-- patron que fn_es_lider_de_red/fn_es_lider_cdp en 15_permisos.sql, que SI
-- consultan su propia tabla protegida sin problema porque corren como el
-- dueno de la funcion, que bypasea RLS). Se reemplaza el EXISTS inline por
-- fn_es_lider_de_ministerio.
CREATE OR REPLACE FUNCTION fn_es_lider_de_ministerio(p_ministerio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ministerio_persona mp
    WHERE mp.ministerio_id = p_ministerio_id AND mp.persona_id = fn_mi_persona_id()
      AND mp.es_lider AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
  );
$$;

DROP POLICY IF EXISTS pol_ministerio_persona_insert ON ministerio_persona;
DROP POLICY IF EXISTS pol_ministerio_persona_update ON ministerio_persona;

CREATE POLICY pol_ministerio_persona_insert ON ministerio_persona
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_ministerio(ministerio_id))
  );

CREATE POLICY pol_ministerio_persona_update ON ministerio_persona
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_ministerio(ministerio_id))
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_ministerio(ministerio_id))
  );
