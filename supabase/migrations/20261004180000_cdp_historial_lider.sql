-- Constructor (2026-10-04): historial de cambios de LÍDER de una Casa de Paz.
-- El dato ya se guarda en casa_de_paz_cargo (una fila por designación, con
-- fecha_inicio / fecha_fin y creado_por) -- esta función solo lo expone para
-- mostrarlo en el panel del organigrama, igual que el historial del horario.
-- Devuelve cada persona que fue líder de la CdP, más nuevo primero, con quién
-- la designó. Mismo criterio de permiso que fn_cdp_actualizar_horario.

CREATE OR REPLACE FUNCTION public.fn_cdp_historial_lider(p_cdp_id uuid)
 RETURNS TABLE (
   persona_nombre text,
   designado_por_nombre text,
   fecha_inicio date,
   fecha_fin date,
   vigente boolean
 )
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
    RAISE EXCEPTION 'HISTORIAL_SIN_PERMISO: no tiene permiso para ver el historial' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(fn_nombre_completo(p), 'Sin nombre') AS persona_nombre,
    coalesce(fn_nombre_completo(pc), split_part(au.email, '@', 1)) AS designado_por_nombre,
    cc.fecha_inicio,
    cc.fecha_fin,
    (cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL) AS vigente
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id AND c.codigo = 'LIDER_CDP'
  JOIN persona p ON p.id = cc.persona_id
  LEFT JOIN persona pc ON pc.usuario_id = cc.creado_por AND pc.fecha_eliminacion IS NULL
  LEFT JOIN auth.users au ON au.id = cc.creado_por
  WHERE cc.casa_de_paz_id = p_cdp_id
    -- Solo tenencias REALES: la vigente, o una que duró más de un día. Se
    -- excluyen las cerradas el mismo día que empezaron (fecha_fin = fecha_inicio)
    -- y las soft-eliminadas: son ruido del armado inicial (una persona asignada
    -- y reemplazada en el acto, que nunca lideró de verdad -- ej. filas de seed
    -- duplicadas del 2026-08-22). El owner confirmó que no hubo cambios reales
    -- de líder desde que nació el sistema.
    AND cc.fecha_eliminacion IS NULL
    AND (cc.fecha_fin IS NULL OR cc.fecha_fin > cc.fecha_inicio)
  ORDER BY cc.fecha_inicio DESC, cc.fecha_creacion DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_cdp_historial_lider(uuid) TO authenticated;
