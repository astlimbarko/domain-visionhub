-- VisionHub -- KAN-179 (seguimiento): el gate de "completar membresia"
-- solo se evaluaba una vez, al iniciar sesion, resolviendo la iglesia por
-- el rol MAS ANTIGUO de la cuenta (fn_mi_iglesia_membresia_general). Si la
-- persona cambiaba a otro rol/iglesia despues (multirol), el gate no se
-- volvia a evaluar contra esa iglesia -- pedido del owner: "necesitamos
-- molestarlo que realice su formulario de membresia" tambien al cambiar de
-- rol, no solo al entrar.
--
-- fn_mi_membresia_incompleta ahora acepta un p_iglesia_id opcional:
--   - sin argumento (login, Promise.all de sesion.service.ts): comportamiento
--     identico a antes, resuelve por el rol mas antiguo.
--   - con argumento (recheck al cambiar de rol activo, PrivateLayout.tsx):
--     valida que la cuenta tenga un rol vigente (no SUPER_ADMIN) en ESA
--     iglesia puntual, y chequea "completado" para ESA iglesia especifica,
--     no de forma global -- asi si el rol activo apunta a una iglesia
--     distinta de la del rol mas antiguo, tambien dispara si falta.

DROP FUNCTION IF EXISTS public.fn_mi_membresia_incompleta();

CREATE FUNCTION public.fn_mi_membresia_incompleta(p_iglesia_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
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
    ) THEN
      RETURN NULL;
    END IF;
  ELSE
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
$function$;

GRANT EXECUTE ON FUNCTION public.fn_mi_membresia_incompleta(UUID) TO authenticated;
