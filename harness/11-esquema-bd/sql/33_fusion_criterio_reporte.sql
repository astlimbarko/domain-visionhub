-- VisionHub -- 33_fusion_criterio_reporte.sql
-- Cambia el criterio de "se puede deshacer" de la fusion (CdP y Red) de una
-- ventana fija de 7 dias a uno basado en actividad real: se puede deshacer
-- hasta el instante en que alguien sube el primer Reporte de CdP posterior
-- a la fusion. Ese reporte ya refleja la membresia fusionada (asistencia,
-- ofrendas), asi que deshacer despues corromperia el historial. La Red no
-- tiene reportes propios -- es la instancia superior -- asi que su fusion
-- se rige por lo mismo que rige a sus Casas de Paz ("el que manda es la
-- casa de paz"): se bloquea el deshacer de la fusion de Red en cuanto
-- CUALQUIER CdP que quedo bajo la red destino (incluidas las migradas)
-- sube un reporte posterior a la fusion.

CREATE OR REPLACE FUNCTION fn_fusion_cdp_bloqueada(p_origen_id UUID, p_destino_id UUID, p_desde TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_reporte r
    WHERE r.casa_de_paz_id IN (p_origen_id, p_destino_id)
      AND r.fecha_creacion > p_desde AND r.fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_fusion_red_bloqueada(p_origen_id UUID, p_destino_id UUID, p_desde TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_reporte r
    JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = r.casa_de_paz_id
      AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
    WHERE cdr.red_id IN (p_origen_id, p_destino_id)
      AND r.fecha_creacion > p_desde AND r.fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_deshacer_fusion_cdp(p_fusion_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fusion fusion_casa_de_paz%ROWTYPE;
  v_red_destino UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo para deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_fusion FROM fusion_casa_de_paz WHERE id = p_fusion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FUSION_NO_ENCONTRADA: no existe esa fusion' USING ERRCODE = 'P0001';
  END IF;
  IF v_fusion.deshecha_en IS NOT NULL THEN
    RAISE EXCEPTION 'FUSION_YA_DESHECHA: esta fusion ya fue deshecha' USING ERRCODE = 'P0001';
  END IF;
  IF fn_fusion_cdp_bloqueada(v_fusion.casa_de_paz_origen_id, v_fusion.casa_de_paz_destino_id, v_fusion.fecha_fusion) THEN
    RAISE EXCEPTION 'FUSION_VENTANA_VENCIDA: ya se subio un reporte despues de la fusion, no se puede deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_destino FROM casa_de_paz_red
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_destino_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_fusion.iglesia_id) OR (v_red_destino IS NOT NULL AND fn_es_lider_de_red(v_red_destino))) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: se requiere ser Lider de la Red destino, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  -- Orden importante: cerrar primero la membresia en destino, despues
  -- reabrir la de origen. Al reves, si la persona era principal en ambas
  -- filas (se copia es_principal al fusionar), por un instante quedarian
  -- dos filas vigentes principales de la misma persona a la vez y
  -- uq_membresia_principal_vigente lo rechaza (encontrado al probar).
  UPDATE casa_de_paz_membresia
  SET fecha_fin = v_fusion.fecha_fusion::date
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_destino_id
    AND fecha_inicio = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    AND persona_id IN (
      SELECT persona_id FROM casa_de_paz_membresia
      WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id AND fecha_fin = v_fusion.fecha_fusion::date
        AND fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_membresia
  SET fecha_fin = NULL
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz_cargo
  SET fecha_fin = NULL
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz SET activo = true WHERE id = v_fusion.casa_de_paz_origen_id;

  UPDATE fusion_casa_de_paz
  SET deshecha_en = now(), deshecha_motivo = p_motivo
  WHERE id = p_fusion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_deshacer_fusion_red(p_fusion_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fusion fusion_red%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo para deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_fusion FROM fusion_red WHERE id = p_fusion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FUSION_NO_ENCONTRADA: no existe esa fusion' USING ERRCODE = 'P0001';
  END IF;
  IF v_fusion.deshecha_en IS NOT NULL THEN
    RAISE EXCEPTION 'FUSION_YA_DESHECHA: esta fusion ya fue deshecha' USING ERRCODE = 'P0001';
  END IF;
  IF fn_fusion_red_bloqueada(v_fusion.red_origen_id, v_fusion.red_destino_id, v_fusion.fecha_fusion) THEN
    RAISE EXCEPTION 'FUSION_VENTANA_VENCIDA: alguna de sus Casas de Paz ya subio un reporte despues de la fusion, no se puede deshacer'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_operativo_en(v_fusion.iglesia_id) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden deshacer esta fusion'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  -- Volver las Casas de Paz movidas por ESTA fusion a la red de origen.
  UPDATE casa_de_paz_red
  SET fecha_fin = v_fusion.fecha_fusion::date
  WHERE red_id = v_fusion.red_destino_id
    AND fecha_inicio = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    AND casa_de_paz_id IN (
      SELECT casa_de_paz_id FROM casa_de_paz_red
      WHERE red_id = v_fusion.red_origen_id AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_red
  SET fecha_fin = NULL
  WHERE red_id = v_fusion.red_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE red_cargo
  SET fecha_fin = NULL
  WHERE red_id = v_fusion.red_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE red SET activo = true WHERE id = v_fusion.red_origen_id;

  UPDATE fusion_red
  SET deshecha_en = now(), deshecha_motivo = p_motivo
  WHERE id = p_fusion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_listar_fusiones_cdp(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, fecha_fusion TIMESTAMPTZ, motivo TEXT, deshecha_en TIMESTAMPTZ, deshecha_motivo TEXT,
  origen_id UUID, origen_etiqueta TEXT, destino_id UUID, destino_etiqueta TEXT,
  puede_deshacer BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    f.id, f.fecha_fusion, f.motivo, f.deshecha_en, f.deshecha_motivo,
    f.casa_de_paz_origen_id, fn_etiqueta_cdp(f.casa_de_paz_origen_id),
    f.casa_de_paz_destino_id, fn_etiqueta_cdp(f.casa_de_paz_destino_id),
    (f.deshecha_en IS NULL AND NOT fn_fusion_cdp_bloqueada(f.casa_de_paz_origen_id, f.casa_de_paz_destino_id, f.fecha_fusion))
  FROM fusion_casa_de_paz f
  WHERE f.iglesia_id = p_iglesia_id AND f.fecha_eliminacion IS NULL
  ORDER BY f.fecha_fusion DESC;
$$;

CREATE OR REPLACE FUNCTION fn_listar_fusiones_red(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, fecha_fusion TIMESTAMPTZ, motivo TEXT, deshecha_en TIMESTAMPTZ, deshecha_motivo TEXT,
  origen_id UUID, origen_nombre VARCHAR, destino_id UUID, destino_nombre VARCHAR,
  puede_deshacer BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    f.id, f.fecha_fusion, f.motivo, f.deshecha_en, f.deshecha_motivo,
    f.red_origen_id, ro.nombre, f.red_destino_id, rd.nombre,
    (f.deshecha_en IS NULL AND NOT fn_fusion_red_bloqueada(f.red_origen_id, f.red_destino_id, f.fecha_fusion))
  FROM fusion_red f
  JOIN red ro ON ro.id = f.red_origen_id
  JOIN red rd ON rd.id = f.red_destino_id
  WHERE f.iglesia_id = p_iglesia_id AND f.fecha_eliminacion IS NULL
  ORDER BY f.fecha_fusion DESC;
$$;

-- "el que manda es la casa de paz": el panel de la Red debe mostrar la CdP
-- fusionada como una sola. cantidad_cdp contaba toda casa_de_paz_red vigente
-- sin mirar si esa CdP sigue activa -- una CdP fusionada (activo=false) se
-- seguia contando en su Red de origen aunque quedo vacia.
CREATE OR REPLACE FUNCTION fn_listar_redes(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, nombre VARCHAR, activo BOOLEAN,
  lider_nombre TEXT, encargado_departamentos_nombre TEXT, encargado_ministerio_nombre TEXT,
  cantidad_cdp BIGINT, incompleta BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.id, r.nombre, r.activo,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'LIDER_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN red_cargo rc ON rc.persona_id = p.id
     JOIN cargo c ON c.id = rc.cargo_id
     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_MINISTERIO_RED'
       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL LIMIT 1),
    (SELECT count(*) FROM casa_de_paz_red cdr
     JOIN casa_de_paz c ON c.id = cdr.casa_de_paz_id
     WHERE cdr.red_id = r.id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL AND c.activo),
    COALESCE(fi.falta_departamentos OR fi.falta_ministerio, false)
  FROM red r
  LEFT JOIN fn_redes_incompletas(p_iglesia_id) fi ON fi.red_id = r.id
  WHERE r.iglesia_id = p_iglesia_id AND r.fecha_eliminacion IS NULL
  ORDER BY r.nombre;
$$;
