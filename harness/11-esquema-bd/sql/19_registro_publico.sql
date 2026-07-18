-- VisionHub -- 19_registro_publico.sql
-- 13-registro-publico-cdp. Ultimo archivo de la cadena: depende de que
-- persona/persona_detalle/persona_llegada/casa_de_paz_membresia/casa_de_paz_cargo
-- ya existan con todas sus restricciones (04, 07, 08, 18). Autocontenido en RLS:
-- 16_rls.sql no cubre esta tabla porque nace despues.

CREATE TABLE casa_paz_url (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  persona_id            UUID NOT NULL REFERENCES persona(id),
  casa_de_paz_id        UUID NOT NULL REFERENCES casa_de_paz(id),
  casa_de_paz_cargo_id  UUID NOT NULL REFERENCES casa_de_paz_cargo(id),
  slug                  VARCHAR(160) NOT NULL,
  estado                estado_url_enum NOT NULL DEFAULT 'INACTIVO',
  fecha_activacion      TIMESTAMPTZ,
  fecha_desactivacion   TIMESTAMPTZ,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_casa_paz_url_slug ON casa_paz_url (slug) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_casa_paz_url_iglesia ON casa_paz_url (iglesia_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_casa_paz_url BEFORE INSERT OR UPDATE ON casa_paz_url FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_casa_paz_url BEFORE DELETE ON casa_paz_url FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Cierra el ciclo: persona_llegada (07_contacto.sql) nace sin esta columna
-- porque casa_paz_url todavia no existia.
ALTER TABLE persona_llegada ADD COLUMN casa_paz_url_id UUID REFERENCES casa_paz_url(id);

-- ============================================================
-- Slug
-- ============================================================

CREATE OR REPLACE FUNCTION fn_slugificar(p_texto TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(
    lower(unaccent(p_texto)), '[^a-z0-9]+', '-', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION fn_generar_slug_unico(p_base TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_slug TEXT := fn_slugificar(p_base);
  v_candidato TEXT := v_slug;
  v_contador INT := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM casa_paz_url WHERE slug = v_candidato AND fecha_eliminacion IS NULL) LOOP
    v_contador := v_contador + 1;
    v_candidato := v_slug || '-' || v_contador;
  END LOOP;
  RETURN v_candidato;
END;
$$;

-- ============================================================
-- Auto-creacion al asignar LIDER_CDP, baja automatica al cerrar el cargo
-- (Requisitos 1 y 3 de 13-registro-publico-cdp)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_gestionar_casa_paz_url()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo VARCHAR;
  v_nombre_completo TEXT;
BEGIN
  SELECT codigo INTO v_codigo FROM cargo WHERE id = COALESCE(NEW.cargo_id, OLD.cargo_id);
  IF v_codigo IS DISTINCT FROM 'LIDER_CDP' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' AND NEW.fecha_fin IS NULL THEN
    SELECT fn_nombre_completo(p) INTO v_nombre_completo FROM persona p WHERE p.id = NEW.persona_id;

    INSERT INTO casa_paz_url (iglesia_id, persona_id, casa_de_paz_id, casa_de_paz_cargo_id, slug)
    VALUES (NEW.iglesia_id, NEW.persona_id, NEW.casa_de_paz_id, NEW.id, fn_generar_slug_unico(v_nombre_completo));

  ELSIF TG_OP = 'UPDATE' AND OLD.fecha_fin IS NULL AND NEW.fecha_fin IS NOT NULL THEN
    UPDATE casa_paz_url
    SET estado = 'INACTIVO', fecha_desactivacion = now()
    WHERE casa_de_paz_cargo_id = NEW.id AND estado <> 'INACTIVO';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_gestionar_casa_paz_url
  AFTER INSERT OR UPDATE ON casa_de_paz_cargo
  FOR EACH ROW EXECUTE FUNCTION fn_gestionar_casa_paz_url();

-- fecha_activacion / fecha_desactivacion cuando el Supervisor cambia el estado a mano
-- (Requisito 2.4 y 2.5). El disparador anterior ya cubre la baja automatica del Requisito 3.
CREATE OR REPLACE FUNCTION fn_marcar_fechas_casa_paz_url()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'ACTIVO' AND OLD.estado <> 'ACTIVO' AND NEW.fecha_activacion IS NULL THEN
    NEW.fecha_activacion := now();
  END IF;
  IF NEW.estado <> 'ACTIVO' AND OLD.estado = 'ACTIVO' THEN
    NEW.fecha_desactivacion := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marcar_fechas_casa_paz_url
  BEFORE UPDATE ON casa_paz_url
  FOR EACH ROW
  WHEN (NEW.estado IS DISTINCT FROM OLD.estado)
  EXECUTE FUNCTION fn_marcar_fechas_casa_paz_url();

-- ============================================================
-- Configuracion: interruptor por iglesia (Requisito 4)
-- ============================================================
-- La fila de configuracion_definicion se siembra en seeds/seed_02_configuracion.sql
-- (codigo REGISTRO_URL_ACTIVO, categoria REGISTRO, valor_defecto 'false').

-- ============================================================
-- Lectura publica (Requisito 5)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_resolver_url_registro(p_slug VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT cpu.estado, fn_config_bool(cpu.iglesia_id, 'REGISTRO_URL_ACTIVO') AS iglesia_activa,
         fn_nombre_completo(p) AS lider_nombre, cdp.nombre AS cdp_nombre
  INTO r
  FROM casa_paz_url cpu
  JOIN persona p ON p.id = cpu.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cpu.casa_de_paz_id
  WHERE cpu.slug = p_slug AND cpu.fecha_eliminacion IS NULL;

  IF NOT FOUND OR r.estado <> 'ACTIVO' OR NOT r.iglesia_activa THEN
    RETURN jsonb_build_object('admite_registro', false);
  END IF;

  RETURN jsonb_build_object(
    'admite_registro', true,
    'lider_nombre', r.lider_nombre,
    'casa_de_paz_nombre', r.cdp_nombre
  );
END;
$$;

-- ============================================================
-- Escritura publica (Requisitos 6 y 7)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_registrar_persona_via_url(p_slug VARCHAR, p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url casa_paz_url;
  v_persona_id UUID;
  v_intentos INT;
BEGIN
  SELECT * INTO v_url FROM casa_paz_url WHERE slug = p_slug AND fecha_eliminacion IS NULL;

  IF NOT FOUND OR v_url.estado <> 'ACTIVO'
     OR NOT fn_config_bool(v_url.iglesia_id, 'REGISTRO_URL_ACTIVO') THEN
    RAISE EXCEPTION 'REGISTRO_URL_NO_DISPONIBLE: el enlace no admite registro en este momento'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_intentos FROM persona_llegada
  WHERE casa_paz_url_id = v_url.id AND fecha_creacion > now() - interval '10 minutes';
  IF v_intentos >= 20 THEN
    RAISE EXCEPTION 'REGISTRO_URL_LIMITE_EXCEDIDO: demasiados registros recientes para este enlace'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_url.iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  IF p_datos ? 'estado_civil' OR p_datos ? 'grado_instruccion' OR p_datos ? 'ocupacion' OR p_datos ? 'nacimiento_ciudad' THEN
    INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
    VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
            (p_datos->>'grado_instruccion')::grado_instruccion_enum,
            p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');
  END IF;

  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                                invitado_por_id, casa_paz_url_id)
  VALUES (v_url.iglesia_id, v_persona_id,
          (SELECT id FROM motivo_llegada WHERE codigo = 'INVITACION_PERSONAL'),
          CURRENT_DATE, v_url.persona_id, v_url.id);

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_url.iglesia_id, v_url.casa_de_paz_id, v_persona_id, true, CURRENT_DATE);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', (SELECT nombre FROM casa_de_paz WHERE id = v_url.casa_de_paz_id)
  );
END;
$$;

-- ============================================================
-- Permisos: la unica puerta de anon (Requisito 7). Cero GRANT de tabla.
-- ============================================================
-- Defensa en profundidad: no hay REVOKE ALT FROM anon global en el resto del
-- esquema (solo REVOKE DELETE, en 02_funciones_base.sql). Si el proyecto real
-- de Supabase quedo con el GRANT ALL a anon/authenticated que trae por
-- defecto todo proyecto nuevo, RLS lo bloquea igual -- pero esta tabla es la
-- unica a la que anon SI necesita llegar de alguna forma (via funcion), asi
-- que aca se revoca explicitamente el acceso directo por si el default
-- ambiental lo hubiera otorgado.
REVOKE ALL ON casa_paz_url FROM anon;
REVOKE ALL ON persona_llegada FROM anon;

GRANT EXECUTE ON FUNCTION fn_resolver_url_registro(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_persona_via_url(VARCHAR, JSONB) TO anon, authenticated;

-- ============================================================
-- RLS de casa_paz_url (autenticado). Sin policy de INSERT/DELETE: la fila
-- nace solo por trg_gestionar_casa_paz_url y nunca se borra fisicamente.
-- ============================================================

ALTER TABLE casa_paz_url ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_casa_paz_url_select ON casa_paz_url
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()));

CREATE POLICY pol_casa_paz_url_update ON casa_paz_url
  FOR UPDATE TO authenticated
  USING (fn_es_operativo_en(iglesia_id))
  WITH CHECK (fn_es_operativo_en(iglesia_id));
