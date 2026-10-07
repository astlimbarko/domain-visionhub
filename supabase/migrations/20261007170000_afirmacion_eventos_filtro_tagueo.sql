-- Panel de Eventos de Afirmación (2026-10-07) parte 2: filtrar el historial por
-- evento + exponer fecha_nacimiento (para la columna Edad), y taguear el
-- evento_id al registrar un proceso.

-- ── Historial: + p_evento_id (filtro) + fecha_nacimiento (para Edad) ─────────
-- Cambia el tipo de retorno (nueva columna), así que hay que DROP + CREATE.
-- Mantiene todo lo de la versión viva (visibilidad total, registrado_por_nombre,
-- filtro opcional por colaborador).
DROP FUNCTION IF EXISTS public.fn_afirmacion_historial_proceso(uuid, proceso_afirmacion_codigo_enum, uuid);

CREATE OR REPLACE FUNCTION public.fn_afirmacion_historial_proceso(
  p_iglesia_id uuid,
  p_proceso_codigo proceso_afirmacion_codigo_enum,
  p_registrado_por uuid DEFAULT NULL,
  p_evento_id uuid DEFAULT NULL
)
 RETURNS TABLE(
   id uuid, persona_id uuid, nombre_completo text, fecha_nacimiento date,
   fecha date, fecha_creacion timestamp with time zone,
   registrado_por uuid, registrado_por_nombre text
 )
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT r.id, r.persona_id, fn_nombre_completo(p), p.fecha_nacimiento,
         r.fecha, r.fecha_creacion,
         r.creado_por, coalesce(fn_nombre_completo(pr), split_part(au.email, '@', 1))
  FROM persona_proceso_afirmacion r
  JOIN persona p ON p.id = r.persona_id
  LEFT JOIN persona pr ON pr.usuario_id = r.creado_por AND pr.fecha_eliminacion IS NULL
  LEFT JOIN auth.users au ON au.id = r.creado_por
  WHERE r.iglesia_id = p_iglesia_id AND r.proceso_codigo = p_proceso_codigo AND r.fecha_eliminacion IS NULL
    AND (p_registrado_por IS NULL OR r.creado_por = p_registrado_por)
    -- Filtro opcional por evento (cuando hay un evento activo seleccionado).
    AND (p_evento_id IS NULL OR r.evento_id = p_evento_id)
  ORDER BY r.fecha_creacion DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_historial_proceso(uuid, proceso_afirmacion_codigo_enum, uuid, uuid) TO authenticated;

-- ── Registrar proceso (Altar/Bautismo/RSIL): + p_evento_id ───────────────────
-- Se dropea la firma vieja (sin p_evento_id): agregar un parámetro con DEFAULT
-- crea una SOBRECARGA nueva en vez de reemplazar, y dejar ambas provoca
-- ambigüedad cuando el front llama por PostgREST. Queda solo la nueva (el DEFAULT
-- cubre las llamadas que no mandan evento).
DROP FUNCTION IF EXISTS public.fn_afirmacion_registrar_proceso(uuid, proceso_afirmacion_codigo_enum, date);
DROP FUNCTION IF EXISTS public.fn_afirmacion_registrar_membresia_nuevos(uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_afirmacion_registrar_proceso(
  p_persona_id uuid, p_proceso_codigo proceso_afirmacion_codigo_enum, p_fecha date,
  p_evento_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'PERSONA_INEXISTENTE: la persona no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_afirmacion(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene permiso para registrar este proceso' USING ERRCODE = 'P0001';
  END IF;
  IF p_fecha IS NULL OR p_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'FECHA_INVALIDA: la fecha no puede estar vacia ni ser futura' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona_proceso_afirmacion (persona_id, iglesia_id, proceso_codigo, fecha, evento_id)
  VALUES (p_persona_id, v_iglesia_id, p_proceso_codigo, p_fecha, p_evento_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_registrar_proceso(uuid, proceso_afirmacion_codigo_enum, date, uuid) TO authenticated;

-- ── Registrar membresía de nuevos: + p_evento_id ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_afirmacion_registrar_membresia_nuevos(
  p_persona_id uuid, p_iglesia_id uuid, p_evento_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM persona WHERE id = p_persona_id AND iglesia_id = p_iglesia_id
                 AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_PERSONA_INVALIDA: la persona no existe en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id
  FROM persona_proceso_afirmacion
  WHERE persona_id = p_persona_id AND proceso_codigo = 'MEMBRESIA_NUEVOS'
    AND fecha_eliminacion IS NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO persona_proceso_afirmacion (persona_id, iglesia_id, proceso_codigo, fecha, evento_id)
    VALUES (p_persona_id, p_iglesia_id, 'MEMBRESIA_NUEVOS', CURRENT_DATE, p_evento_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE persona_proceso_afirmacion
    SET fecha_actualizacion = now(), actualizado_por = auth.uid(),
        evento_id = COALESCE(p_evento_id, evento_id)
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_registrar_membresia_nuevos(uuid, uuid, uuid) TO authenticated;
