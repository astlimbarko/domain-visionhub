-- VisionHub -- bug real (continuacion de 20260821120000): la causa real de
-- "relation \"red\" does not exist" al llamar fn_listar_redes era
-- fn_redes_incompletas -- sin SET search_path propio y con red/red_cargo/
-- cargo sin calificar. Al ser LANGUAGE sql, Postgres la inlinea dentro de
-- fn_listar_redes (SET search_path TO '' -- vacio), y esas referencias sin
-- calificar quedan sin resolver bajo ese search_path vacio heredado por el
-- inlining (confirmado reproduciendo el CONTEXT exacto del error: "SQL
-- function fn_redes_incompletas during inlining"). Se corrige calificando
-- todo con public., mismo patron que el resto de la cadena.
--
-- fn_es_lider_de_red (20260821120000) tambien se corrigio por el mismo
-- patron aunque no era la causa de este error puntual -- igual tenia el
-- mismo riesgo latente (search_path no vacio + sin calificar, inlineable
-- en el mismo tipo de cadena), se deja arreglada preventivamente.

CREATE OR REPLACE FUNCTION public.fn_redes_incompletas(p_iglesia_id uuid)
RETURNS TABLE(red_id uuid, red_nombre character varying, falta_departamentos boolean, falta_ministerio boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.id, r.nombre,
         NOT EXISTS (SELECT 1 FROM public.red_cargo rc JOIN public.cargo c ON c.id = rc.cargo_id
                     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
                       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL),
         NOT EXISTS (SELECT 1 FROM public.red_cargo rc JOIN public.cargo c ON c.id = rc.cargo_id
                     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_MINISTERIO_RED'
                       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL)
  FROM public.red r
  WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL;
$function$;
