-- KAN-488 (harness/21 Req 1): precarga de persona EXISTENTE en la Membresía
-- desde 0. Trae todos los datos que ya existen de una persona, mapeados a los
-- campos del formulario, para abrirlo precargado (ej. al llegar desde el botón
-- "Llenar membresía" de Bautismo, o al buscar a alguien ya registrado). El
-- teléfono se devuelve completo (con prefijo); el frontend lo separa en país +
-- número. La CdP y el invitador vienen con su etiqueta/nombre para mostrarlos.

CREATE OR REPLACE FUNCTION public.fn_obtener_persona_para_membresia(p_persona_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id uuid;
  v_result     jsonb;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEMBRESIA_PERSONA_INVALIDA: la persona no existe' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_puede_gestionar_afirmacion(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'persona_id', p.id,
    'primer_nombre', p.primer_nombre,
    'segundo_nombre', COALESCE(p.segundo_nombre, ''),
    'primer_apellido', p.primer_apellido,
    'segundo_apellido', COALESCE(p.segundo_apellido, ''),
    'sexo', COALESCE(p.sexo::text, ''),
    'fecha_nacimiento', COALESCE(p.fecha_nacimiento::text, ''),
    'ci', COALESCE(p.ci, ''),
    'correo', COALESCE(p.correo, ''),
    'estado_civil', COALESCE(pd.estado_civil::text, ''),
    'ocupacion', COALESCE(pd.ocupacion, ''),
    'grado_instruccion', COALESCE(pd.grado_instruccion::text, ''),
    'discipulado_nivel', COALESCE(pd.discipulado_nivel::text, ''),
    -- Teléfono principal (completo, con prefijo). El frontend lo separa.
    'telefono', COALESCE((
      SELECT t.numero FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
      WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL
        AND t.fecha_eliminacion IS NULL
      LIMIT 1), ''),
    -- Dirección principal (texto libre en calle).
    'direccion', COALESCE((
      SELECT d.calle FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
      WHERE da.persona_id = p.id AND da.es_principal AND da.fecha_eliminacion IS NULL
        AND d.fecha_eliminacion IS NULL
      LIMIT 1), ''),
    -- Llegada: cómo llegó + invitador (id o texto).
    'como_llego', COALESCE((
      SELECT pl.comentarios FROM persona_llegada pl
      WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
      ORDER BY pl.fecha_creacion DESC LIMIT 1), ''),
    'invitador_persona_id', COALESCE((
      SELECT pl.invitado_por_id::text FROM persona_llegada pl
      WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
      ORDER BY pl.fecha_creacion DESC LIMIT 1), ''),
    'invitador_nombre', COALESCE((
      SELECT CASE
        WHEN pl.invitado_por_id IS NOT NULL THEN (SELECT fn_nombre_completo(pi) FROM persona pi WHERE pi.id = pl.invitado_por_id)
        ELSE COALESCE(pl.invitado_por_txt, '')
      END
      FROM persona_llegada pl WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
      ORDER BY pl.fecha_creacion DESC LIMIT 1), ''),
    'invitador_es_libre', COALESCE((
      SELECT (pl.invitado_por_id IS NULL AND pl.invitado_por_txt IS NOT NULL)
      FROM persona_llegada pl WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
      ORDER BY pl.fecha_creacion DESC LIMIT 1), false),
    -- Casa de Paz principal.
    'casa_de_paz_id', COALESCE((
      SELECT cm.casa_de_paz_id::text FROM casa_de_paz_membresia cm
      WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL
        AND cm.fecha_eliminacion IS NULL LIMIT 1), ''),
    'casa_de_paz_nombre', COALESCE((
      SELECT fn_etiqueta_cdp(cm.casa_de_paz_id) FROM casa_de_paz_membresia cm
      WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL
        AND cm.fecha_eliminacion IS NULL LIMIT 1), '')
  )
  INTO v_result
  FROM persona p
  LEFT JOIN persona_detalle pd ON pd.persona_id = p.id
  WHERE p.id = p_persona_id;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_obtener_persona_para_membresia(uuid) TO authenticated;
