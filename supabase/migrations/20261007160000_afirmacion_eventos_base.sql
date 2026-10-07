-- Panel de Eventos de Afirmación (2026-10-07): agrupar los registros de los
-- procesos (Altar/Bautismo/RSIL/Membresía) por EVENTO (ej. "Bautismo Global"),
-- para poder ver/filtrar por evento en vez del acumulado histórico. Reusa la
-- tabla `evento` + `tipo_evento` ya existentes.
--
-- - evento.es_afirmacion: marca los eventos creados por el Dpto. de Afirmación
--   (la tabla `evento` es compartida con Megafiesta de CdP, etc.).
-- - persona_proceso_afirmacion.evento_id: a qué evento pertenece cada registro
--   (nullable: los registros viejos quedan sin evento).

ALTER TABLE public.evento
  ADD COLUMN IF NOT EXISTS es_afirmacion boolean NOT NULL DEFAULT false;

ALTER TABLE public.persona_proceso_afirmacion
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.evento(id);

CREATE INDEX IF NOT EXISTS idx_ppa_evento ON public.persona_proceso_afirmacion (evento_id)
  WHERE evento_id IS NOT NULL;

-- ── Catálogo de tipos de evento (para el combo al crear) ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_afirmacion_tipos_evento()
 RETURNS TABLE (id uuid, nombre text, codigo text, color text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT te.id, te.nombre::text, te.codigo::text, te.color::text
  FROM tipo_evento te
  WHERE te.activo AND te.fecha_eliminacion IS NULL
  ORDER BY te.orden, te.nombre;
$function$;

-- ── Crear un evento de Afirmación ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_afirmacion_crear_evento(
  p_iglesia_id uuid, p_titulo text, p_tipo_evento_id uuid,
  p_fecha_inicio date, p_fecha_fin date, p_descripcion text
)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
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

  INSERT INTO evento (iglesia_id, tipo_evento_id, titulo, descripcion, fecha_inicio, fecha_fin, es_afirmacion, creado_por)
  VALUES (p_iglesia_id, p_tipo_evento_id, btrim(p_titulo), NULLIF(btrim(p_descripcion),''),
          p_fecha_inicio, p_fecha_fin, true, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ── Listar eventos de Afirmación de la iglesia (con estadísticas) ────────────
CREATE OR REPLACE FUNCTION public.fn_afirmacion_listar_eventos(
  p_iglesia_id uuid, p_solo_activos boolean DEFAULT false
)
 RETURNS TABLE (
   id uuid, titulo text, tipo_evento_id uuid, tipo_nombre text, color text,
   fecha_inicio date, fecha_fin date, es_recurrente boolean, activo boolean,
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
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'RSIL' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'BAUTISMO' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'MEMBRESIA_NUEVOS' AND pp.fecha_eliminacion IS NULL)
  FROM evento e
  LEFT JOIN tipo_evento te ON te.id = e.tipo_evento_id
  WHERE e.iglesia_id = p_iglesia_id AND e.es_afirmacion AND e.fecha_eliminacion IS NULL
    AND (NOT p_solo_activos OR (e.fecha_inicio <= CURRENT_DATE AND (e.fecha_fin IS NULL OR e.fecha_fin >= CURRENT_DATE)))
  ORDER BY e.fecha_inicio DESC, e.fecha_creacion DESC;
END;
$function$;

-- ── Detalle de un evento (misma forma, una fila) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_afirmacion_evento_detalle(p_evento_id uuid)
 RETURNS TABLE (
   id uuid, titulo text, tipo_evento_id uuid, tipo_nombre text, color text,
   fecha_inicio date, fecha_fin date, es_recurrente boolean, activo boolean,
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
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'RSIL' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'BAUTISMO' AND pp.fecha_eliminacion IS NULL),
         (SELECT count(DISTINCT pp.persona_id) FROM persona_proceso_afirmacion pp WHERE pp.evento_id = e.id AND pp.proceso_codigo = 'MEMBRESIA_NUEVOS' AND pp.fecha_eliminacion IS NULL)
  FROM evento e
  LEFT JOIN tipo_evento te ON te.id = e.tipo_evento_id
  WHERE e.id = p_evento_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_tipos_evento() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_crear_evento(uuid, text, uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_listar_eventos(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_evento_detalle(uuid) TO authenticated;
