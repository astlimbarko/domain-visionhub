-- Fix (2026-10-07): en el panel del Constructor, el horario de reunión de la CdP
-- NO se mostraba (siempre "Horario pendiente") aunque estuviera guardado. Causa:
-- el panel leía el día/hora con fn_mi_cdp_perfil, que exige tener un cargo
-- vigente EN esa CdP (RAISE 'PERFIL_FUERA_DE_ALCANCE'). Un Super Admin / Pastor /
-- Supervisor que navega el organigrama NO es miembro de cada CdP -> la función
-- fallaba y el horario nunca se leía (el guardado sí persistía bien).
--
-- fn_cdp_horario_actual: devuelve el día/hora vigente de la CdP con el MISMO
-- criterio de permiso que fn_cdp_actualizar_horario (quien puede editar el
-- horario desde el constructor puede leerlo). Es solo lectura.

CREATE OR REPLACE FUNCTION public.fn_cdp_horario_actual(p_cdp_id uuid)
 RETURNS TABLE (dia_reunion smallint, hora_reunion time without time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id uuid;
  v_red_id uuid;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_cdp_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: la casa de paz no existe' USING ERRCODE = 'P0001';
  END IF;
  SELECT cdr.red_id INTO v_red_id FROM casa_de_paz_red cdr
  WHERE cdr.casa_de_paz_id = p_cdp_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL;
  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)
          OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id)) OR fn_es_lider_cdp(p_cdp_id)) THEN
    RAISE EXCEPTION 'HORARIO_SIN_PERMISO: no tiene permiso para ver el horario' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT c.dia_reunion, c.hora_reunion FROM casa_de_paz c WHERE c.id = p_cdp_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_cdp_horario_actual(uuid) TO authenticated;
