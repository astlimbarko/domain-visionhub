-- VisionHub -- fn_evangelismo_testimonios_red.sql
-- Pedido del owner (2026-09-11): pestaña "Testimonios Elite" tambien en
-- EvangelismoRed.tsx (Lider de Red / Supervisor de Red, mismo componente),
-- agrupada por Casa de Paz. evangelismo_testimonio no tiene red_id directo
-- -- mismo criterio de join que ya usa fn_evangelismo_red (casa_de_paz_red,
-- fecha_fin/fecha_eliminacion null) y mismo chequeo de permiso.

CREATE OR REPLACE FUNCTION public.fn_evangelismo_testimonios_red(p_red_id uuid)
RETURNS TABLE(
  id uuid,
  casa_de_paz_id uuid,
  casa_de_paz_etiqueta text,
  persona_id uuid,
  nombre_completo text,
  texto text,
  fecha_creacion timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_iglesia_id uuid;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR fn_es_lider_evangelismo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT et.id, et.casa_de_paz_id, fn_etiqueta_cdp(et.casa_de_paz_id), ev.persona_id, fn_nombre_completo(p),
         et.texto, et.fecha_creacion
  FROM evangelismo_testimonio et
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = et.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  JOIN evangelismo ev ON ev.id = et.evangelismo_id
  JOIN persona p ON p.id = ev.persona_id
  WHERE cdr.red_id = p_red_id
    AND et.fecha_eliminacion IS NULL
  ORDER BY et.fecha_creacion DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_evangelismo_testimonios_red(uuid) TO authenticated;
