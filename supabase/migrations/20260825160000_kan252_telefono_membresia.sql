-- VisionHub -- 20260825160000_kan252_telefono_membresia.sql
-- KAN-252: el wizard de Membresia pedia "Correo" (redundante -- la persona
-- ya inicio sesion con un correo real) y nunca pedia Telefono, aunque
-- persona.correo/telefono ya existen como conceptos separados y el modelo
-- telefono/telefono_asignacion (07_contacto.sql) ya soporta guardar uno.
-- Se agrega fn_guardar_telefono_membresia, mismo patron que
-- fn_resolver_invitaciones_pendientes_extra: se llama una sola vez, justo
-- despues de crear la persona, desde los 2 caminos que la crean
-- (fn_completar_membresia para invitacion real, fn_completar_membresia_general
-- para el caso general). Se guarda en formato E.164 (codigo de pais +
-- numero, sin separadores) para poder armar links de WhatsApp despues --
-- por eso el tipo por defecto es 'WHATSAPP' del catalogo tipo_telefono, no
-- 'CELULAR'. Si p_numero viene vacio/null, no hace nada (el campo es
-- opcional, igual que Correo lo era).

CREATE OR REPLACE FUNCTION fn_guardar_telefono_membresia(p_persona_id UUID, p_iglesia_id UUID, p_numero TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  IF p_numero IS NULL OR btrim(p_numero) = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_tipo_telefono_id
  FROM tipo_telefono
  WHERE codigo = 'WHATSAPP' AND fecha_eliminacion IS NULL;

  INSERT INTO telefono (iglesia_id, tipo_telefono_id, numero)
  VALUES (p_iglesia_id, v_tipo_telefono_id, btrim(p_numero))
  RETURNING id INTO v_telefono_id;

  INSERT INTO telefono_asignacion (iglesia_id, telefono_id, persona_id, es_principal)
  VALUES (p_iglesia_id, v_telefono_id, p_persona_id, true);
END;
$$;

REVOKE ALL ON FUNCTION fn_guardar_telefono_membresia(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_guardar_telefono_membresia(UUID, UUID, TEXT) TO authenticated;

-- fn_completar_membresia (camino invitacion real): cuerpo identico al de
-- 20260821180000_kan213_membresia_una_vez_multiples_roles.sql, agregando
-- una linea para guardar el telefono justo despues de crear la persona.
-- p_datos->>'telefono' viene armado por el frontend (codigo de pais +
-- numero, ver MembresiaObligatoria.tsx).
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
                        sexo, fecha_nacimiento, ci, correo, membresia_completada)
  VALUES (v_inv.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo', true)
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  PERFORM fn_guardar_telefono_membresia(v_persona_id, v_inv.iglesia_id, p_datos->>'telefono');

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

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', COALESCE((SELECT nombre FROM red WHERE id = v_inv.red_id), fn_etiqueta_cdp(v_inv.casa_de_paz_id))
  );
END;
$$;

-- fn_completar_membresia_general (camino sin invitacion): idem, cuerpo
-- identico al de 20260821180000, agregando el guardado de telefono en
-- ambas ramas (persona ya existente por guardado progresivo, o recien
-- creada) justo despues de tener v_persona_id resuelto.
CREATE OR REPLACE FUNCTION public.fn_completar_membresia_general(p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID;
  v_borrador JSONB;
  v_datos_completos JSONB;
BEGIN
  v_iglesia_id := fn_mi_iglesia_membresia_general();
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEMBRESIA_GENERAL_SIN_ROL: no se encontro un rol vigente que requiera completar la membresia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, membresia_borrador INTO v_persona_id, v_borrador FROM persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND fecha_eliminacion IS NULL
    AND (membresia_completada = false OR btrim(primer_nombre) = '' OR btrim(primer_apellido) = '');

  v_datos_completos := COALESCE(v_borrador, '{}'::jsonb) || p_datos;

  IF v_persona_id IS NOT NULL THEN
    UPDATE persona SET
      primer_nombre = p_datos->>'primer_nombre',
      segundo_nombre = p_datos->>'segundo_nombre',
      primer_apellido = p_datos->>'primer_apellido',
      segundo_apellido = p_datos->>'segundo_apellido',
      sexo = (p_datos->>'sexo')::sexo_enum,
      fecha_nacimiento = NULLIF(p_datos->>'fecha_nacimiento', '')::date,
      ci = p_datos->>'ci',
      correo = p_datos->>'correo',
      membresia_completada = true,
      membresia_borrador = NULL,
      membresia_paso_actual = NULL
    WHERE id = v_persona_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM persona
      WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
        AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
    ) THEN
      RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                          sexo, fecha_nacimiento, ci, correo, membresia_completada)
    VALUES (v_iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
            p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
            (p_datos->>'sexo')::sexo_enum, NULLIF(p_datos->>'fecha_nacimiento', '')::date,
            p_datos->>'ci', p_datos->>'correo', true)
    RETURNING id INTO v_persona_id;
  END IF;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  PERFORM fn_guardar_telefono_membresia(v_persona_id, v_iglesia_id, v_datos_completos->>'telefono');

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, v_datos_completos);

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$function$;
