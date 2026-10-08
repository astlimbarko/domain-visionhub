-- Ajuste (2026-10-08): la vista de personas de un bloque debe poder cubrir
-- VARIOS procesos a la vez — el bloque "Bautismo + Membresía" agrupa BAUTISMO
-- y MEMBRESIA_NUEVOS. Se cambia el parámetro a text[] y se deduplica por
-- persona (una fila por persona, su registro más reciente dentro del bloque).

DROP FUNCTION IF EXISTS public.fn_afirmacion_evento_personas(uuid, text);

CREATE OR REPLACE FUNCTION public.fn_afirmacion_evento_personas(
  p_evento_id uuid, p_proceso_codigos text[]
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
  SELECT sub.registro_id, sub.persona_id, sub.nombre_completo, sub.fecha_nacimiento,
         sub.telefono, sub.fecha, sub.fecha_creacion, sub.invitado_por, sub.red_nombre, sub.lider_cdp
  FROM (
    SELECT DISTINCT ON (p.id)
           pp.id AS registro_id, p.id AS persona_id,
           fn_nombre_completo(p)::text AS nombre_completo,
           p.fecha_nacimiento,
           tel.numero::text AS telefono,
           pp.fecha, pp.fecha_creacion,
           COALESCE((SELECT fn_nombre_completo(ip) FROM persona ip WHERE ip.id = ll.invitado_por_id), ll.invitado_por_txt)::text AS invitado_por,
           r.nombre::text AS red_nombre,
           (SELECT fn_nombre_completo(lp)
              FROM casa_de_paz_cargo cc
              JOIN cargo cg ON cg.id = cc.cargo_id AND cg.codigo = 'LIDER_CDP'
              JOIN persona lp ON lp.id = cc.persona_id AND lp.fecha_eliminacion IS NULL
             WHERE cc.casa_de_paz_id = cdp.id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
             LIMIT 1)::text AS lider_cdp
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
    WHERE pp.evento_id = p_evento_id AND pp.proceso_codigo = ANY(p_proceso_codigos) AND pp.fecha_eliminacion IS NULL
    ORDER BY p.id, pp.fecha_creacion DESC
  ) sub
  ORDER BY sub.fecha_creacion ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_evento_personas(uuid, text[]) TO authenticated;
