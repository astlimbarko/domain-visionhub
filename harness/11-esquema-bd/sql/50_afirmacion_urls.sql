-- VisionHub -- 50_afirmacion_urls.sql
-- 14-afirmacion. Administracion de casa_paz_url (Requisito 5): el Lider de
-- Afirmacion administra SOLO URLs de lideres de CdP vigentes. No se edita
-- la policy UPDATE existente de casa_paz_url (19_registro_publico.sql:239,
-- fn_es_operativo_en) -- se agrega una policy adicional. En Postgres las
-- policies permisivas se combinan con OR, asi que Supervisor y Lider de
-- Afirmacion pueden actualizar, sin tocar el comportamiento ya probado.

CREATE POLICY pol_casa_paz_url_update_afirmacion ON casa_paz_url
  FOR UPDATE TO authenticated
  USING (fn_es_lider_afirmacion_en(iglesia_id))
  WITH CHECK (fn_es_lider_afirmacion_en(iglesia_id));

-- ============================================================
-- Listado con jerarquia Lider de Red -> Red -> CdP -> Lider de CdP -> URL.
-- Solo URLs de lideres de CdP VIGENTES (Requisito 5, "no administrar URLs de
-- lideres de Red, sublideres ni miembros comunes").
-- ============================================================
CREATE OR REPLACE FUNCTION fn_listar_casa_paz_url_afirmacion(p_iglesia_id UUID)
RETURNS TABLE (
  url_id        UUID,
  slug          VARCHAR,
  estado        estado_url_enum,
  lider_cdp_nombre    TEXT,
  casa_de_paz_id      UUID,
  casa_de_paz_etiqueta TEXT,
  red_id        UUID,
  red_nombre    VARCHAR,
  lider_red_nombre TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    cpu.id, cpu.slug, cpu.estado,
    fn_nombre_completo(pl), cpu.casa_de_paz_id, fn_etiqueta_cdp(cpu.casa_de_paz_id),
    r.id, r.nombre,
    (SELECT fn_nombre_completo(prl)
     FROM red_cargo rcl JOIN cargo cl ON cl.id = rcl.cargo_id JOIN persona prl ON prl.id = rcl.persona_id
     WHERE rcl.red_id = r.id AND cl.codigo = 'LIDER_RED'
       AND rcl.fecha_fin IS NULL AND rcl.fecha_eliminacion IS NULL
     LIMIT 1)
  FROM casa_paz_url cpu
  JOIN casa_de_paz_cargo cc ON cc.id = cpu.casa_de_paz_cargo_id
  JOIN cargo cc_cargo ON cc_cargo.id = cc.cargo_id
  JOIN casa_de_paz cdp ON cdp.id = cpu.casa_de_paz_id
  JOIN persona pl ON pl.id = cpu.persona_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cpu.casa_de_paz_id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cpu.iglesia_id = p_iglesia_id
    AND cpu.fecha_eliminacion IS NULL
    AND cc_cargo.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    AND cdp.activo AND cdp.fecha_eliminacion IS NULL
  ORDER BY r.nombre NULLS LAST, fn_nombre_completo(pl.*);
END;
$$;

-- ============================================================
-- Accion masiva idempotente, con resultados parciales. Cada id se valida
-- por separado (multi-tenancy: ids de otra iglesia se omiten, no abortan
-- el resto).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_estado_casa_paz_url(p_ids UUID[], p_estado estado_url_enum)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_url casa_paz_url;
  v_es_lider_cdp_vigente BOOLEAN;
  v_actualizadas INT := 0;
  v_omitidas JSONB := '[]'::jsonb;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT * INTO v_url FROM casa_paz_url WHERE id = v_id AND fecha_eliminacion IS NULL;

    IF NOT FOUND THEN
      v_omitidas := v_omitidas || jsonb_build_object('id', v_id, 'motivo', 'NO_ENCONTRADA');
      CONTINUE;
    END IF;

    IF NOT fn_es_lider_afirmacion_en(v_url.iglesia_id) THEN
      v_omitidas := v_omitidas || jsonb_build_object('id', v_id, 'motivo', 'SIN_PERMISO');
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
      JOIN casa_de_paz cdp ON cdp.id = cc.casa_de_paz_id
      WHERE cc.id = v_url.casa_de_paz_cargo_id AND c.codigo = 'LIDER_CDP'
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        AND cdp.activo AND cdp.fecha_eliminacion IS NULL
    ) INTO v_es_lider_cdp_vigente;

    IF NOT v_es_lider_cdp_vigente THEN
      v_omitidas := v_omitidas || jsonb_build_object('id', v_id, 'motivo', 'LIDER_CDP_NO_VIGENTE');
      CONTINUE;
    END IF;

    IF v_url.estado = p_estado THEN
      CONTINUE; -- idempotente: ya esta en el estado pedido, no cuenta como error ni se reescribe
    END IF;

    UPDATE casa_paz_url SET estado = p_estado WHERE id = v_id;
    v_actualizadas := v_actualizadas + 1;
  END LOOP;

  RETURN jsonb_build_object('actualizadas', v_actualizadas, 'omitidas', v_omitidas);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_listar_casa_paz_url_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_set_estado_casa_paz_url(UUID[], estado_url_enum) TO authenticated;
