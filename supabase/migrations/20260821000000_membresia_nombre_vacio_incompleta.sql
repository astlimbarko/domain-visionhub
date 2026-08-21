-- VisionHub -- KAN-213: endurecer el gate de membresia contra nombre/apellido
-- vacios.
--
-- Hallazgo real (2026-08-20/21, cuenta de prueba test@somoscdv.com en Centro
-- de Vida Genesis): existia una fila de persona con primer_nombre/
-- primer_apellido = '' pero membresia_completada = true y creado_por = NULL
-- (no vino de ningun flujo de la app -- fn_crear_persona_si_falta ya se
-- negaba a crear una persona asi, ver 20260811060000). Esa fila rompia 2
-- pantallas a la vez: el navbar (nombre completo vacio, caia al correo) y
-- Casas de Paz de Afirmacion (fn_etiqueta_cdp devolvia el nombre vacio del
-- "lider" en vez de un nombre real).
--
-- Pedido explicito del owner: el sistema debe volver a pedir el formulario
-- de membresia si el nombre quedo vacio, en vez de necesitar un parche manual
-- de datos. Se resuelve con 2 cambios independientes (defensa en profundidad):
--
-- 1. fn_validar_campos_membresia_persona (trigger BEFORE INSERT OR UPDATE ON
--    persona, ya existente desde 21_validaciones_membresia.sql) ahora tambien
--    rechaza nombre/apellido en blanco de forma incondicional -- no depende
--    de configuracion por iglesia, porque primer_nombre/primer_apellido son
--    NOT NULL a nivel columna pero '' (cadena vacia) si pasaba.
-- 2. fn_mi_membresia_incompleta ya no confia ciegamente en
--    membresia_completada = true: si la persona activa tiene nombre o
--    apellido en blanco, se trata iguel que si la membresia nunca se hubiera
--    completado (mismo criterio de "campos obligatorios siempre", sin
--    importar la config de CI/fecha_nacimiento por iglesia). Esto hace que
--    la fila ya rota en produccion se autocorrija sola la proxima vez que esa
--    cuenta inicie sesion -- vuelve a aparecer el modal, empezando desde la
--    pagina 1, respetando "Saltar" como siempre.

CREATE OR REPLACE FUNCTION public.fn_validar_campos_membresia_persona()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF btrim(NEW.primer_nombre) = '' THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "primer_nombre" no puede estar vacío' USING ERRCODE = 'P0001';
  END IF;

  IF btrim(NEW.primer_apellido) = '' THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "primer_apellido" no puede estar vacío' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO') AND NEW.ci IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "ci" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO') AND NEW.fecha_nacimiento IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "fecha_nacimiento" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

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

    IF EXISTS (
      SELECT 1 FROM public.persona
      WHERE usuario_id = auth.uid() AND iglesia_id = v_iglesia_id
        AND membresia_completada = true AND fecha_eliminacion IS NULL
        AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
    ) THEN
      RETURN NULL;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.persona
      WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
        AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> ''
    ) THEN
      RETURN NULL;
    END IF;

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
