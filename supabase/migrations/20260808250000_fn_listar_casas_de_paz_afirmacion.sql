-- VisionHub -- KAN-127: Afirmación debe ver todas las Casas de Paz de su iglesia.
--
-- fn_listar_lideres_cdp_afirmacion (49_afirmacion_registro.sql) y
-- fn_listar_casa_paz_url_afirmacion (50_afirmacion_urls.sql) -- las dos únicas
-- funciones por las que Afirmación "ve" Casas de Paz hoy -- solo devuelven CdP
-- con un cargo LIDER_CDP vigente, porque ese es su caso de uso puntual (elegir
-- líder para el alta interna / administrar la URL de ese líder). Efecto
-- colateral no buscado: una CdP sin líder vigente (vacante) nunca aparece en
-- ninguna pantalla de Afirmación, contradiciendo S-1 de
-- harness/14-afirmacion/open-questions.md ("el alcance del Líder de
-- Afirmación es toda su iglesia, todas las CdP, no un subconjunto").
--
-- Este RPC es nuevo y de solo lectura -- no reemplaza a los dos anteriores
-- (siguen acotados a su caso de uso). Devuelve TODAS las Casas de Paz activas
-- de la iglesia, con o sin líder vigente, con su Red (si tiene) para que el
-- frontend agrupe igual que el panel de URLs. Mismo guard de permiso
-- (fn_es_lider_afirmacion_en OR fn_es_operativo_en) y mismo aislamiento por
-- iglesia (p_iglesia_id, nunca confía en el cliente) que el resto del módulo.

CREATE OR REPLACE FUNCTION fn_listar_casas_de_paz_afirmacion(p_iglesia_id UUID)
RETURNS TABLE (
  casa_de_paz_id       UUID,
  casa_de_paz_etiqueta TEXT,
  activo               BOOLEAN,
  red_id               UUID,
  red_nombre           VARCHAR,
  lider_red_nombre     TEXT,
  lider_cdp_nombre     TEXT,
  tiene_lider_vigente  BOOLEAN
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
    cdp.id,
    fn_etiqueta_cdp(cdp.id),
    cdp.activo,
    r.id,
    r.nombre,
    (SELECT fn_nombre_completo(prl)
     FROM red_cargo rcl JOIN cargo cl ON cl.id = rcl.cargo_id JOIN persona prl ON prl.id = rcl.persona_id
     WHERE rcl.red_id = r.id AND cl.codigo = 'LIDER_RED'
       AND rcl.fecha_fin IS NULL AND rcl.fecha_eliminacion IS NULL
     LIMIT 1),
    (SELECT fn_nombre_completo(pcdp)
     FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id JOIN persona pcdp ON pcdp.id = ccl.persona_id
     WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
       AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
     LIMIT 1),
    EXISTS (
      SELECT 1 FROM casa_de_paz_cargo ccl JOIN cargo ccg ON ccg.id = ccl.cargo_id
      WHERE ccl.casa_de_paz_id = cdp.id AND ccg.codigo = 'LIDER_CDP'
        AND ccl.fecha_fin IS NULL AND ccl.fecha_eliminacion IS NULL
    )
  FROM casa_de_paz cdp
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE cdp.iglesia_id = p_iglesia_id
    AND cdp.fecha_eliminacion IS NULL
  ORDER BY r.nombre NULLS LAST, fn_etiqueta_cdp(cdp.id);
END;
$$;

-- Mismo hallazgo de 52_revocar_execute_publico_afirmacion.sql: Postgres
-- otorga EXECUTE a PUBLIC por defecto en toda función nueva, y anon hereda de
-- PUBLIC. Se revoca de forma quirúrgica y se re-otorga explícitamente solo a
-- authenticated, igual que el resto de las funciones de Afirmación.
REVOKE EXECUTE ON FUNCTION fn_listar_casas_de_paz_afirmacion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_listar_casas_de_paz_afirmacion(UUID) TO authenticated;
