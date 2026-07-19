-- VisionHub -- 42_invitacion_lideres.sql
-- Flujo de membresia para lideres nuevos, pedido explicito del owner (verbatim,
-- 2026-07-19, ver sesion): el Supervisor de la Vision en Accion o el Lider de
-- Red (dentro de su propia red) pueden dar de alta un Lider/Sublider de CdP o
-- un Lider de Red que todavia no existe en el sistema poniendo solo su
-- correo. Supabase manda la invitacion; al entrar por primera vez, ese lider
-- ve obligatorio el formulario de membresia (mismos campos configurables
-- MEMBRESIA_* de 21_validaciones_membresia.sql) antes de ver su panel. Se
-- puede reenviar la invitacion, y el Supervisor puede pedir de forma manual
-- que se le reenvie el restablecimiento de contrasena (eso ultimo no
-- necesita SQL nuevo: reusa auth.resetPasswordForEmail, ya usado por
-- "olvidaste tu contrasena").
--
-- Separado a proposito de fn_puede_invitar/fn_crear_usuario_rol
-- (28_invitaciones_y_privacidad.sql, 30_fusiones_y_pin.sql), que son el
-- camino de Super Admin/Pastor/Supervisor para dar de alta cuentas de
-- sistema (correo + cargo, sin persona). Este es un camino operativo
-- distinto: el destino (red o casa de paz especifica) importa para el
-- permiso, y termina obligando a completar una Persona real.

-- ============================================================
-- 1. Tabla
-- ============================================================
CREATE TABLE invitacion_lider (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES auth.users(id),
  correo            VARCHAR NOT NULL,
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  rol               rol_sistema_enum NOT NULL,
  red_id            UUID REFERENCES red(id),
  casa_de_paz_id    UUID REFERENCES casa_de_paz(id),
  cargo_id          UUID NOT NULL REFERENCES cargo(id),
  estado            VARCHAR NOT NULL DEFAULT 'PENDIENTE',
  fecha_completada  TIMESTAMPTZ,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_invitacion_lider_rol CHECK (rol IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')),
  CONSTRAINT chk_invitacion_lider_estado CHECK (estado IN ('PENDIENTE', 'COMPLETADA')),
  CONSTRAINT chk_invitacion_lider_destino CHECK (
    (rol = 'LIDER_RED' AND red_id IS NOT NULL AND casa_de_paz_id IS NULL) OR
    (rol IN ('LIDER_CDP', 'SUBLIDER_CDP') AND casa_de_paz_id IS NOT NULL AND red_id IS NULL)
  )
);

CREATE TRIGGER trg_auditoria_invitacion_lider BEFORE INSERT OR UPDATE ON invitacion_lider FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_invitacion_lider BEFORE DELETE ON invitacion_lider FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- Sin politicas RLS para `authenticated`: con RLS activo y cero policies el
-- acceso directo por PostgREST queda en cero filas para cualquiera. Todo el
-- acceso real pasa por las funciones SECURITY DEFINER de abajo, mismo patron
-- que fn_listar_usuarios con usuario_rol.
ALTER TABLE invitacion_lider ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Permiso: quien puede invitar a que rol/destino
-- ============================================================
CREATE OR REPLACE FUNCTION fn_puede_invitar_lider(p_rol rol_sistema_enum, p_red_id UUID, p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_red_de_cdp UUID;
BEGIN
  IF p_rol = 'LIDER_RED' THEN
    IF p_red_id IS NULL THEN RETURN false; END IF;
    SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
    RETURN v_iglesia_id IS NOT NULL AND fn_es_operativo_en(v_iglesia_id);

  ELSIF p_rol IN ('LIDER_CDP', 'SUBLIDER_CDP') THEN
    IF p_casa_de_paz_id IS NULL THEN RETURN false; END IF;
    SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
    IF v_iglesia_id IS NULL THEN RETURN false; END IF;
    IF fn_es_operativo_en(v_iglesia_id) THEN RETURN true; END IF;

    SELECT cr.red_id INTO v_red_de_cdp FROM casa_de_paz_red cr
    WHERE cr.casa_de_paz_id = p_casa_de_paz_id AND cr.fecha_eliminacion IS NULL;
    RETURN v_red_de_cdp IS NOT NULL AND fn_es_lider_de_red(v_red_de_cdp);

  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Version iglesia-wide, usada solo por trg_validar_asignacion_rol (el
-- trigger no tiene el red_id/casa_de_paz_id exacto en NEW: usuario_rol es
-- generico). El alcance fino real (a que CdP puntual se le puede asignar
-- cargo) sigue viviendo en fn_puede_invitar_lider de arriba y en
-- fn_completar_membresia mas abajo -- esta funcion solo evita que el
-- trigger bloquee un INSERT que fn_invitar_lider ya valido con precision.
CREATE OR REPLACE FUNCTION fn_es_lider_de_red_en_iglesia(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id JOIN red r ON r.id = rc.red_id
    WHERE r.iglesia_id = p_iglesia_id AND rc.persona_id = fn_mi_persona_id()
      AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  );
$$;

-- Antes: NEW.rol IN ('LIDER_RED','LIDER_CDP','SUBLIDER_CDP') exigia
-- fn_es_operativo_en para los tres. Se separa LIDER_RED (sigue exigiendo
-- Pastor/Supervisor) de LIDER_CDP/SUBLIDER_CDP (ahora tambien permite a un
-- Lider de Red de esa iglesia, para que fn_invitar_lider pueda insertar).
CREATE OR REPLACE FUNCTION fn_validar_asignacion_rol()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT fn_es_pastor_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'LIDER_RED' AND NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_CDP', 'SUBLIDER_CDP')
     AND NOT (fn_es_operativo_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor o Lider de Red en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
     AND EXISTS (SELECT 1 FROM usuario_rol WHERE usuario_id = NEW.usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'ROL_SUPER_ADMIN_NO_OPERATIVO: un Super Admin no puede tener roles operativos; se necesita una cuenta separada' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Invitar: crea usuario_rol (recien ahi el invitado "existe" para
-- fn_mis_iglesias) + el registro pendiente. Llamada DESPUES de que la Edge
-- Function ya creo el auth.users con supabaseAdmin.auth.admin.inviteUserByEmail.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_invitar_lider(
  p_usuario_id UUID, p_correo TEXT, p_rol rol_sistema_enum,
  p_red_id UUID DEFAULT NULL, p_casa_de_paz_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_cargo_id UUID;
BEGIN
  IF NOT fn_puede_invitar_lider(p_rol, p_red_id, p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'INVITACION_LIDER_SIN_PERMISO: no tenes permiso para invitar aqui' USING ERRCODE = 'P0001';
  END IF;

  IF p_rol = 'LIDER_RED' THEN
    SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
  ELSE
    SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  END IF;

  SELECT id INTO v_cargo_id FROM cargo WHERE codigo = p_rol::text AND activo;
  IF v_cargo_id IS NULL THEN
    RAISE EXCEPTION 'INVITACION_LIDER_CARGO_INEXISTENTE: no existe el cargo % en el catalogo', p_rol USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuario_rol (usuario_id, rol, iglesia_id) VALUES (p_usuario_id, p_rol, v_iglesia_id);

  INSERT INTO invitacion_lider (usuario_id, correo, iglesia_id, rol, red_id, casa_de_paz_id, cargo_id)
  VALUES (p_usuario_id, p_correo, v_iglesia_id, p_rol, p_red_id, p_casa_de_paz_id, v_cargo_id);
END;
$$;

-- ============================================================
-- 4. Lo que ve el propio invitado al loguearse por primera vez
-- ============================================================
CREATE OR REPLACE FUNCTION fn_mi_invitacion_pendiente()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT il.id, il.rol, il.iglesia_id, i.nombre AS iglesia_nombre,
         red.nombre AS red_nombre, il.casa_de_paz_id
  INTO r
  FROM invitacion_lider il
  JOIN iglesia i ON i.id = il.iglesia_id
  LEFT JOIN red ON red.id = il.red_id
  WHERE il.usuario_id = auth.uid() AND il.estado = 'PENDIENTE' AND il.fecha_eliminacion IS NULL
  ORDER BY il.fecha_creacion DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'rol', r.rol,
    'iglesia_nombre', r.iglesia_nombre,
    'destino', COALESCE(r.red_nombre, fn_etiqueta_cdp(r.casa_de_paz_id)),
    'campos_obligatorios', jsonb_build_object(
      'ci', fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    )
  );
END;
$$;

-- ============================================================
-- 5. Completar membresia: crea la Persona real y recien ahi asigna el
-- cargo (red_cargo/casa_de_paz_cargo) -- mismo motivo que
-- fn_registrar_persona_via_url crea siempre persona_detalle: los triggers
-- de obligatoriedad de 21_validaciones_membresia.sql necesitan la fila.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_completar_membresia(p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
  v_persona_id UUID;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider
  WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBRESIA_SIN_INVITACION_PENDIENTE: no hay una invitacion pendiente para completar' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_inv.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  IF v_inv.rol = 'LIDER_RED' THEN
    UPDATE red_cargo SET fecha_fin = CURRENT_DATE
    WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', COALESCE((SELECT nombre FROM red WHERE id = v_inv.red_id), fn_etiqueta_cdp(v_inv.casa_de_paz_id))
  );
END;
$$;

-- ============================================================
-- 6. Listado (Redes/Casas de Paz) + permiso de reenviar
-- ============================================================
CREATE OR REPLACE FUNCTION fn_listar_invitaciones_lider(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, correo VARCHAR, rol rol_sistema_enum, estado VARCHAR,
  red_id UUID, red_nombre VARCHAR, casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT,
  fecha_creacion TIMESTAMPTZ, fecha_completada TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT il.id, il.correo, il.rol, il.estado, il.red_id, red.nombre,
         il.casa_de_paz_id, fn_etiqueta_cdp(il.casa_de_paz_id), il.fecha_creacion, il.fecha_completada
  FROM invitacion_lider il
  LEFT JOIN red ON red.id = il.red_id
  WHERE il.iglesia_id = p_iglesia_id AND il.fecha_eliminacion IS NULL
    AND (
      fn_es_operativo_en(p_iglesia_id)
      OR (il.red_id IS NOT NULL AND fn_es_lider_de_red(il.red_id))
      OR (il.casa_de_paz_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM casa_de_paz_red cr WHERE cr.casa_de_paz_id = il.casa_de_paz_id
              AND cr.fecha_eliminacion IS NULL AND fn_es_lider_de_red(cr.red_id)
          ))
    )
  ORDER BY il.fecha_creacion DESC;
$$;

-- Usada por la Edge Function de reenvio: si el que llama no tiene permiso
-- sobre esa invitacion puntual, o ya se completo, no devuelve nada.
CREATE OR REPLACE FUNCTION fn_correo_invitacion_lider_si_puedo_gestionar(p_invitacion_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
  v_puede BOOLEAN;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider WHERE id = p_invitacion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND OR v_inv.estado <> 'PENDIENTE' THEN RETURN NULL; END IF;

  v_puede := fn_es_operativo_en(v_inv.iglesia_id)
    OR (v_inv.red_id IS NOT NULL AND fn_es_lider_de_red(v_inv.red_id))
    OR (v_inv.casa_de_paz_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM casa_de_paz_red cr WHERE cr.casa_de_paz_id = v_inv.casa_de_paz_id
            AND cr.fecha_eliminacion IS NULL AND fn_es_lider_de_red(cr.red_id)
        ));

  IF NOT v_puede THEN RETURN NULL; END IF;
  RETURN v_inv.correo;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_puede_invitar_lider(rol_sistema_enum, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_invitar_lider(UUID, TEXT, rol_sistema_enum, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mi_invitacion_pendiente() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_completar_membresia(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_invitaciones_lider(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_correo_invitacion_lider_si_puedo_gestionar(UUID) TO authenticated;
