-- Panel de Eventos de Afirmación (2026-10-08): el modal "Crear evento" deja de
-- pedir un "tipo de evento" (combobox) y pasa a definirse por sus ACTIVIDADES
-- (Altar / RSIL / Bautismo+Membresía). Cada evento guarda qué actividades
-- cubre; el selector de "Evento activo" de cada puerta solo muestra los eventos
-- cuya lista de actividades incluye ese proceso.

-- 1) Tipo de evento genérico por defecto para los eventos de Afirmación: la
--    columna evento.tipo_evento_id es NOT NULL y `tipo_evento` es una tabla
--    compartida (Megafiesta, etc.). En vez de aflojar la FK, usamos un tipo
--    propio del Dpto. (global, iglesia_id NULL) como valor por defecto.
INSERT INTO public.tipo_evento (codigo, nombre, color, activo, orden)
SELECT 'AFIRMACION', 'Evento de Afirmación', '#0071E3', true, 50
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipo_evento WHERE codigo = 'AFIRMACION' AND iglesia_id IS NULL
);

-- 2) Actividades que cubre cada evento (subconjunto de proceso_codigo: ALTAR,
--    RSIL, BAUTISMO, MEMBRESIA_NUEVOS). NULL = sin restricción (eventos viejos)
--    → se muestran en todas las puertas (compatibilidad hacia atrás).
ALTER TABLE public.evento
  ADD COLUMN IF NOT EXISTS afirmacion_actividades text[];

-- ── Crear un evento de Afirmación (sin tipo; con actividades) ────────────────
DROP FUNCTION IF EXISTS public.fn_afirmacion_crear_evento(uuid, text, uuid, date, date, text);
CREATE OR REPLACE FUNCTION public.fn_afirmacion_crear_evento(
  p_iglesia_id uuid, p_titulo text, p_fecha_inicio date, p_fecha_fin date,
  p_descripcion text, p_actividades text[]
)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_tipo_id uuid;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al módulo de Afirmación en esta iglesia' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(btrim(p_titulo),'') = '' THEN
    RAISE EXCEPTION 'EVENTO_SIN_TITULO: el evento necesita un título' USING ERRCODE = 'P0001';
  END IF;
  IF p_fecha_inicio IS NULL THEN
    RAISE EXCEPTION 'EVENTO_SIN_FECHA: el evento necesita una fecha de inicio' USING ERRCODE = 'P0001';
  END IF;
  IF p_fecha_fin IS NOT NULL AND p_fecha_fin < p_fecha_inicio THEN
    RAISE EXCEPTION 'EVENTO_FECHA_INVALIDA: la fecha de fin no puede ser anterior a la de inicio' USING ERRCODE = 'P0001';
  END IF;
  IF p_actividades IS NULL OR array_length(p_actividades, 1) IS NULL THEN
    RAISE EXCEPTION 'EVENTO_SIN_ACTIVIDADES: marcá al menos una actividad (Altar, RSIL o Bautismo+Membresía)' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_tipo_id FROM tipo_evento
   WHERE codigo = 'AFIRMACION' AND iglesia_id IS NULL AND fecha_eliminacion IS NULL
   LIMIT 1;

  INSERT INTO evento (iglesia_id, tipo_evento_id, titulo, descripcion, fecha_inicio, fecha_fin, es_afirmacion, afirmacion_actividades, creado_por)
  VALUES (p_iglesia_id, v_tipo_id, btrim(p_titulo), NULLIF(btrim(p_descripcion),''),
          p_fecha_inicio, p_fecha_fin, true, p_actividades, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ── Listar eventos (con actividades; filtro opcional por proceso) ────────────
DROP FUNCTION IF EXISTS public.fn_afirmacion_listar_eventos(uuid, boolean);
CREATE OR REPLACE FUNCTION public.fn_afirmacion_listar_eventos(
  p_iglesia_id uuid, p_solo_activos boolean DEFAULT false, p_proceso_codigo text DEFAULT NULL
)
 RETURNS TABLE (
   id uuid, titulo text, tipo_evento_id uuid, tipo_nombre text, color text,
   fecha_inicio date, fecha_fin date, es_recurrente boolean, activo boolean,
   afirmacion_actividades text[],
   total_personas bigint, total_rsil bigint, total_bautismo bigint, total_membresia bigint
 )
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al módulo de Afirmación en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo::text, e.tipo_evento_id, te.nombre::text, te.color::text,
         e.fecha_inicio, e.fecha_fin,
         (te.codigo = 'REUNION') AS es_recurrente,
         (e.fecha_inicio <= CURRENT_DATE AND (e.fecha_fin IS NULL OR e.fecha_fin >= CURRENT_DATE)) AS activo,
         e.afirmacion_actividades,
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'RSIL' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'BAUTISMO' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'MEMBRESIA_NUEVOS' AND pp.fecha_eliminacion IS NULL)
  FROM evento e
  LEFT JOIN tipo_evento te ON te.id = e.tipo_evento_id
  WHERE e.iglesia_id = p_iglesia_id AND e.es_afirmacion AND e.fecha_eliminacion IS NULL
    AND (NOT p_solo_activos OR (e.fecha_inicio <= CURRENT_DATE AND (e.fecha_fin IS NULL OR e.fecha_fin >= CURRENT_DATE)))
    -- Filtro por puerta: si se pide un proceso, solo los eventos que lo cubren.
    -- Eventos viejos sin actividades (NULL) se muestran en todas las puertas.
    AND (p_proceso_codigo IS NULL OR e.afirmacion_actividades IS NULL OR p_proceso_codigo = ANY(e.afirmacion_actividades))
  ORDER BY e.fecha_inicio DESC, e.fecha_creacion DESC;
END;
$function$;

-- ── Detalle de un evento (misma forma, una fila) ─────────────────────────────
DROP FUNCTION IF EXISTS public.fn_afirmacion_evento_detalle(uuid);
CREATE OR REPLACE FUNCTION public.fn_afirmacion_evento_detalle(p_evento_id uuid)
 RETURNS TABLE (
   id uuid, titulo text, tipo_evento_id uuid, tipo_nombre text, color text,
   fecha_inicio date, fecha_fin date, es_recurrente boolean, activo boolean,
   afirmacion_actividades text[],
   total_personas bigint, total_rsil bigint, total_bautismo bigint, total_membresia bigint
 )
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_iglesia_id uuid;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM evento WHERE id = p_evento_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'EVENTO_INEXISTENTE: el evento no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_afirmacion(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al módulo de Afirmación en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT e.id, e.titulo::text, e.tipo_evento_id, te.nombre::text, te.color::text,
         e.fecha_inicio, e.fecha_fin,
         (te.codigo = 'REUNION') AS es_recurrente,
         (e.fecha_inicio <= CURRENT_DATE AND (e.fecha_fin IS NULL OR e.fecha_fin >= CURRENT_DATE)) AS activo,
         e.afirmacion_actividades,
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'RSIL' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'BAUTISMO' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'MEMBRESIA_NUEVOS' AND pp.fecha_eliminacion IS NULL)
  FROM evento e
  LEFT JOIN tipo_evento te ON te.id = e.tipo_evento_id
  WHERE e.id = p_evento_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_crear_evento(uuid, text, date, date, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_listar_eventos(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_evento_detalle(uuid) TO authenticated;
