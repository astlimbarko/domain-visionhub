-- VisionHub -- 27_permisos_estructura.sql
-- Hallazgo al construir el frontend de Casas de Paz (03-estructura): la
-- misma politica generica de 16_rls.sql ("iglesia_id IN fn_mis_iglesias()")
-- quedo sin acotar en `red`, `casa_de_paz` (solo INSERT; UPDATE ya se
-- corrigio en 24_permisos_meta_propia.sql), `casa_de_paz_red`, `red_cargo`,
-- `casa_de_paz_cargo`, `casa_de_paz_membresia`, `ministerio` y
-- `ministerio_persona`. En la practica, CUALQUIER usuario autenticado con
-- acceso a la iglesia podia -- via la API REST directa, sin pasar por el
-- frontend -- crear una Red nueva, asignarse a si mismo Lider de Red o
-- Lider de Casa de Paz de cualquier CdP, mover una CdP a otra Red, o borrar
-- la membresia de otra persona. Mismo patron que 22_ y 24_.
--
-- SELECT no cambia en ninguna de estas tablas: seguir leyendo la estructura
-- de la propia iglesia no es un problema, escribirla sin control si.

-- ============================================================
-- red: solo Pastor/Supervisor crea redes; el propio Lider de Red tambien
-- puede editar la suya (decision ya tomada esta sesion: "el Lider de Red
-- ve su red y decide sobre ella").
-- ============================================================
DROP POLICY IF EXISTS pol_red_insert ON red;
DROP POLICY IF EXISTS pol_red_update ON red;

CREATE POLICY pol_red_insert ON red
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

CREATE POLICY pol_red_update ON red
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(id)))
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(id)));

-- ============================================================
-- casa_de_paz: INSERT solamente (UPDATE ya esta acotado). Una fila sin
-- casa_de_paz_red vigente no sirve para nada todavia -- el control fino de
-- "a que red" vive en la policy de casa_de_paz_red, mas abajo -- pero igual
-- se exige ser operativo o liderar alguna red de esa iglesia, para no dejar
-- que cualquiera cree CdP sueltas.
-- ============================================================
DROP POLICY IF EXISTS pol_casa_de_paz_insert ON casa_de_paz;

CREATE POLICY pol_casa_de_paz_insert ON casa_de_paz
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR EXISTS (
        SELECT 1 FROM red_cargo rc
        JOIN cargo c ON c.id = rc.cargo_id
        JOIN red r ON r.id = rc.red_id
        WHERE rc.persona_id = fn_mi_persona_id() AND c.codigo = 'LIDER_RED'
          AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
          AND r.iglesia_id = casa_de_paz.iglesia_id
      )
    )
  );

-- ============================================================
-- casa_de_paz_red: solo el Lider de la Red destino (o un operativo) puede
-- enganchar una CdP a esa Red. Cierra el hueco real: con la policy
-- generica, cualquier Lider de CdP podia mover su propia CdP -- o la de
-- otro -- a una Red ajena sin que su Lider de Red se enterara.
-- ============================================================
DROP POLICY IF EXISTS pol_casa_de_paz_red_insert ON casa_de_paz_red;
DROP POLICY IF EXISTS pol_casa_de_paz_red_update ON casa_de_paz_red;

CREATE POLICY pol_casa_de_paz_red_insert ON casa_de_paz_red
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id))
  );

CREATE POLICY pol_casa_de_paz_red_update ON casa_de_paz_red
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id))
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id))
  );

-- ============================================================
-- red_cargo: el Lider de Red administra los cargos de su propia Red
-- (sublideres, encargados). Nombrar al primer Lider de Red de una Red
-- nueva sigue siendo tarea del operativo, porque antes de que exista un
-- Lider de Red vigente, fn_es_lider_de_red da false.
-- ============================================================
DROP POLICY IF EXISTS pol_red_cargo_insert ON red_cargo;
DROP POLICY IF EXISTS pol_red_cargo_update ON red_cargo;

CREATE POLICY pol_red_cargo_insert ON red_cargo
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id))
  );

CREATE POLICY pol_red_cargo_update ON red_cargo
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id))
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_de_red(red_id))
  );

-- ============================================================
-- casa_de_paz_cargo: el propio Lider de CdP administra su Sublider y su
-- Anfitrion; el Lider de la Red de esa CdP puede nombrar (o reemplazar) al
-- Lider de CdP.
-- ============================================================
DROP POLICY IF EXISTS pol_casa_de_paz_cargo_insert ON casa_de_paz_cargo;
DROP POLICY IF EXISTS pol_casa_de_paz_cargo_update ON casa_de_paz_cargo;

CREATE POLICY pol_casa_de_paz_cargo_insert ON casa_de_paz_cargo
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR EXISTS (
        SELECT 1 FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = casa_de_paz_cargo.casa_de_paz_id
          AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND fn_es_lider_de_red(cdr.red_id)
      )
    )
  );

CREATE POLICY pol_casa_de_paz_cargo_update ON casa_de_paz_cargo
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR EXISTS (
        SELECT 1 FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = casa_de_paz_cargo.casa_de_paz_id
          AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND fn_es_lider_de_red(cdr.red_id)
      )
    )
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR EXISTS (
        SELECT 1 FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = casa_de_paz_cargo.casa_de_paz_id
          AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
          AND fn_es_lider_de_red(cdr.red_id)
      )
    )
  );

-- ============================================================
-- casa_de_paz_membresia: el Lider o Sublider de esa CdP administra su
-- propia lista de miembros (misma gente que ya llena el reporte semanal).
-- ============================================================
DROP POLICY IF EXISTS pol_casa_de_paz_membresia_insert ON casa_de_paz_membresia;
DROP POLICY IF EXISTS pol_casa_de_paz_membresia_update ON casa_de_paz_membresia;

CREATE POLICY pol_casa_de_paz_membresia_insert ON casa_de_paz_membresia
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_cdp(casa_de_paz_id) OR fn_es_sublider_cdp(casa_de_paz_id))
  );

CREATE POLICY pol_casa_de_paz_membresia_update ON casa_de_paz_membresia
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_cdp(casa_de_paz_id) OR fn_es_sublider_cdp(casa_de_paz_id))
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (fn_es_operativo_en(iglesia_id) OR fn_es_lider_cdp(casa_de_paz_id) OR fn_es_sublider_cdp(casa_de_paz_id))
  );

-- ============================================================
-- ministerio: catalogo a nivel Iglesia, solo el operativo lo administra
-- (crear, renombrar, cerrar -- Requisito 5.7).
-- ============================================================
DROP POLICY IF EXISTS pol_ministerio_insert ON ministerio;
DROP POLICY IF EXISTS pol_ministerio_update ON ministerio;

CREATE POLICY pol_ministerio_insert ON ministerio
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

CREATE POLICY pol_ministerio_update ON ministerio
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id))
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id));

-- ============================================================
-- ministerio_persona: el operativo, o el propio Lider vigente de ese
-- Ministerio, administra su equipo.
-- ============================================================
DROP POLICY IF EXISTS pol_ministerio_persona_insert ON ministerio_persona;
DROP POLICY IF EXISTS pol_ministerio_persona_update ON ministerio_persona;

CREATE POLICY pol_ministerio_persona_insert ON ministerio_persona
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR EXISTS (
        SELECT 1 FROM ministerio_persona mp
        WHERE mp.ministerio_id = ministerio_persona.ministerio_id
          AND mp.persona_id = fn_mi_persona_id() AND mp.es_lider
          AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
      )
    )
  );

CREATE POLICY pol_ministerio_persona_update ON ministerio_persona
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR EXISTS (
        SELECT 1 FROM ministerio_persona mp
        WHERE mp.ministerio_id = ministerio_persona.ministerio_id
          AND mp.persona_id = fn_mi_persona_id() AND mp.es_lider
          AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
      )
    )
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR EXISTS (
        SELECT 1 FROM ministerio_persona mp
        WHERE mp.ministerio_id = ministerio_persona.ministerio_id
          AND mp.persona_id = fn_mi_persona_id() AND mp.es_lider
          AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
      )
    )
  );

-- ============================================================
-- Listados para el frontend de Casas de Paz. PostgREST no puede armar estos
-- JOINs (cargo vigente por tabla de historial + fn_etiqueta_cdp) con un
-- select embebido, asi que se resuelven en el servidor.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_listar_redes(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, nombre VARCHAR, activo BOOLEAN,
  lider_nombre TEXT, encargado_departamentos_nombre TEXT, encargado_ministerio_nombre TEXT,
  cantidad_cdp BIGINT, incompleta BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.id, r.nombre, r.activo,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'LIDER_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_MINISTERIO_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT count(*) FROM casa_de_paz_red cdr
     WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL),
    COALESCE(fi.falta_departamentos OR fi.falta_ministerio, false)
  FROM red r
  LEFT JOIN fn_redes_incompletas(p_iglesia_id) fi ON fi.red_id = r.id
  WHERE r.iglesia_id = p_iglesia_id AND r.fecha_eliminacion IS NULL
  ORDER BY r.nombre;
$$;

CREATE OR REPLACE FUNCTION fn_listar_cdp(p_iglesia_id UUID, p_red_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, etiqueta TEXT, activo BOOLEAN, red_id UUID, red_nombre VARCHAR,
  lider_nombre TEXT, anfitrion_nombre TEXT, sublideres_count BIGINT, miembros_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, fn_etiqueta_cdp(c.id), c.activo, cdr.red_id, r.nombre,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'LIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS lider_nombre,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'ANFITRION'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS anfitrion_nombre,
    (SELECT count(*) FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'SUBLIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL) AS sublideres_count,
    (SELECT count(*) FROM casa_de_paz_membresia m
     WHERE m.casa_de_paz_id = c.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL) AS miembros_count
  FROM casa_de_paz c
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE c.iglesia_id = p_iglesia_id AND c.fecha_eliminacion IS NULL
    AND (p_red_id IS NULL OR cdr.red_id = p_red_id)
  ORDER BY r.nombre NULLS LAST, lider_nombre NULLS LAST;
$$;
