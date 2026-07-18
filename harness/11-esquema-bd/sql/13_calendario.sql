-- VisionHub -- 13_calendario.sql
-- Calendario y eventos. Cierra el ciclo 3 (casa_de_paz_reporte.evento_megafiesta_id).

CREATE TABLE tipo_evento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID REFERENCES iglesia(id),
  codigo      VARCHAR(30) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(200),
  color       CHAR(7) NOT NULL DEFAULT '#6B7280',
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_tipo_evento_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX uq_tipo_evento_codigo
  ON tipo_evento (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo)
  WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_tipo_evento BEFORE INSERT OR UPDATE ON tipo_evento FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_tipo_evento BEFORE DELETE ON tipo_evento FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE TABLE evento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID REFERENCES casa_de_paz(id),
  red_id          UUID REFERENCES red(id),
  tipo_evento_id  UUID NOT NULL REFERENCES tipo_evento(id),
  titulo          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  hora_inicio     TIME,
  hora_fin        TIME,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_evento_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
  CONSTRAINT chk_evento_horas CHECK (
    hora_fin IS NULL OR hora_inicio IS NULL OR fecha_fin IS DISTINCT FROM fecha_inicio OR hora_fin >= hora_inicio
  ),
  CONSTRAINT chk_evento_ambito CHECK ((casa_de_paz_id IS NOT NULL)::int + (red_id IS NOT NULL)::int = 1)
);

CREATE INDEX idx_evento_cdp_fecha ON evento (casa_de_paz_id, fecha_inicio) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_evento_red_fecha ON evento (red_id, fecha_inicio) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_evento BEFORE INSERT OR UPDATE ON evento FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_evento BEFORE DELETE ON evento FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_eventos_cdp(
  p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE, p_tipo_evento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, titulo VARCHAR, descripcion TEXT, tipo_codigo VARCHAR, tipo_nombre VARCHAR,
  color CHAR(7), icono VARCHAR, fecha_inicio DATE, fecha_fin DATE, hora_inicio TIME, hora_fin TIME,
  es_multi_dia BOOLEAN, ambito VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT cdp.iglesia_id INTO v_iglesia_id FROM casa_de_paz cdp WHERE cdp.id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo, e.descripcion, t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         CASE WHEN e.red_id IS NOT NULL THEN 'RED' ELSE 'CDP' END::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND (
      e.casa_de_paz_id = p_casa_de_paz_id
      OR e.red_id = (
        SELECT cdr.red_id FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = p_casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
      )
    )
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION fn_cumpleanos_cdp(p_casa_de_paz_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (persona_id UUID, nombre TEXT, fecha_cumpleanos DATE, edad_cumple INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT cdp.iglesia_id INTO v_iglesia_id FROM casa_de_paz cdp WHERE cdp.id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH anios AS (
    SELECT generate_series(EXTRACT(YEAR FROM p_desde)::int, EXTRACT(YEAR FROM p_hasta)::int) AS anio
  ),
  miembros AS (
    SELECT p.id, p.fecha_nacimiento, fn_nombre_completo(p) AS nombre
    FROM casa_de_paz_membresia m
    JOIN persona p ON p.id = m.persona_id
    WHERE m.casa_de_paz_id = p_casa_de_paz_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
      AND p.fecha_nacimiento IS NOT NULL AND p.fecha_eliminacion IS NULL
  ),
  cumples AS (
    SELECT mi.id, mi.nombre, mi.fecha_nacimiento,
      make_date(a.anio, EXTRACT(MONTH FROM mi.fecha_nacimiento)::int,
        CASE WHEN EXTRACT(MONTH FROM mi.fecha_nacimiento) = 2 AND EXTRACT(DAY FROM mi.fecha_nacimiento) = 29
               AND NOT (a.anio % 4 = 0 AND (a.anio % 100 <> 0 OR a.anio % 400 = 0))
             THEN 28 ELSE EXTRACT(DAY FROM mi.fecha_nacimiento)::int END
      ) AS fecha_cumple,
      a.anio
    FROM miembros mi CROSS JOIN anios a
  )
  SELECT cumples.id, cumples.nombre, cumples.fecha_cumple, (cumples.anio - EXTRACT(YEAR FROM cumples.fecha_nacimiento)::int)
  FROM cumples WHERE cumples.fecha_cumple BETWEEN p_desde AND p_hasta
  ORDER BY cumples.fecha_cumple;
END;
$$;

CREATE OR REPLACE FUNCTION fn_puede_crear_evento(p_casa_de_paz_id UUID, p_tipo_evento_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_codigo VARCHAR;
BEGIN
  SELECT codigo INTO v_codigo FROM tipo_evento WHERE id = p_tipo_evento_id;
  IF v_codigo = 'MEGA_FIESTA' THEN
    RETURN fn_es_rol_superior_de_cdp(p_casa_de_paz_id);
  END IF;
  RETURN fn_puede_reportar_cdp(p_casa_de_paz_id);
END;
$$;
-- NOTA: fn_puede_reportar_cdp se crea en 15_permisos.sql; postgres no valida
-- llamadas a funciones no creadas todavia en el cuerpo de otra funcion.

CREATE OR REPLACE FUNCTION fn_proximos_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (clase VARCHAR, titulo TEXT, fecha DATE, dias_faltantes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ventana AS (
    SELECT CURRENT_DATE AS desde,
           (CURRENT_DATE + (fn_criterio((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id), 'DIAS_AVISO_EVENTO') || ' days')::interval)::date AS hasta
  )
  SELECT 'EVENTO'::VARCHAR, e.titulo::TEXT, e.fecha_inicio AS fecha, (e.fecha_inicio - CURRENT_DATE)::int
  FROM fn_eventos_cdp(p_casa_de_paz_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) e
  UNION ALL
  SELECT 'CUMPLEANOS'::VARCHAR, (c.nombre || ' cumple ' || c.edad_cumple || ' anios')::TEXT, c.fecha_cumpleanos AS fecha, (c.fecha_cumpleanos - CURRENT_DATE)::int
  FROM fn_cumpleanos_cdp(p_casa_de_paz_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) c
  ORDER BY fecha;
$$;

-- Cierra el ciclo 3: casa_de_paz_reporte -> evento (megafiesta, 04-reporte-cdp)
ALTER TABLE casa_de_paz_reporte ADD COLUMN evento_megafiesta_id UUID REFERENCES evento(id);

CREATE OR REPLACE FUNCTION fn_validar_reporte_megafiesta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evento    evento;
  v_tipo_cod  VARCHAR;
  v_red_cdp   UUID;
BEGIN
  IF NEW.evento_megafiesta_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_evento FROM evento WHERE id = NEW.evento_megafiesta_id;
  SELECT codigo INTO v_tipo_cod FROM tipo_evento WHERE id = v_evento.tipo_evento_id;

  IF v_tipo_cod IS DISTINCT FROM 'MEGA_FIESTA' THEN
    RAISE EXCEPTION 'REPORTE_EVENTO_NO_ES_MEGAFIESTA: el evento % no es una Mega Fiesta', NEW.evento_megafiesta_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.fecha_reunion IS DISTINCT FROM v_evento.fecha_inicio THEN
    RAISE EXCEPTION 'REPORTE_MEGAFIESTA_FECHA_DISTINTA: el reporte es del % y la Mega Fiesta es del %',
      NEW.fecha_reunion, v_evento.fecha_inicio USING ERRCODE = 'P0001';
  END IF;

  SELECT cdr.red_id INTO v_red_cdp FROM casa_de_paz_red cdr
  WHERE cdr.casa_de_paz_id = NEW.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL;

  IF v_red_cdp IS DISTINCT FROM v_evento.red_id THEN
    RAISE EXCEPTION 'REPORTE_MEGAFIESTA_RED_DISTINTA: la Mega Fiesta % no es de la red de esta casa de paz', NEW.evento_megafiesta_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_reporte_megafiesta
  BEFORE INSERT OR UPDATE ON casa_de_paz_reporte
  FOR EACH ROW EXECUTE FUNCTION fn_validar_reporte_megafiesta();
