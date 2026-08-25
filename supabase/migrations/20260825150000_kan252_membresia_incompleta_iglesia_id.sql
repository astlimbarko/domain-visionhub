-- VisionHub -- 20260825150000_kan252_membresia_incompleta_iglesia_id.sql
-- KAN-252: ninguna de las 2 formas de "membresia incompleta" devolvia
-- iglesia_id -- solo iglesia_nombre -- asi que el frontend nunca tuvo forma
-- de pedir el catalogo de ministerios de esa iglesia (useMinisterios exige
-- iglesia_id) dentro del wizard autenticado. Se agrega iglesia_id, sin
-- tocar ningun otro campo ni comportamiento, en las 2 funciones que arman
-- ese jsonb:
--   - fn_mi_invitacion_pendiente (caso invitacion real, id != null)
--   - fn_mi_membresia_incompleta (caso general, id == null -- cuerpo
--     identico al de 20260821180000_kan213_membresia_una_vez_multiples_roles.sql,
--     que es la version vigente)

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
    'iglesia_id', r.iglesia_id,
    'iglesia_nombre', r.iglesia_nombre,
    'destino', CASE
      WHEN r.red_nombre IS NOT NULL THEN r.red_nombre
      WHEN r.casa_de_paz_id IS NOT NULL THEN fn_etiqueta_cdp(r.casa_de_paz_id)
      ELSE r.departamento_nombre
    END,
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
    'iglesia_id', v_iglesia_id,
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
