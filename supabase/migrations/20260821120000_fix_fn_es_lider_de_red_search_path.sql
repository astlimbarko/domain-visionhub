-- VisionHub -- bug real encontrado al probar en vivo FichaPersonaSheet
-- desde el panel de Afirmacion: fn_listar_redes fallaba con
-- 'relation "red" does not exist' (42P01).
--
-- Causa: fn_es_lider_de_red (LANGUAGE sql) usa SET search_path TO 'public'
-- (no vacio) con nombres de tabla sin calificar (red_cargo, cargo). Cuando
-- el planner de Postgres la inlinea dentro de fn_puede_ver_red y esta a su
-- vez dentro de fn_listar_redes (ambas con SET search_path TO '' -- vacio,
-- todo calificado con public.), las referencias sin calificar de
-- fn_es_lider_de_red quedan sin resolver bajo ese search_path vacio
-- heredado por el inlining. Se corrige calificando todo con public.,
-- mismo patron que ya usan las demas funciones de esta cadena.

CREATE OR REPLACE FUNCTION public.fn_es_lider_de_red(p_red_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.red_cargo rc JOIN public.cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = p_red_id AND rc.persona_id = public.fn_mi_persona_id()
      AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED') AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  );
$function$;
