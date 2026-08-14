-- VisionHub -- KAN-179: guardado progresivo del formulario de "completar
-- membresia" (caso general Q-8, sin invitacion formal -- ej. Pastor/
-- Supervisor asignado directo desde Administracion). Pedido del owner
-- (2026-08-11): antes nada se guardaba hasta el clic final de la pagina 4/4
-- -- si la persona saltaba o cerraba sesion a mitad, se perdia todo lo
-- tipeado y la proxima vez arrancaba de cero en la pagina 1.
--
-- Diseno elegido: la Persona real se crea desde la PAGINA 1 (nombre/
-- apellido/sexo) con membresia_completada=false -- desde ese momento el
-- sistema "ya sabe su nombre" (aparece en fn_listar_usuarios, etc). Los
-- datos de las paginas 2-4 (Formacion/Mentor y Bautismo/Familia) se
-- acumulan en un borrador JSONB, NO en persona_detalle/persona_discipulado/
-- etc todavia -- para evitar el riesgo real de duplicar filas si
-- fn_guardar_membresia_extendida (que hace INSERT, no upsert, en varias
-- tablas hijas) se llamara mas de una vez con datos superpuestos. Esa
-- funcion sigue llamandose UNA SOLA VEZ, al finalizar (fn_completar_
-- membresia_general), igual que antes -- solo que ahora puede reusar la
-- Persona en borrador en vez de crear una nueva.

CREATE OR REPLACE FUNCTION public.fn_mi_iglesia_membresia_general()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ur.iglesia_id
  FROM usuario_rol ur
  WHERE ur.usuario_id = auth.uid() AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
  ORDER BY ur.fecha_creacion ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_mi_iglesia_membresia_general() TO authenticated;

ALTER TABLE persona
  ADD COLUMN IF NOT EXISTS membresia_completada BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS membresia_paso_actual SMALLINT,
  ADD COLUMN IF NOT EXISTS membresia_borrador JSONB;

-- fn_guardar_paso_membresia_general: se llama al avanzar de pagina (1..4)
-- en el caso general. Pagina 1 crea/actualiza la Persona real (en borrador,
-- membresia_completada=false). Paginas 2-4 solo acumulan en el JSONB.
CREATE OR REPLACE FUNCTION public.fn_guardar_paso_membresia_general(p_paso INT, p_datos JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID;
BEGIN
  v_iglesia_id := fn_mi_iglesia_membresia_general();
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEMBRESIA_GENERAL_SIN_ROL: no se encontro un rol vigente que requiera completar la membresia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_persona_id FROM persona
  WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
    AND membresia_completada = false AND fecha_eliminacion IS NULL;

  IF p_paso = 1 THEN
    IF v_persona_id IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM persona
        WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
      ) THEN
        RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                            sexo, fecha_nacimiento, ci, correo, membresia_completada, membresia_paso_actual)
      VALUES (v_iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
              p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
              (p_datos->>'sexo')::sexo_enum, NULLIF(p_datos->>'fecha_nacimiento', '')::date,
              p_datos->>'ci', p_datos->>'correo', false, 1);
    ELSE
      UPDATE persona SET
        primer_nombre = p_datos->>'primer_nombre',
        segundo_nombre = p_datos->>'segundo_nombre',
        primer_apellido = p_datos->>'primer_apellido',
        segundo_apellido = p_datos->>'segundo_apellido',
        sexo = (p_datos->>'sexo')::sexo_enum,
        fecha_nacimiento = NULLIF(p_datos->>'fecha_nacimiento', '')::date,
        ci = p_datos->>'ci',
        correo = p_datos->>'correo',
        membresia_paso_actual = GREATEST(COALESCE(membresia_paso_actual, 1), 1)
      WHERE id = v_persona_id;
    END IF;
  ELSE
    IF v_persona_id IS NULL THEN
      RAISE EXCEPTION 'MEMBRESIA_BORRADOR_NO_ENCONTRADO: complete primero la pagina de datos personales'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE persona SET
      membresia_borrador = COALESCE(membresia_borrador, '{}'::jsonb) || p_datos,
      membresia_paso_actual = GREATEST(COALESCE(membresia_paso_actual, 1), p_paso)
    WHERE id = v_persona_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_guardar_paso_membresia_general(INT, JSONB) TO authenticated;

-- fn_completar_membresia_general: si ya habia un borrador (creado por
-- fn_guardar_paso_membresia_general), lo reusa (UPDATE, no INSERT nuevo) y
-- lo marca completado -- si no habia borrador (alguien completa todo en un
-- solo paso, sin pasar por el guardado progresivo), se comporta exactamente
-- como antes.
CREATE OR REPLACE FUNCTION public.fn_completar_membresia_general(p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    AND membresia_completada = false AND fecha_eliminacion IS NULL;

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

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$$;

-- fn_mi_membresia_incompleta: "completado" ahora se define por
-- membresia_completada=true (no solo "existe una fila persona") -- un
-- borrador en progreso no cuenta como completado, para que el gate siga
-- disparando hasta que se termine de verdad. Cuando hay un borrador para la
-- iglesia resuelta, se devuelven sus datos ya guardados + el paso donde
-- quedo, para que el frontend pueda precargar el formulario y arrancar
-- ahi (no desde la pagina 1).
CREATE OR REPLACE FUNCTION public.fn_mi_membresia_incompleta()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitacion jsonb;
  v_iglesia_id uuid;
  v_iglesia_nombre text;
  v_rol text;
  v_borrador record;
BEGIN
  v_invitacion := public.fn_mi_invitacion_pendiente();
  IF v_invitacion IS NOT NULL THEN
    RETURN v_invitacion;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.persona
    WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  v_iglesia_id := public.fn_mi_iglesia_membresia_general();
  IF v_iglesia_id IS NULL THEN
    RETURN NULL;
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
    AND membresia_completada = false AND fecha_eliminacion IS NULL;

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
    'datos_guardados', CASE WHEN v_borrador.primer_nombre IS NULL THEN NULL ELSE
      jsonb_build_object(
        'primer_nombre', v_borrador.primer_nombre, 'segundo_nombre', v_borrador.segundo_nombre,
        'primer_apellido', v_borrador.primer_apellido, 'segundo_apellido', v_borrador.segundo_apellido,
        'sexo', v_borrador.sexo, 'fecha_nacimiento', v_borrador.fecha_nacimiento,
        'ci', v_borrador.ci, 'correo', v_borrador.correo
      ) || COALESCE(v_borrador.membresia_borrador, '{}'::jsonb)
    END
  );
END;
$$;
