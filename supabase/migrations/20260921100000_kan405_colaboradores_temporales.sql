-- VisionHub -- KAN-405: Colaboradores temporales por código (Afirmación)
--
-- Modelo (decisión documentada en el comentario de KAN-405, 2026-09-21):
-- tabla SEPARADA de usuario_rol, no una fila mas ahi. usuario_rol exige un
-- solo rol vigente por usuario+iglesia (uq_usuario_rol_vigente) -- el caso
-- normal es que un Colaborador YA tenga un rol real en esa iglesia (Lider de
-- CdP, etc.), asi que agregar ahi rompería esa invariante para el caso
-- comun, no la excepcion. En cambio, "Colaborador" es una CAPACIDAD
-- ORTOGONAL temporal, mismo patron que fn_es_lider_afirmacion_en
-- (48_funciones_afirmacion.sql) pero con vigencia por tiempo en vez de
-- "hasta que se dé de baja".
--
-- Corte automatico al vencer: SIN cron/job en segundo plano. Cada chequeo de
-- permiso exige estado='ACTIVO' AND fecha_fin > now() -- vencer es
-- instantaneo porque el chequeo es siempre en vivo, no un estado que haya
-- que ir a "apagar" desde afuera.
--
-- Auditoria "que cargo cada Colaborador": no se agrega columna nueva a
-- persona -- se reusa creado_por/fecha_creacion que ya pone el trigger
-- fn_auditoria() en cada INSERT, filtrando por usuario_id + la ventana de
-- tiempo de esa sesion de colaboracion.
--
-- Generico por departamento_codigo (VARCHAR, mismo patron sin FK que usa
-- fn_es_lider_departamento) para que otras areas lo puedan usar a futuro --
-- este ticket solo construye el caso AFIRMACION.

CREATE TYPE colaborador_estado_enum AS ENUM ('ACTIVO', 'PAUSADO', 'FINALIZADO');

-- ============================================================
-- Tabla 1: el codigo en si. Reutilizable por varias personas a la vez
-- (no de un solo uso) -- cada canje crea su propia colaborador_sesion.
-- ============================================================
CREATE TABLE colaborador_codigo (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  departamento_codigo   VARCHAR NOT NULL DEFAULT 'AFIRMACION',
  codigo                VARCHAR(8) NOT NULL,
  duracion_minutos      INT NOT NULL CHECK (duracion_minutos > 0),
  -- Revocacion manual del codigo completo (pedido explicito del ticket,
  -- distinto de finalizar una sesion individual): si es false, nadie mas
  -- puede canjearlo -- no afecta las sesiones ya activas de quienes ya lo
  -- habian canjeado antes de la revocacion.
  activo                BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por            UUID NOT NULL REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX uq_colaborador_codigo ON colaborador_codigo (codigo);

-- ============================================================
-- Tabla 2: una fila por persona que canjeo el codigo. El vencimiento y las
-- 3 acciones del lider (extender/pausar/finalizar) viven aca.
-- ============================================================
CREATE TABLE colaborador_sesion (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_codigo_id UUID NOT NULL REFERENCES colaborador_codigo(id),
  usuario_id            UUID NOT NULL REFERENCES auth.users(id),
  persona_id            UUID REFERENCES persona(id),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  departamento_codigo   VARCHAR NOT NULL,
  fecha_inicio          TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_fin             TIMESTAMPTZ NOT NULL,
  estado                colaborador_estado_enum NOT NULL DEFAULT 'ACTIVO',
  fecha_finalizado      TIMESTAMPTZ,
  finalizado_por        UUID REFERENCES auth.users(id),
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion   TIMESTAMPTZ,
  creado_por            UUID REFERENCES auth.users(id),
  actualizado_por       UUID REFERENCES auth.users(id)
);

-- Un usuario no puede tener 2 sesiones vigentes a la vez para la misma
-- iglesia+departamento -- si vuelve a canjear el codigo, se refresca la
-- existente (ver fn_redimir_codigo_colaborador) en vez de duplicar.
CREATE UNIQUE INDEX uq_colaborador_sesion_vigente
  ON colaborador_sesion (usuario_id, iglesia_id, departamento_codigo)
  WHERE estado IN ('ACTIVO', 'PAUSADO');

CREATE INDEX ix_colaborador_sesion_codigo ON colaborador_sesion (colaborador_codigo_id);
CREATE INDEX ix_colaborador_sesion_iglesia ON colaborador_sesion (iglesia_id, departamento_codigo);

CREATE TRIGGER trg_auditoria_colaborador_sesion BEFORE INSERT OR UPDATE ON colaborador_sesion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_colaborador_sesion BEFORE DELETE ON colaborador_sesion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- RLS: sin policies para authenticated -- todo el acceso pasa por las
-- funciones SECURITY DEFINER de abajo (mismo patron que otras tablas de
-- Afirmacion, ej. casa_paz_url). Bloquea lectura/escritura directa via
-- PostgREST.
ALTER TABLE colaborador_codigo ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_sesion ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Permiso ortogonal: mismo patron que fn_es_lider_afirmacion_en, pero con
-- vigencia por tiempo. Incluye el caso madre/satelite como una sola unidad
-- (mismo helper que KAN-251, fn_son_madre_satelite_vigente).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_es_colaborador_activo_en(p_iglesia_id UUID, p_departamento_codigo VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM colaborador_sesion cs
    WHERE cs.usuario_id = auth.uid()
      AND cs.departamento_codigo = p_departamento_codigo
      AND cs.estado = 'ACTIVO'
      AND cs.fecha_fin > now()
      AND (cs.iglesia_id = p_iglesia_id OR fn_son_madre_satelite_vigente(cs.iglesia_id, p_iglesia_id))
  );
$$;

-- Permiso del lider/operativo para administrar colaboradores de su area.
-- Mismo criterio que fn_generar_codigo usa abajo: Lider de Departamento,
-- Pastor o Supervisor de esa iglesia (el ticket dice "la Lider de Afirmacion
-- (o Pastor/Supervisor)").
CREATE OR REPLACE FUNCTION fn_puede_gestionar_colaboradores_en(p_iglesia_id UUID, p_departamento_codigo VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_lider_departamento(p_iglesia_id, p_departamento_codigo) OR fn_es_operativo_en(p_iglesia_id);
$$;

-- ============================================================
-- Generar codigo. Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para que se
-- pueda repartir de palabra el dia del evento sin confusion.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generar_codigo_colaborador(p_iglesia_id UUID, p_departamento_codigo VARCHAR, p_duracion_minutos INT)
RETURNS colaborador_codigo
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_alfabeto TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo   VARCHAR;
  v_intento  INT := 0;
  v_fila     colaborador_codigo;
BEGIN
  IF NOT fn_puede_gestionar_colaboradores_en(p_iglesia_id, p_departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO: no tiene permiso para generar codigos en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_duracion_minutos IS NULL OR p_duracion_minutos <= 0 THEN
    RAISE EXCEPTION 'COLABORADOR_DURACION_INVALIDA: la duracion debe ser mayor a 0'
      USING ERRCODE = 'P0001';
  END IF;

  LOOP
    v_codigo := '';
    FOR i IN 1..6 LOOP
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO colaborador_codigo (iglesia_id, departamento_codigo, codigo, duracion_minutos, creado_por)
      VALUES (p_iglesia_id, p_departamento_codigo, v_codigo, p_duracion_minutos, auth.uid())
      RETURNING * INTO v_fila;
      RETURN v_fila;
    EXCEPTION WHEN unique_violation THEN
      v_intento := v_intento + 1;
      IF v_intento > 10 THEN
        RAISE EXCEPTION 'COLABORADOR_NO_SE_PUDO_GENERAR: reintentar';
      END IF;
    END;
  END LOOP;
END;
$$;

-- Revocar el codigo completo (no una sesion individual) -- nadie mas puede
-- canjearlo despues. No afecta a quienes ya lo habian canjeado.
CREATE OR REPLACE FUNCTION fn_revocar_codigo_colaborador(p_codigo_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cod colaborador_codigo;
BEGIN
  SELECT * INTO v_cod FROM colaborador_codigo WHERE id = p_codigo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_CODIGO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_colaboradores_en(v_cod.iglesia_id, v_cod.departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;
  UPDATE colaborador_codigo SET activo = false WHERE id = p_codigo_id;
END;
$$;

-- ============================================================
-- Canjear codigo: cualquier usuario autenticado, cualquier rol. Idempotente
-- -- si ya tiene sesion vigente (ACTIVO/PAUSADO) para esa iglesia+depto, la
-- refresca en vez de duplicar (respeta uq_colaborador_sesion_vigente).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_redimir_codigo_colaborador(p_codigo VARCHAR)
RETURNS colaborador_sesion
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cod    colaborador_codigo;
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_cod FROM colaborador_codigo
  WHERE codigo = upper(trim(p_codigo)) AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_CODIGO_INVALIDO: el codigo no existe o fue revocado'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_sesion FROM colaborador_sesion
  WHERE usuario_id = auth.uid()
    AND iglesia_id = v_cod.iglesia_id
    AND departamento_codigo = v_cod.departamento_codigo
    AND estado IN ('ACTIVO', 'PAUSADO');

  IF FOUND THEN
    UPDATE colaborador_sesion
    SET estado = 'ACTIVO', fecha_fin = now() + (v_cod.duracion_minutos || ' minutes')::interval
    WHERE id = v_sesion.id
    RETURNING * INTO v_sesion;
    RETURN v_sesion;
  END IF;

  INSERT INTO colaborador_sesion (colaborador_codigo_id, usuario_id, persona_id, iglesia_id, departamento_codigo, fecha_fin)
  VALUES (v_cod.id, auth.uid(), fn_mi_persona_id(), v_cod.iglesia_id, v_cod.departamento_codigo,
          now() + (v_cod.duracion_minutos || ' minutes')::interval)
  RETURNING * INTO v_sesion;

  RETURN v_sesion;
END;
$$;

-- Mi colaboracion activa (si tengo alguna) -- para que el frontend sepa si
-- ya soy Colaborador y muestre el contador/banner en vez del campo de
-- codigo. Vencida (fecha_fin <= now()) no cuenta como activa aunque el
-- estado en la fila todavia diga ACTIVO.
CREATE OR REPLACE FUNCTION fn_mi_colaboracion_activa()
RETURNS TABLE (
  id UUID, iglesia_id UUID, iglesia_nombre VARCHAR, departamento_codigo VARCHAR,
  fecha_inicio TIMESTAMPTZ, fecha_fin TIMESTAMPTZ, estado colaborador_estado_enum
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cs.id, cs.iglesia_id, i.nombre, cs.departamento_codigo, cs.fecha_inicio, cs.fecha_fin, cs.estado
  FROM colaborador_sesion cs
  JOIN iglesia i ON i.id = cs.iglesia_id
  WHERE cs.usuario_id = auth.uid()
    AND cs.estado IN ('ACTIVO', 'PAUSADO')
    AND cs.fecha_fin > now()
  ORDER BY cs.fecha_inicio DESC
  LIMIT 1;
$$;

-- Historial propio del Colaborador: a quien registro durante su sesion
-- activa actual (pedido explicito del ticket, "para saber su propio
-- aporte"). Si no tiene sesion vigente, devuelve vacio.
CREATE OR REPLACE FUNCTION fn_mi_historial_colaborador()
RETURNS TABLE (persona_id UUID, nombre_completo TEXT, fecha_creacion TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_sesion FROM colaborador_sesion
  WHERE usuario_id = auth.uid() AND estado IN ('ACTIVO', 'PAUSADO') AND fecha_fin > now()
  ORDER BY fecha_inicio DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.fecha_creacion
  FROM persona p
  WHERE p.creado_por = auth.uid()
    AND p.iglesia_id = v_sesion.iglesia_id
    AND p.fecha_creacion >= v_sesion.fecha_inicio
  ORDER BY p.fecha_creacion DESC;
END;
$$;

-- ============================================================
-- Panel del lider: listar colaboradores (activos + historial, el frontend
-- separa por estado_calculado) y auditoria por colaborador.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_listar_colaboradores(p_iglesia_id UUID, p_departamento_codigo VARCHAR)
RETURNS TABLE (
  id UUID, persona_nombre TEXT, usuario_id UUID, fecha_inicio TIMESTAMPTZ, fecha_fin TIMESTAMPTZ,
  estado colaborador_estado_enum, estado_calculado TEXT, codigo VARCHAR, personas_cargadas BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_puede_gestionar_colaboradores_en(p_iglesia_id, p_departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO: no tiene acceso a gestionar colaboradores en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    COALESCE(fn_nombre_completo(p), '(sin persona)'),
    cs.usuario_id,
    cs.fecha_inicio,
    cs.fecha_fin,
    cs.estado,
    CASE
      WHEN cs.estado = 'FINALIZADO' THEN 'FINALIZADO'
      WHEN cs.estado = 'PAUSADO' THEN 'PAUSADO'
      WHEN cs.fecha_fin <= now() THEN 'VENCIDO'
      ELSE 'ACTIVO'
    END,
    cc.codigo,
    (SELECT count(*) FROM persona per
     WHERE per.creado_por = cs.usuario_id AND per.iglesia_id = cs.iglesia_id
       AND per.fecha_creacion >= cs.fecha_inicio
       AND per.fecha_creacion <= COALESCE(cs.fecha_finalizado, cs.fecha_fin))
  FROM colaborador_sesion cs
  JOIN colaborador_codigo cc ON cc.id = cs.colaborador_codigo_id
  LEFT JOIN persona p ON p.id = cs.persona_id
  WHERE cs.iglesia_id = p_iglesia_id AND cs.departamento_codigo = p_departamento_codigo
  ORDER BY cs.fecha_inicio DESC;
END;
$$;

CREATE OR REPLACE FUNCTION fn_colaborador_auditoria(p_sesion_id UUID)
RETURNS TABLE (persona_id UUID, nombre_completo TEXT, fecha_creacion TIMESTAMPTZ, accion TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_sesion FROM colaborador_sesion WHERE id = p_sesion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_SESION_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_colaboradores_en(v_sesion.iglesia_id, v_sesion.departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.fecha_creacion,
    CASE WHEN p.creado_por = v_sesion.usuario_id THEN 'ALTA' ELSE 'MODIFICACION' END
  FROM persona p
  WHERE p.iglesia_id = v_sesion.iglesia_id
    AND (p.creado_por = v_sesion.usuario_id OR p.actualizado_por = v_sesion.usuario_id)
    AND p.fecha_creacion >= v_sesion.fecha_inicio
  ORDER BY p.fecha_creacion DESC;
END;
$$;

-- ============================================================
-- Las 3 acciones del lider sobre un Colaborador activo, + reanudar (mismo
-- boton que pausar, cambia de rotulo segun el estado -- el ticket pide 3
-- acciones fijas, "pausar" y "reanudar" son la misma accion en 2 estados).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_extender_colaborador_sesion(p_sesion_id UUID, p_minutos_adicionales INT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_sesion FROM colaborador_sesion WHERE id = p_sesion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_SESION_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_colaboradores_en(v_sesion.iglesia_id, v_sesion.departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;
  IF v_sesion.estado = 'FINALIZADO' THEN
    RAISE EXCEPTION 'COLABORADOR_YA_FINALIZADO: no se puede extender una sesion finalizada' USING ERRCODE = 'P0001';
  END IF;
  IF p_minutos_adicionales IS NULL OR p_minutos_adicionales <= 0 THEN
    RAISE EXCEPTION 'COLABORADOR_DURACION_INVALIDA' USING ERRCODE = 'P0001';
  END IF;

  UPDATE colaborador_sesion
  SET fecha_fin = GREATEST(fecha_fin, now()) + (p_minutos_adicionales || ' minutes')::interval
  WHERE id = p_sesion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_pausar_colaborador_sesion(p_sesion_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_sesion FROM colaborador_sesion WHERE id = p_sesion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_SESION_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_colaboradores_en(v_sesion.iglesia_id, v_sesion.departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;
  IF v_sesion.estado <> 'ACTIVO' THEN
    RAISE EXCEPTION 'COLABORADOR_ESTADO_INVALIDO: solo se puede pausar una sesion activa' USING ERRCODE = 'P0001';
  END IF;

  UPDATE colaborador_sesion SET estado = 'PAUSADO' WHERE id = p_sesion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_reanudar_colaborador_sesion(p_sesion_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_sesion FROM colaborador_sesion WHERE id = p_sesion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_SESION_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_colaboradores_en(v_sesion.iglesia_id, v_sesion.departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;
  IF v_sesion.estado <> 'PAUSADO' THEN
    RAISE EXCEPTION 'COLABORADOR_ESTADO_INVALIDO: solo se puede reanudar una sesion pausada' USING ERRCODE = 'P0001';
  END IF;

  UPDATE colaborador_sesion SET estado = 'ACTIVO' WHERE id = p_sesion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_finalizar_colaborador_sesion(p_sesion_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion colaborador_sesion;
BEGIN
  SELECT * INTO v_sesion FROM colaborador_sesion WHERE id = p_sesion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COLABORADOR_SESION_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_colaboradores_en(v_sesion.iglesia_id, v_sesion.departamento_codigo) THEN
    RAISE EXCEPTION 'COLABORADOR_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;
  IF v_sesion.estado = 'FINALIZADO' THEN
    RETURN;
  END IF;

  UPDATE colaborador_sesion
  SET estado = 'FINALIZADO', fecha_finalizado = now(), finalizado_por = auth.uid()
  WHERE id = p_sesion_id;
END;
$$;

-- ============================================================
-- Suma el OR de colaborador a los 3 gates duros que hoy solo reconocen
-- Lider de Afirmacion / operativo (14-afirmacion). Ninguna otra rama de
-- estas funciones se toca. DROP primero -- Postgres no deja CREATE OR
-- REPLACE cuando el tipo de retorno (aunque parezca igual) no matchea
-- exactamente la firma ya registrada.
-- ============================================================
DROP FUNCTION IF EXISTS fn_registrar_persona_afirmacion(JSONB, UUID);
DROP FUNCTION IF EXISTS fn_listar_lideres_cdp_afirmacion(UUID);
DROP FUNCTION IF EXISTS fn_listar_casas_de_paz_afirmacion(UUID);

CREATE OR REPLACE FUNCTION fn_registrar_persona_afirmacion(p_datos JSONB, p_casa_de_paz_cargo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cargo        casa_de_paz_cargo;
  v_iglesia_id   UUID;
  v_persona_id   UUID;
BEGIN
  SELECT cc.* INTO v_cargo
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
  WHERE cc.id = p_casa_de_paz_cargo_id
    AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFIRMACION_LIDER_CDP_INVALIDO: el lider de casa de paz elegido no tiene un cargo vigente'
      USING ERRCODE = 'P0001';
  END IF;

  v_iglesia_id := v_cargo.iglesia_id;

  IF NOT (fn_es_lider_afirmacion_en(v_iglesia_id) OR fn_es_colaborador_activo_en(v_iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso, invitado_por_id)
  VALUES (v_iglesia_id, v_persona_id,
          (SELECT id FROM motivo_llegada WHERE codigo = 'INVITACION_PERSONAL'),
          CURRENT_DATE, v_cargo.persona_id);

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_iglesia_id, v_cargo.casa_de_paz_id, v_persona_id, true, CURRENT_DATE);

  RETURN jsonb_build_object(
    'persona_id', v_persona_id,
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', fn_etiqueta_cdp(v_cargo.casa_de_paz_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_listar_lideres_cdp_afirmacion(p_iglesia_id UUID)
RETURNS TABLE (
  casa_de_paz_cargo_id UUID,
  persona_id           UUID,
  lider_nombre         TEXT,
  casa_de_paz_id       UUID,
  cdp_etiqueta         TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)
          OR fn_es_colaborador_activo_en(p_iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT cc.id, cc.persona_id, fn_nombre_completo(p), cc.casa_de_paz_id, fn_etiqueta_cdp(cc.casa_de_paz_id)
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN persona p ON p.id = cc.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
  WHERE cc.iglesia_id = p_iglesia_id
    AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL
  ORDER BY fn_nombre_completo(p);
END;
$$;

CREATE OR REPLACE FUNCTION fn_listar_casas_de_paz_afirmacion(p_iglesia_id uuid)
 RETURNS TABLE(casa_de_paz_id uuid, casa_de_paz_etiqueta text, activo boolean, red_id uuid, red_nombre character varying, lider_red_nombre text, lider_cdp_nombre text, tiene_lider_vigente boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)
          OR fn_es_colaborador_activo_en(p_iglesia_id, 'AFIRMACION')) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    cdp.activo,
    r.id,
    r.nombre,
    (SELECT fn_nombre_completo(prl)
     FROM red_cargo rcl JOIN cargo cl ON cl.id = rcl.cargo_id JOIN persona prl ON prl.id = rcl.persona_id
     WHERE rcl.red_id = r.id AND cl.codigo = 'LIDER_RED'
       AND rcl.fecha_fin IS NULL AND rcl.fecha_eliminacion IS NULL
     LIMIT 1),
    (SELECT fn_nombre_completo(pcdp)
     FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id JOIN persona pcdp ON pcdp.id = ccl.persona_id
     WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
       AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
     LIMIT 1),
    EXISTS (
      SELECT 1 FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id
      WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
        AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
    )
  FROM casa_de_paz cdp
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cdp.iglesia_id = p_iglesia_id
    AND cdp.fecha_eliminacion IS NULL
  ORDER BY r.nombre NULLS LAST, fn_etiqueta_cdp(cdp.id);
END;
$function$;

-- ============================================================
-- Grants -- mismo patron que el resto de RPC de Afirmacion (authenticated
-- solamente, nada a anon/public).
-- ============================================================
GRANT EXECUTE ON FUNCTION fn_es_colaborador_activo_en(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_puede_gestionar_colaboradores_en(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_generar_codigo_colaborador(UUID, VARCHAR, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_revocar_codigo_colaborador(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_redimir_codigo_colaborador(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mi_colaboracion_activa() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mi_historial_colaborador() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_colaboradores(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_colaborador_auditoria(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_extender_colaborador_sesion(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_pausar_colaborador_sesion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_reanudar_colaborador_sesion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_finalizar_colaborador_sesion(UUID) TO authenticated;
