-- VisionHub -- 101_calendario_padre_satelite.sql
-- Panel del Supervisor (2026-08-04), continuacion de 100_calendario_ambito_iglesia.sql:
-- el Pastor/Supervisor de una iglesia PADRE tambien puede crear y ver el
-- calendario de sus iglesias HIJA/SATELITE directas -- ej. Centro de Vida 4to
-- Anillo (padre) crea eventos para Centro de Vida Montero (hija/satelite), y
-- esos eventos se ven en el calendario de todos los roles DENTRO de Montero
-- (cascada ya resuelta por fn_eventos_cdp/fn_eventos_red).
--
-- Ambito deliberadamente acotado: SOLO calendario, un nivel (padre -> hija
-- directa, sin recursividad), y en una funcion nueva propia -- no se toca
-- fn_mis_iglesias() ni ninguna otra RLS. Ampliar fn_mis_iglesias() le daria
-- al padre acceso a TODO lo demas de la hija (personas, reportes, finanzas,
-- estructura...), que nadie pidio; 61_iglesia_tipo.sql ya documentaba que
-- HIJA/SATELITE es "solo conceptual... sin inventar logica distinta sin que
-- el owner lo pida explicitamente" -- este es ese pedido explicito, acotado
-- a lo que se pidio.

CREATE OR REPLACE FUNCTION fn_es_operativo_en_o_padre_de(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_operativo_en(p_iglesia_id) OR EXISTS (
    SELECT 1 FROM iglesia i
    WHERE i.id = p_iglesia_id AND i.iglesia_padre_id IS NOT NULL
      AND fn_es_operativo_en(i.iglesia_padre_id)
  );
$$;

GRANT EXECUTE ON FUNCTION fn_es_operativo_en_o_padre_de(UUID) TO authenticated;

-- fn_eventos_iglesia / fn_proximos_iglesia pasan a aceptar tambien al
-- Pastor/Supervisor de la iglesia padre (mismo shape, solo cambia el gate).
CREATE OR REPLACE FUNCTION fn_eventos_iglesia(
  p_iglesia_id UUID, p_desde DATE, p_hasta DATE, p_tipo_evento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, titulo VARCHAR, descripcion TEXT, tipo_codigo VARCHAR, tipo_nombre VARCHAR,
  color CHAR(7), icono VARCHAR, fecha_inicio DATE, fecha_fin DATE, hora_inicio TIME, hora_fin TIME,
  es_multi_dia BOOLEAN, ambito VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: sin acceso a la iglesia %', p_iglesia_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_es_operativo_en_o_padre_de(p_iglesia_id) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor de la iglesia % (o de su iglesia madre)', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         'IGLESIA'::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND e.iglesia_id = p_iglesia_id AND e.casa_de_paz_id IS NULL AND e.red_id IS NULL
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION fn_proximos_iglesia(p_iglesia_id UUID)
RETURNS TABLE (clase VARCHAR, titulo TEXT, fecha DATE, dias_faltantes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ventana AS (
    SELECT CURRENT_DATE AS desde,
           (CURRENT_DATE + (fn_criterio(p_iglesia_id, 'DIAS_AVISO_EVENTO') || ' days')::interval)::date AS hasta
  )
  SELECT 'EVENTO'::VARCHAR, e.titulo::TEXT, e.fecha_inicio AS fecha, (e.fecha_inicio - CURRENT_DATE)::int
  FROM fn_eventos_iglesia(p_iglesia_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) e
  ORDER BY fecha;
$$;

-- RLS de evento: el caso IGLESIA pasa a usar fn_es_operativo_en_o_padre_de.
-- El caso CDP/RED no cambia (siguen exigiendo cargo/operativo DENTRO de esa
-- misma iglesia -- el padre no gana permisos de Red/CdP puntuales, solo el
-- calendario propio de la iglesia hija en su conjunto).
DROP POLICY pol_evento_insert ON evento;
CREATE POLICY pol_evento_insert ON evento
  FOR INSERT TO authenticated
  WITH CHECK (
    (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_operativo_en_o_padre_de(iglesia_id))
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
      OR (casa_de_paz_id IS NULL AND red_id IS NULL AND fn_es_operativo_en_o_padre_de(iglesia_id))
    )
  );

DROP POLICY pol_evento_update ON evento;
CREATE POLICY pol_evento_update ON evento
  FOR UPDATE TO authenticated
  USING (
    (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_operativo_en_o_padre_de(iglesia_id))
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
      OR (casa_de_paz_id IS NULL AND red_id IS NULL AND fn_es_operativo_en_o_padre_de(iglesia_id))
    )
  );

-- El SELECT de evento (pol_evento_select, 16_rls.sql) exige
-- `iglesia_id IN (SELECT fn_mis_iglesias())`, que NO camina iglesia_padre_id
-- -- el padre no "es miembro" de la iglesia hija, asi que sin este agregado
-- no podria ni ver los eventos que el mismo crea ahi. Se agrega la misma
-- salvedad puntual, sin tocar el resto de esa politica.
DROP POLICY pol_evento_select ON evento;
CREATE POLICY pol_evento_select ON evento
  FOR SELECT TO authenticated
  USING (
    fecha_eliminacion IS NULL
    AND (iglesia_id IN (SELECT fn_mis_iglesias()) OR fn_es_operativo_en_o_padre_de(iglesia_id))
  );

-- Listado de iglesias hijas/satelite directas de una iglesia -- para el
-- selector "Iglesia: [la mia / mi hija]" del Supervisor en CalendarioIglesia.
CREATE FUNCTION fn_mis_iglesias_hijas(p_iglesia_id UUID)
RETURNS TABLE (id UUID, nombre VARCHAR, tipo iglesia_tipo_enum)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT i.id, i.nombre, i.tipo
  FROM iglesia i
  WHERE i.iglesia_padre_id = p_iglesia_id AND i.activo AND i.fecha_eliminacion IS NULL
  ORDER BY i.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_mis_iglesias_hijas(UUID) TO authenticated;
