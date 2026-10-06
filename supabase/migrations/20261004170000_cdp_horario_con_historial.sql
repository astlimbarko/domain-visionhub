-- Constructor (2026-10-04): editar el HORARIO de reunión de una Casa de Paz
-- desde el panel de detalle del organigrama, con HISTORIAL de cambios (quién y
-- cuándo). Antes el horario se guardaba con un UPDATE directo a
-- casa_de_paz.dia_reunion/hora_reunion (sin registro de cambios).
--
-- - Tabla nueva casa_de_paz_horario_historial: una fila por cambio aplicado.
-- - fn_cdp_actualizar_horario: valida permiso (mismo criterio que
--   fn_asignar_cargo_cdp del constructor: super admin / operativo / pastor /
--   líder de la Red de la CdP, o líder de la propia CdP), actualiza las
--   columnas de la CdP y registra la fila de historial.
-- - fn_cdp_historial_horario: devuelve el historial (más nuevo primero) con el
--   nombre legible de quién lo cambió.
-- Convención de día: 0=domingo … 6=sábado (getDay() de JS, ya usado en el front).

CREATE TABLE IF NOT EXISTS public.casa_de_paz_horario_historial (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_de_paz_id uuid NOT NULL REFERENCES public.casa_de_paz(id),
  iglesia_id    uuid NOT NULL REFERENCES public.iglesia(id),
  dia_reunion   smallint,
  hora_reunion  time without time zone,
  fecha_cambio  timestamptz NOT NULL DEFAULT now(),
  cambiado_por  uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_cdp_horario_hist_cdp
  ON public.casa_de_paz_horario_historial (casa_de_paz_id, fecha_cambio DESC);

ALTER TABLE public.casa_de_paz_horario_historial ENABLE ROW LEVEL SECURITY;
-- Sin policies: se lee/escribe solo por las RPCs SECURITY DEFINER de abajo
-- (mismo criterio que persona_proceso_afirmacion).

-- ── Actualizar horario + registrar historial ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_cdp_actualizar_horario(
  p_cdp_id uuid, p_dia smallint, p_hora time without time zone
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
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

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  -- Mismo criterio que fn_asignar_cargo_cdp (constructor), más el líder de la
  -- propia CdP (que también gestiona su horario desde su panel).
  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)
          OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id)) OR fn_es_lider_cdp(p_cdp_id)) THEN
    RAISE EXCEPTION 'HORARIO_SIN_PERMISO: se requiere ser Líder de la CdP o de su Red, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_dia IS NOT NULL AND (p_dia < 0 OR p_dia > 6) THEN
    RAISE EXCEPTION 'HORARIO_DIA_INVALIDO: el día debe estar entre 0 (domingo) y 6 (sábado)' USING ERRCODE = 'P0001';
  END IF;

  UPDATE casa_de_paz SET dia_reunion = p_dia, hora_reunion = p_hora WHERE id = p_cdp_id;

  INSERT INTO casa_de_paz_horario_historial (casa_de_paz_id, iglesia_id, dia_reunion, hora_reunion, cambiado_por)
  VALUES (p_cdp_id, v_iglesia_id, p_dia, p_hora, auth.uid());
END;
$function$;

-- ── Historial del horario (más nuevo primero) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_cdp_historial_horario(p_cdp_id uuid)
 RETURNS TABLE (
   dia_reunion smallint,
   hora_reunion time without time zone,
   cambiado_por_nombre text,
   fecha_cambio timestamptz
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
  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)
          OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id)) OR fn_es_lider_cdp(p_cdp_id)) THEN
    RAISE EXCEPTION 'HORARIO_SIN_PERMISO: no tiene permiso para ver el historial' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT h.dia_reunion, h.hora_reunion,
         coalesce(fn_nombre_completo(p), split_part(au.email, '@', 1)) AS cambiado_por_nombre,
         h.fecha_cambio
  FROM casa_de_paz_horario_historial h
  LEFT JOIN persona p ON p.usuario_id = h.cambiado_por AND p.fecha_eliminacion IS NULL
  LEFT JOIN auth.users au ON au.id = h.cambiado_por
  WHERE h.casa_de_paz_id = p_cdp_id
  ORDER BY h.fecha_cambio DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_cdp_actualizar_horario(uuid, smallint, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cdp_historial_horario(uuid) TO authenticated;
