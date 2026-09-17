-- VisionHub -- KAN-391 (2026-09-17, pedido explícito del owner): resolver el
-- nombre de la CdP principal de un lote de personas, para el buscador
-- unificado de asistencia -- necesita SECURITY DEFINER porque la RLS de
-- `casa_de_paz` (pol_casa_de_paz_select, fn_puede_ver_cdp) bloquea al Líder/
-- Sublíder de CdP leer el nombre de una CdP que no es la suya, aunque la
-- persona sí sea visible (misma iglesia). Solo expone `id` + `nombre` de la
-- CdP -- nada sensible (finanzas, membresía, estructura). El gate de
-- "mostrar u ocultar" (criterio REPORTE_MOSTRAR_ORIGEN_ASISTENTE, Líder de
-- Red/Supervisor siempre ven) ya vive en el frontend (Reportes.tsx) -- acá
-- solo se resuelve el dato, no se decide si mostrarlo.
-- fn_etiqueta_cdp (no la columna casa_de_paz.nombre, casi siempre vacía en
-- la práctica) es la etiqueta real que usa el resto del proyecto: nombre
-- manual si existe, si no el nombre del líder (+ zona si tiene más de una
-- CdP), si no "Casa de Paz sin líder".
CREATE OR REPLACE FUNCTION public.fn_origen_cdp_personas(p_persona_ids uuid[])
RETURNS TABLE(persona_id uuid, casa_de_paz_id uuid, casa_de_paz_nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT cm.persona_id, cm.casa_de_paz_id, fn_etiqueta_cdp(cm.casa_de_paz_id)
  FROM casa_de_paz_membresia cm
  JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
  JOIN persona p ON p.id = cm.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())
  WHERE cm.persona_id = ANY(p_persona_ids)
    AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_origen_cdp_personas(uuid[]) TO authenticated;
