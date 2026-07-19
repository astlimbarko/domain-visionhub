-- VisionHub -- 38_renombrar_iglesia.sql
-- Permite a Pastor/Supervisor renombrar su propia iglesia (practica comun).
-- pol_iglesia_update ya lo permitia via fn_es_operativo_en; se agrega el RPC
-- (mismo patron que fn_cambiar_moneda_defecto) para exigir el PIN cuando
-- quien actua es Super Admin, y para validar que no queden vacios.
--
-- iglesia.nombre es GENERATED ALWAYS AS (prefijo || ' ' || sufijo) STORED
-- (01-tenancy-iglesias/design.md, decision del owner 2026-07-17) -- no se
-- puede escribir directo, hay que tocar prefijo/sufijo.

CREATE OR REPLACE FUNCTION fn_renombrar_iglesia(p_iglesia_id UUID, p_prefijo VARCHAR, p_sufijo VARCHAR, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  IF btrim(p_prefijo) = '' OR btrim(p_sufijo) = '' THEN
    RAISE EXCEPTION 'NOMBRE_VACIO: el prefijo y el sufijo de la iglesia no pueden quedar vacios' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET prefijo = btrim(p_prefijo), sufijo = btrim(p_sufijo) WHERE id = p_iglesia_id;
END;
$$;

-- fn_panel_configuracion (06_configuracion.sql) solo exponia 'nombre' (la
-- columna generada); el frontend de renombrado necesita 'prefijo'/'sufijo'
-- por separado para poder editarlos.
CREATE OR REPLACE FUNCTION fn_panel_configuracion(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'iglesia', (SELECT jsonb_build_object('id', id, 'nombre', nombre, 'prefijo', prefijo, 'sufijo', sufijo,
                  'moneda_defecto', (SELECT codigo FROM moneda WHERE id = moneda_defecto_id))
                FROM iglesia WHERE id = p_iglesia_id),
    'categorias', (
      SELECT jsonb_object_agg(categoria, items)
      FROM (
        SELECT cd.categoria,
               jsonb_agg(jsonb_build_object(
                 'codigo', cd.codigo, 'nombre', cd.nombre, 'descripcion', cd.descripcion,
                 'tipo', cd.tipo, 'valor_actual', fn_config_raw(p_iglesia_id, cd.codigo),
                 'valor_defecto', cd.valor_defecto, 'valor_min', cd.valor_min, 'valor_max', cd.valor_max,
                 'unidad', cd.unidad,
                 'es_personalizado', EXISTS (
                   SELECT 1 FROM configuracion_valor cv
                   WHERE cv.iglesia_id = p_iglesia_id AND cv.definicion_id = cd.id AND cv.fecha_eliminacion IS NULL
                 )
               ) ORDER BY cd.orden) AS items
        FROM configuracion_definicion cd
        WHERE cd.activo AND cd.modulo <= 1 AND cd.fecha_eliminacion IS NULL
        GROUP BY cd.categoria
      ) x
    ),
    'departamentos', (
      SELECT jsonb_agg(jsonb_build_object('id', id, 'codigo', codigo, 'nombre', nombre, 'activo', activo))
      FROM departamento WHERE iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL
    ),
    'advertencia', 'Los cambios se aplican desde este momento. No se recalcula lo ya procesado.'
  );
END;
$$;
