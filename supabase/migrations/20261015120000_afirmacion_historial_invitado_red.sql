-- Registro de las puertas (Altar/Bautismo/RSIL): agregar "quién lo invitó" y
-- "red" a la lista (pedido del owner 2026-10-15). Se suman como subconsultas
-- escalares (no joins) para NO multiplicar filas: una fila por registro.
-- Cambia el tipo de retorno → DROP + CREATE.

DROP FUNCTION IF EXISTS public.fn_afirmacion_historial_proceso(uuid, proceso_afirmacion_codigo_enum, uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_afirmacion_historial_proceso(
  p_iglesia_id uuid,
  p_proceso_codigo proceso_afirmacion_codigo_enum,
  p_registrado_por uuid DEFAULT NULL,
  p_evento_id uuid DEFAULT NULL
)
 RETURNS TABLE(
   id uuid, persona_id uuid, nombre_completo text, fecha_nacimiento date,
   fecha date, fecha_creacion timestamp with time zone,
   registrado_por uuid, registrado_por_nombre text,
   invitado_por text, red_nombre text
 )
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT r.id, r.persona_id, fn_nombre_completo(p)::text, p.fecha_nacimiento,
         r.fecha, r.fecha_creacion,
         r.creado_por, coalesce(fn_nombre_completo(pr), split_part(au.email, '@', 1))::text,
         -- Quién lo invitó: de la llegada más reciente (persona real o texto libre).
         (SELECT COALESCE(fn_nombre_completo(ip), ll.invitado_por_txt)
            FROM persona_llegada ll
            LEFT JOIN persona ip ON ip.id = ll.invitado_por_id AND ip.fecha_eliminacion IS NULL
           WHERE ll.persona_id = p.id AND ll.fecha_eliminacion IS NULL
           ORDER BY ll.fecha_ingreso DESC NULLS LAST
           LIMIT 1)::text,
         -- Red de la Casa de Paz principal de la persona.
         (SELECT red.nombre
            FROM casa_de_paz_membresia cm
            JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
            JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
            JOIN red ON red.id = cdr.red_id
           WHERE cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
           LIMIT 1)::text
  FROM persona_proceso_afirmacion r
  JOIN persona p ON p.id = r.persona_id
  LEFT JOIN persona pr ON pr.usuario_id = r.creado_por AND pr.fecha_eliminacion IS NULL
  LEFT JOIN auth.users au ON au.id = r.creado_por
  WHERE r.iglesia_id = p_iglesia_id AND r.proceso_codigo = p_proceso_codigo AND r.fecha_eliminacion IS NULL
    AND (p_registrado_por IS NULL OR r.creado_por = p_registrado_por)
    AND (p_evento_id IS NULL OR r.evento_id = p_evento_id)
  ORDER BY r.fecha_creacion DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_historial_proceso(uuid, proceso_afirmacion_codigo_enum, uuid, uuid) TO authenticated;
