-- VisionHub -- KAN-388, pedido del owner (2026-09-17): sin límite, la
-- tabla `avance` va a seguir creciendo cada semana y /avances terminaría
-- trayendo todo el historial completo sin ninguna necesidad real (es un
-- changelog para líderes/Pastores, no un archivo histórico). Límite
-- simple a las 50 entradas más recientes visibles para cada usuario, sin
-- paginación (decisión explícita del owner: no hace falta bucear en
-- avances muy viejos).
CREATE OR REPLACE FUNCTION public.fn_avances_visibles()
 RETURNS TABLE(id uuid, tipo avance_tipo_enum, area character varying, titulo character varying, descripcion text, alcance_codigo character varying, alcance_nombre character varying, fecha_publicacion timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_super_admin boolean := fn_es_super_admin();
  v_tiene_cdp boolean;
  v_tiene_red boolean;
  v_tiene_supervision boolean;
  v_tiene_evangelismo boolean := false;
  v_tiene_afirmacion boolean := false;
  v_iglesia_id uuid;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol IN ('LIDER_CDP','SUBLIDER_CDP')
      AND fecha_eliminacion IS NULL
  ) INTO v_tiene_cdp;

  SELECT EXISTS(
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol = 'LIDER_RED'
      AND fecha_eliminacion IS NULL
  ) INTO v_tiene_red;

  SELECT EXISTS(
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol IN ('SUPERVISOR_VISION_ACCION','PASTOR')
      AND fecha_eliminacion IS NULL
  ) INTO v_tiene_supervision;

  IF NOT v_super_admin AND NOT v_tiene_supervision THEN
    FOR v_iglesia_id IN SELECT * FROM fn_mis_iglesias() LOOP
      IF fn_es_lider_departamento(v_iglesia_id, 'EVANGELISMO') THEN v_tiene_evangelismo := true; END IF;
      IF fn_es_lider_departamento(v_iglesia_id, 'AFIRMACION') THEN v_tiene_afirmacion := true; END IF;
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT a.id, a.tipo, a.area, a.titulo, a.descripcion, a.alcance_codigo, ad.nombre, a.fecha_publicacion
  FROM avance a
  JOIN avance_alcance_definicion ad ON ad.codigo = a.alcance_codigo
  WHERE a.fecha_eliminacion IS NULL
    AND (
      v_super_admin
      OR a.alcance_codigo = 'GLOBAL'
      OR (a.alcance_codigo = 'CDP' AND (v_tiene_cdp OR v_tiene_red OR v_tiene_supervision))
      OR (a.alcance_codigo = 'RED' AND (v_tiene_red OR v_tiene_supervision))
      OR (a.alcance_codigo = 'SUPERVISION' AND v_tiene_supervision)
      OR (a.alcance_codigo = 'EVANGELISMO' AND (v_tiene_evangelismo OR v_tiene_supervision))
      OR (a.alcance_codigo = 'AFIRMACION' AND (v_tiene_afirmacion OR v_tiene_supervision))
    )
  ORDER BY a.fecha_publicacion DESC
  LIMIT 50;
END;
$function$;
