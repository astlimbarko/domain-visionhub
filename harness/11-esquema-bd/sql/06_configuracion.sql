-- VisionHub -- 06_configuracion.sql
-- Motor unico de configuracion (10-panel-supervisor). Va ANTES que 11_estados.sql:
-- los disparadores de estado llaman a fn_criterio, que vive aqui.
-- NOTA: criterio_definicion/criterio_valor de 05-estados-ssva NO se crean:
-- son el mismo motor. fn_criterio es alias de fn_config_num.

CREATE TABLE configuracion_definicion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         VARCHAR(60) NOT NULL UNIQUE,
  nombre         VARCHAR(150) NOT NULL,
  descripcion    TEXT NOT NULL,
  tipo           tipo_configuracion_enum NOT NULL,
  valor_defecto  TEXT NOT NULL,
  valor_min      NUMERIC,
  valor_max      NUMERIC,
  unidad         VARCHAR(20),
  categoria      VARCHAR(40) NOT NULL,
  modulo         SMALLINT NOT NULL DEFAULT 1,
  activo         BOOLEAN NOT NULL DEFAULT true,
  orden          SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_configuracion_definicion BEFORE INSERT OR UPDATE ON configuracion_definicion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_configuracion_definicion BEFORE DELETE ON configuracion_definicion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE configuracion_valor (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  definicion_id UUID NOT NULL REFERENCES configuracion_definicion(id),
  valor         TEXT NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_configuracion_valor
  ON configuracion_valor (iglesia_id, definicion_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_configuracion_valor BEFORE INSERT OR UPDATE ON configuracion_valor FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_configuracion_valor BEFORE DELETE ON configuracion_valor FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_config_raw(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cv.valor FROM configuracion_valor cv
     JOIN configuracion_definicion cd ON cd.id = cv.definicion_id
     WHERE cv.iglesia_id = p_iglesia_id AND cd.codigo = p_codigo
       AND cv.fecha_eliminacion IS NULL),
    (SELECT cd.valor_defecto FROM configuracion_definicion cd WHERE cd.codigo = p_codigo)
  );
$$;

CREATE OR REPLACE FUNCTION fn_config_bool(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(fn_config_raw(p_iglesia_id, p_codigo)::boolean, false);
$$;

CREATE OR REPLACE FUNCTION fn_config_num(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_config_raw(p_iglesia_id, p_codigo)::numeric;
$$;

CREATE OR REPLACE FUNCTION fn_config_txt(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_config_raw(p_iglesia_id, p_codigo);
$$;

CREATE OR REPLACE FUNCTION fn_criterio(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_config_num(p_iglesia_id, p_codigo);
$$;

CREATE OR REPLACE FUNCTION fn_validar_configuracion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d configuracion_definicion;
  v_num NUMERIC;
BEGIN
  SELECT * INTO d FROM configuracion_definicion WHERE id = NEW.definicion_id;

  IF NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CONFIG_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor en la iglesia %', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  CASE d.tipo
    WHEN 'BOOLEANO' THEN
      IF NEW.valor NOT IN ('true', 'false') THEN
        RAISE EXCEPTION 'CONFIG_TIPO_INVALIDO: % es booleano; recibido "%"', d.codigo, NEW.valor
          USING ERRCODE = 'P0001';
      END IF;

    WHEN 'NUMERICO' THEN
      BEGIN
        v_num := NEW.valor::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'CONFIG_TIPO_INVALIDO: % es numerico; recibido "%"', d.codigo, NEW.valor
          USING ERRCODE = 'P0001';
      END;

      IF d.valor_min IS NOT NULL AND v_num < d.valor_min THEN
        RAISE EXCEPTION 'CONFIG_FUERA_DE_RANGO: % debe ser >= % (recibido %)', d.codigo, d.valor_min, v_num
          USING ERRCODE = 'P0001';
      END IF;
      IF d.valor_max IS NOT NULL AND v_num > d.valor_max THEN
        RAISE EXCEPTION 'CONFIG_FUERA_DE_RANGO: % debe ser <= % (recibido %)', d.codigo, d.valor_max, v_num
          USING ERRCODE = 'P0001';
      END IF;

    WHEN 'TEXTO' THEN
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_configuracion
  BEFORE INSERT OR UPDATE ON configuracion_valor
  FOR EACH ROW EXECUTE FUNCTION fn_validar_configuracion();

-- RPC de escritura: hace falta para que el error salga con codigo de regla
-- (ver 12-pruebas-curl/design.md, escenario 10_configuracion.sh).
CREATE OR REPLACE FUNCTION fn_set_configuracion(p_iglesia_id UUID, p_codigo VARCHAR, p_valor TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_def_id UUID;
  v_existente UUID;
BEGIN
  SELECT id INTO v_def_id FROM configuracion_definicion WHERE codigo = p_codigo;
  IF v_def_id IS NULL THEN
    RAISE EXCEPTION 'CONFIG_CODIGO_INEXISTENTE: no existe la configuracion %', p_codigo USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existente FROM configuracion_valor
  WHERE iglesia_id = p_iglesia_id AND definicion_id = v_def_id AND fecha_eliminacion IS NULL;

  IF v_existente IS NOT NULL THEN
    UPDATE configuracion_valor SET valor = p_valor WHERE id = v_existente;
  ELSE
    INSERT INTO configuracion_valor (iglesia_id, definicion_id, valor) VALUES (p_iglesia_id, v_def_id, p_valor);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_config_formulario(p_iglesia_id UUID, p_formulario VARCHAR)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_object_agg(cd.codigo, fn_config_bool(p_iglesia_id, cd.codigo))
  FROM configuracion_definicion cd
  WHERE cd.categoria = p_formulario AND cd.activo AND cd.modulo <= 1 AND cd.fecha_eliminacion IS NULL;
$$;

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
    'iglesia', (SELECT jsonb_build_object('id', id, 'nombre', nombre,
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
-- NOTA: fn_panel_configuracion referencia "departamento" (08_estructura.sql).
-- Ejecutar solo despues de 08 (igual que fn_sugerir_apellido_casada con familia).
-- Todas las politicas RLS (incluida la de catalogos como finanzas_tipo_ingreso)
-- viven en 16_rls.sql, al final, una vez que todas las tablas existen.
