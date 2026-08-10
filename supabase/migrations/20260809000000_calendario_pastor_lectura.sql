-- VisionHub -- calendario_pastor_lectura
-- KAN-40: el Pastor debe poder VER el calendario consolidado de su iglesia +
-- sedes hijas/satelite (mismo componente que ya usa el Supervisor,
-- CalendarioMultiIglesia), pero solo lectura -- nunca crear/editar/eliminar
-- eventos (spec de roles, Rol 5: Pastor solo supervisa y consulta;
-- 43_pastor_no_operativo.sql). Por eso NO se toca fn_es_operativo_en ni las
-- politicas de INSERT/UPDATE de evento (siguen exigiendo ser operativo, es
-- decir Supervisor) -- solo se extiende el lado de LECTURA.

CREATE OR REPLACE FUNCTION fn_es_pastor_en_o_padre_de(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_pastor_en(p_iglesia_id) OR EXISTS (
    SELECT 1 FROM iglesia i
    WHERE i.id = p_iglesia_id AND i.iglesia_padre_id IS NOT NULL
      AND fn_es_pastor_en(i.iglesia_padre_id)
  );
$$;

GRANT EXECUTE ON FUNCTION fn_es_pastor_en_o_padre_de(UUID) TO authenticated;

-- fn_eventos_iglesia (y por lo tanto fn_proximos_iglesia, que lo llama
-- internamente) ahora tambien pasa si sos Pastor de esa iglesia o de su
-- iglesia madre.
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
  IF NOT (fn_es_operativo_en_o_padre_de(p_iglesia_id) OR fn_es_pastor_en_o_padre_de(p_iglesia_id)) THEN
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

-- Listado de sedes (iglesias hijas/satelite directas): el Pastor de la
-- iglesia madre tambien puede listarlas para el filtro de sedes del
-- calendario consolidado.
CREATE OR REPLACE FUNCTION fn_mis_iglesias_hijas(p_iglesia_id UUID)
RETURNS TABLE (id UUID, nombre VARCHAR, tipo iglesia_tipo_enum)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
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

-- pol_evento_select: el Pastor tambien puede LEER eventos de su iglesia
-- hija/satelite (ya podia leer los de su propia iglesia via fn_mis_iglesias()).
-- pol_evento_insert/pol_evento_update quedan intactas -- el Pastor sigue sin
-- poder crear ni editar eventos (no es operativo).
DROP POLICY pol_evento_select ON evento;
CREATE POLICY pol_evento_select ON evento
  FOR SELECT TO authenticated
  USING (
    fecha_eliminacion IS NULL
    AND (
      iglesia_id IN (SELECT fn_mis_iglesias())
      OR fn_es_operativo_en_o_padre_de(iglesia_id)
      OR fn_es_pastor_en_o_padre_de(iglesia_id)
    )
  );
