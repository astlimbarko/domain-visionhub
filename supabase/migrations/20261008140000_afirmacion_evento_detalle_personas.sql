-- Detalle de evento de Afirmación (2026-10-08): vista por bloque con la gente
-- del evento (datos principales para la vista rápida + export PDF/XLS), lista
-- de colaboradores que cargaron gente, y edición del evento.

-- ── Colaboradores del evento: quiénes (distintos) cargaron gente en él ───────
-- "registrado por" (creado_por) de los registros del evento → su nombre + red.
CREATE OR REPLACE FUNCTION public.fn_afirmacion_evento_colaboradores(p_evento_id uuid)
 RETURNS TABLE (persona_id uuid, nombre_completo text, red_nombre text, cantidad bigint)
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
  WITH cargas AS (
    SELECT pp.creado_por AS usuario_id, count(*) AS cant
    FROM persona_proceso_afirmacion pp
    WHERE pp.evento_id = p_evento_id AND pp.fecha_eliminacion IS NULL AND pp.creado_por IS NOT NULL
    GROUP BY pp.creado_por
  )
  SELECT per.id,
         fn_nombre_completo(per)::text,
         r.nombre::text,
         c.cant
  FROM cargas c
  JOIN persona per ON per.usuario_id = c.usuario_id AND per.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = per.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  ORDER BY c.cant DESC, fn_nombre_completo(per);
END;
$function$;

-- ── Personas de un bloque (proceso) dentro del evento ────────────────────────
-- Datos principales para la vista rápida + export: fecha/hora de registro,
-- nombre, edad, teléfono, quién lo invitó, red, líder de CdP.
CREATE OR REPLACE FUNCTION public.fn_afirmacion_evento_personas(
  p_evento_id uuid, p_proceso_codigo text
)
 RETURNS TABLE (
   registro_id uuid, persona_id uuid, nombre_completo text,
   fecha_nacimiento date, telefono text,
   fecha date, fecha_creacion timestamptz,
   invitado_por text, red_nombre text, lider_cdp text
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
  SELECT pp.id, p.id,
         fn_nombre_completo(p)::text,
         p.fecha_nacimiento,
         tel.numero::text,
         pp.fecha, pp.fecha_creacion,
         COALESCE((SELECT fn_nombre_completo(ip) FROM persona ip WHERE ip.id = ll.invitado_por_id), ll.invitado_por_txt)::text,
         r.nombre::text,
         (SELECT fn_nombre_completo(lp)
            FROM casa_de_paz_cargo cc
            JOIN cargo cg ON cg.id = cc.cargo_id AND cg.codigo = 'LIDER_CDP'
            JOIN persona lp ON lp.id = cc.persona_id AND lp.fecha_eliminacion IS NULL
           WHERE cc.casa_de_paz_id = cdp.id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
           LIMIT 1)::text
  FROM persona_proceso_afirmacion pp
  JOIN persona p ON p.id = pp.persona_id AND p.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  LEFT JOIN LATERAL (
    SELECT pl.invitado_por_id, pl.invitado_por_txt
    FROM persona_llegada pl
    WHERE pl.persona_id = p.id AND pl.fecha_eliminacion IS NULL
    ORDER BY pl.fecha_ingreso DESC NULLS LAST
    LIMIT 1
  ) ll ON true
  WHERE pp.evento_id = p_evento_id AND pp.proceso_codigo = p_proceso_codigo AND pp.fecha_eliminacion IS NULL
  ORDER BY pp.fecha_creacion ASC;
END;
$function$;

-- ── Editar un evento (lápiz) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_afirmacion_editar_evento(
  p_evento_id uuid, p_titulo text, p_fecha_inicio date, p_fecha_fin date,
  p_descripcion text, p_actividades text[]
)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    RAISE EXCEPTION 'EVENTO_SIN_ACTIVIDADES: marcá al menos una actividad' USING ERRCODE = 'P0001';
  END IF;

  UPDATE evento
     SET titulo = btrim(p_titulo),
         descripcion = NULLIF(btrim(p_descripcion),''),
         fecha_inicio = p_fecha_inicio,
         fecha_fin = p_fecha_fin,
         afirmacion_actividades = p_actividades,
         fecha_actualizacion = now(),
         actualizado_por = auth.uid()
   WHERE id = p_evento_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_evento_colaboradores(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_evento_personas(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_afirmacion_editar_evento(uuid, text, date, date, text, text[]) TO authenticated;
