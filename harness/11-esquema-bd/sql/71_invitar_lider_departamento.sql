-- VisionHub -- 71_invitar_lider_departamento.sql
-- Pedido explicito del owner (2026-08-01): el Supervisor de la Vision en
-- Accion debe poder invitar por correo (cuenta nueva) al Lider de un
-- departamento, no solo buscar entre personas existentes (68_/panel basico
-- de ayer). Reutiliza el mecanismo de invitacion_lider (42_) ya usado para
-- Lider de Red/CdP -- mismo patron: invita, la persona acepta, completa el
-- formulario de membresia, y recien ahi se asigna el cargo (aca,
-- departamento_cargo en vez de red_cargo/casa_de_paz_cargo).
--
-- Diferencia clave: LIDER_DEPARTAMENTO no es un valor de rol_sistema_enum
-- (no da acceso de "rol de sistema" -- el acceso al modulo de Afirmacion se
-- deriva de tener un departamento_cargo vigente, no de usuario_rol). Por
-- eso `rol` pasa a ser NULLABLE en invitacion_lider: NULL + departamento_id
-- identifica una invitacion departamental.

ALTER TABLE invitacion_lider ALTER COLUMN rol DROP NOT NULL;
ALTER TABLE invitacion_lider ADD COLUMN departamento_id UUID REFERENCES departamento(id);

ALTER TABLE invitacion_lider DROP CONSTRAINT chk_invitacion_lider_rol;
ALTER TABLE invitacion_lider ADD CONSTRAINT chk_invitacion_lider_rol
  CHECK (rol IS NULL OR rol IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP'));

ALTER TABLE invitacion_lider DROP CONSTRAINT chk_invitacion_lider_destino;
ALTER TABLE invitacion_lider ADD CONSTRAINT chk_invitacion_lider_destino CHECK (
  (rol = 'LIDER_RED' AND red_id IS NOT NULL AND casa_de_paz_id IS NULL AND departamento_id IS NULL) OR
  (rol IN ('LIDER_CDP', 'SUBLIDER_CDP') AND casa_de_paz_id IS NOT NULL AND red_id IS NULL AND departamento_id IS NULL) OR
  (rol IS NULL AND departamento_id IS NOT NULL AND red_id IS NULL AND casa_de_paz_id IS NULL)
);

-- ============================================================
-- Permiso: agrega la rama departamento (mismo criterio que LIDER_RED --
-- fn_es_operativo_en de la iglesia duena del departamento).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_puede_invitar_lider(
  p_rol rol_sistema_enum, p_red_id UUID, p_casa_de_paz_id UUID, p_departamento_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_red_de_cdp UUID;
BEGIN
  IF p_departamento_id IS NOT NULL THEN
    SELECT iglesia_id INTO v_iglesia_id FROM departamento WHERE id = p_departamento_id;
    RETURN v_iglesia_id IS NOT NULL AND fn_es_operativo_en(v_iglesia_id);
  END IF;

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

-- ============================================================
-- Invitar: agrega la rama departamento -- no toca usuario_rol (no es un rol
-- de sistema), solo crea el registro pendiente de invitacion_lider.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_invitar_lider(
  p_usuario_id UUID, p_correo TEXT, p_rol rol_sistema_enum,
  p_red_id UUID DEFAULT NULL, p_casa_de_paz_id UUID DEFAULT NULL, p_departamento_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_cargo_id UUID;
BEGIN
  IF NOT fn_puede_invitar_lider(p_rol, p_red_id, p_casa_de_paz_id, p_departamento_id) THEN
    RAISE EXCEPTION 'INVITACION_LIDER_SIN_PERMISO: no tenes permiso para invitar aqui' USING ERRCODE = 'P0001';
  END IF;

  IF p_departamento_id IS NOT NULL THEN
    SELECT iglesia_id INTO v_iglesia_id FROM departamento WHERE id = p_departamento_id;
    SELECT id INTO v_cargo_id FROM cargo WHERE codigo = 'LIDER_DEPARTAMENTO' AND activo;
    IF v_cargo_id IS NULL THEN
      RAISE EXCEPTION 'INVITACION_LIDER_CARGO_INEXISTENTE: no existe el cargo LIDER_DEPARTAMENTO en el catalogo' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO invitacion_lider (usuario_id, correo, iglesia_id, rol, departamento_id, cargo_id)
    VALUES (p_usuario_id, p_correo, v_iglesia_id, NULL, p_departamento_id, v_cargo_id);
    RETURN;
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
-- Completar membresia: agrega la rama departamento (mismo patron que
-- LIDER_RED -- termina el titular anterior, si habia, antes de insertar).
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

  ELSIF v_inv.departamento_id IS NOT NULL THEN
    UPDATE departamento_cargo SET fecha_fin = CURRENT_DATE
    WHERE departamento_id = v_inv.departamento_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO departamento_cargo (iglesia_id, departamento_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.departamento_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', COALESCE(
      (SELECT nombre FROM red WHERE id = v_inv.red_id),
      fn_etiqueta_cdp(v_inv.casa_de_paz_id),
      (SELECT nombre FROM departamento WHERE id = v_inv.departamento_id)
    )
  );
END;
$$;

-- ============================================================
-- Lo que ve el propio invitado: agrega departamento_id/nombre al JSONB.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_mi_invitacion_pendiente()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT il.id, il.rol, il.iglesia_id, i.nombre AS iglesia_nombre,
         red.nombre AS red_nombre, il.casa_de_paz_id, il.departamento_id, d.nombre AS departamento_nombre
  INTO r
  FROM invitacion_lider il
  JOIN iglesia i ON i.id = il.iglesia_id
  LEFT JOIN red ON red.id = il.red_id
  LEFT JOIN departamento d ON d.id = il.departamento_id
  WHERE il.usuario_id = auth.uid() AND il.estado = 'PENDIENTE' AND il.fecha_eliminacion IS NULL
  ORDER BY il.fecha_creacion DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'rol', r.rol,
    'iglesia_nombre', r.iglesia_nombre,
    'destino', COALESCE(r.red_nombre, fn_etiqueta_cdp(r.casa_de_paz_id), r.departamento_nombre),
    'departamento_nombre', r.departamento_nombre,
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
-- Listado (Redes/Casas de Paz): excluye invitaciones departamentales a
-- proposito -- tienen su propio listado abajo, para no romper
-- NOMBRE_ROL_INVITABLE[inv.rol] en GestionEstructuraVista.tsx (rol NULL).
-- ============================================================
DROP FUNCTION IF EXISTS fn_listar_invitaciones_lider(UUID);

CREATE FUNCTION fn_listar_invitaciones_lider(p_iglesia_id UUID)
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
  WHERE il.iglesia_id = p_iglesia_id AND il.fecha_eliminacion IS NULL AND il.departamento_id IS NULL
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

-- Listado propio para el nuevo menu "Departamentos" (Supervisor).
CREATE OR REPLACE FUNCTION fn_listar_invitaciones_departamento(p_iglesia_id UUID)
RETURNS TABLE (id UUID, correo VARCHAR, departamento_id UUID, estado VARCHAR, fecha_creacion TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT il.id, il.correo, il.departamento_id, il.estado, il.fecha_creacion
  FROM invitacion_lider il
  WHERE il.iglesia_id = p_iglesia_id AND il.departamento_id IS NOT NULL AND il.fecha_eliminacion IS NULL
    AND fn_es_operativo_en(p_iglesia_id)
  ORDER BY il.fecha_creacion DESC;
$$;

GRANT EXECUTE ON FUNCTION fn_puede_invitar_lider(rol_sistema_enum, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_invitar_lider(UUID, TEXT, rol_sistema_enum, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_invitaciones_lider(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_invitaciones_departamento(UUID) TO authenticated;
