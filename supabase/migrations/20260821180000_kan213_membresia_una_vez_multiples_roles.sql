-- VisionHub -- KAN-213 (seguimiento): una cuenta con varios roles en la
-- misma iglesia volvía a pedir el formulario de membresía al entrar a un
-- segundo rol, aunque ya lo hubiera completado una vez. Reporte real del
-- owner 2026-08-21: cuenta nueva invitada a 2 cargos desde el Constructor
-- (Super Admin), completó el formulario una vez, entró a un rol, y al
-- acceder al otro se lo volvió a pedir.
--
-- Causa 1 (por qué el modal reaparecía): fn_mi_membresia_incompleta miraba
-- primero si había una invitación PENDIENTE (fn_mi_invitacion_pendiente, se
-- evalúa siempre, sin importar p_iglesia_id) y recién después si la persona
-- ya estaba completa -- una invitación vieja sin resolver hacía que el modal
-- volviera a aparecer aunque la persona (única por cuenta: uq_persona_usuario
-- es único por usuario_id, sin iglesia_id en la clave) ya tuviera el
-- formulario completo. Se invierte el orden: si la persona ya está completa,
-- se corta ahí, sin mirar invitaciones ni volver a filtrar por iglesia.
--
-- Causa 2 (por qué el segundo cargo de verdad faltaba, no era solo el
-- modal molestando): fn_completar_membresia solo resolvía la invitación MÁS
-- RECIENTE (ORDER BY fecha_creacion DESC LIMIT 1). Si la cuenta tenía más de
-- una invitacion_lider PENDIENTE, completar el formulario una vez otorgaba
-- un solo cargo y dejaba la segunda invitación sin cargo otorgado y sin
-- marcar COMPLETADA -- la app no mentía: ese segundo cargo nunca se llegó a
-- otorgar. Se agrega fn_resolver_invitaciones_pendientes_extra, que tanto
-- fn_completar_membresia (invitación) como fn_completar_membresia_general
-- (alta general/registro público + cargo asignado después) llaman al final
-- para otorgar TODAS las invitaciones pendientes restantes de la cuenta de
-- una sola vez, no solo la que disparó el formulario.

CREATE OR REPLACE FUNCTION public.fn_mi_membresia_incompleta(p_iglesia_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_invitacion jsonb;
  v_iglesia_id uuid;
  v_iglesia_nombre text;
  v_rol text;
  v_borrador record;
BEGIN
  -- Una cuenta = una sola persona en todo el sistema -- si ya completó el
  -- formulario una vez, alcanza para siempre, sin importar cuántos roles o
  -- invitaciones pendientes tenga. Este chequeo va PRIMERO, antes de mirar
  -- invitaciones, para no reabrir el modal por una invitación vieja sin
  -- resolver.
  IF EXISTS (
    SELECT 1 FROM public.persona
    WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
      AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
  ) THEN
    RETURN NULL;
  END IF;

  v_invitacion := public.fn_mi_invitacion_pendiente();
  IF v_invitacion IS NOT NULL THEN
    RETURN v_invitacion;
  END IF;

  IF p_iglesia_id IS NOT NULL THEN
    SELECT ur.iglesia_id INTO v_iglesia_id
    FROM public.usuario_rol ur
    WHERE ur.usuario_id = auth.uid() AND ur.iglesia_id = p_iglesia_id
      AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
    LIMIT 1;

    IF v_iglesia_id IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    v_iglesia_id := public.fn_mi_iglesia_membresia_general();
    IF v_iglesia_id IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT nombre INTO v_iglesia_nombre FROM public.iglesia WHERE id = v_iglesia_id;

  SELECT ur.rol::text INTO v_rol
  FROM public.usuario_rol ur
  WHERE ur.usuario_id = auth.uid() AND ur.iglesia_id = v_iglesia_id
    AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
  ORDER BY ur.fecha_creacion ASC
  LIMIT 1;

  SELECT primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, ci, correo,
         membresia_borrador, membresia_paso_actual
  INTO v_borrador
  FROM public.persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND fecha_eliminacion IS NULL
    AND (membresia_completada = false OR btrim(primer_nombre) = '' OR btrim(primer_apellido) = '');

  RETURN jsonb_build_object(
    'id', NULL,
    'rol', v_rol,
    'iglesia_nombre', v_iglesia_nombre,
    'destino', NULL,
    'campos_obligatorios', jsonb_build_object(
      'ci', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', public.fn_config_bool(v_iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    ),
    'paso_actual', COALESCE(v_borrador.membresia_paso_actual, 1),
    'datos_guardados', CASE WHEN v_borrador.primer_nombre IS NULL OR btrim(v_borrador.primer_nombre) = '' THEN NULL ELSE
      jsonb_build_object(
        'primer_nombre', v_borrador.primer_nombre, 'segundo_nombre', v_borrador.segundo_nombre,
        'primer_apellido', v_borrador.primer_apellido, 'segundo_apellido', v_borrador.segundo_apellido,
        'sexo', v_borrador.sexo, 'fecha_nacimiento', v_borrador.fecha_nacimiento,
        'ci', v_borrador.ci, 'correo', v_borrador.correo
      ) || COALESCE(v_borrador.membresia_borrador, '{}'::jsonb)
    END
  );
END;
$function$;

-- ============================================================
-- Otorga TODAS las invitaciones pendientes restantes de la cuenta al
-- completar el formulario -- no solo la que disparó el modal. Mismo switch
-- de cargos que ya usa fn_completar_membresia (42_invitacion_lideres.sql),
-- factorizado para no duplicarlo entre esa función y
-- fn_completar_membresia_general.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolver_invitaciones_pendientes_extra(p_persona_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
BEGIN
  FOR v_inv IN
    SELECT * FROM invitacion_lider
    WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  LOOP
    IF v_inv.rol = 'LIDER_RED' THEN
      UPDATE red_cargo SET fecha_fin = CURRENT_DATE
      WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
      INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.red_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);

    ELSIF v_inv.rol = 'LIDER_CDP' THEN
      UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
      WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
      INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);

    ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
      INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
    END IF;

    UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolver_invitaciones_pendientes_extra(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_resolver_invitaciones_pendientes_extra(UUID) TO authenticated;

-- fn_completar_membresia (camino invitación): además de la invitación que
-- disparó el formulario, otorga cualquier otra que haya quedado pendiente.
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

-- fn_completar_membresia_general (camino sin invitación: alta por registro
-- público/Google + cargo asignado después vía Constructor): idem, otorga
-- cualquier invitación pendiente que la cuenta tenga.
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

  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_iglesia_id, v_datos_completos);

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$function$;
