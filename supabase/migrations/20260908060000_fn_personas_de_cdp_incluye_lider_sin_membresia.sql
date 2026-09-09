-- VisionHub -- Bug real encontrado (2026-09-08, pedido del owner): "ni
-- siquiera el ministerio de la persona de Líder sale" -- el fix anterior
-- (20260908050000) solo cubría el cargo SUBLIDER_CDP con la 3ra rama del
-- roster, pero el MISMO problema estructural existe para LIDER_CDP.
--
-- Confirmado contra producción: de los 58 cargos LIDER_CDP vigentes, TODOS
-- (100%) NO tienen membresía formal (casa_de_paz_membresia) NI asistencia
-- registrada en su propia CdP -- el Líder se asigna vía cargo, nunca se
-- registra como "miembro" de la casa que lidera. De esos 58, 35 tienen
-- ministerios reales asignados que nunca se veían en el dashboard/roster.
--
-- Fix: la 3ra rama pasa a cubrir cargo SUBLIDER_CDP **o** LIDER_CDP vigente
-- (antes solo SUBLIDER_CDP). `es_sublider` se sigue calculando específico
-- para SUBLIDER_CDP (un Líder no es Sublíder), igual que en las otras 2
-- ramas -- no se hardcodea `true`.

CREATE OR REPLACE FUNCTION fn_personas_de_cdp(p_casa_de_paz_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM casa_de_paz WHERE id = p_casa_de_paz_id AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'CDP_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (
    fn_es_lider_cdp(p_casa_de_paz_id)
    OR fn_es_sublider_cdp(p_casa_de_paz_id)
    OR fn_es_rol_superior_de_cdp(p_casa_de_paz_id)
  ) THEN
    RAISE EXCEPTION 'CDP_FUERA_DE_ALCANCE: no administras esta Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(fila ORDER BY orden), '[]'::jsonb)
  INTO v_resultado
  FROM (
    -- Miembros reales (membresía formal, gateada por bautismo).
    SELECT
      fn_nombre_completo(p) AS orden,
      jsonb_build_object(
        'persona_id', p.id,
        'nombre_completo', fn_nombre_completo(p),
        'sexo', p.sexo,
        'edad', CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
                     ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
        'ci', p.ci,
        'telefono_principal', tel.numero,
        'estado_sigla', e.sigla,
        'estado_nombre', e.nombre,
        'fecha_ingreso', cm.fecha_inicio,
        'es_miembro_formal', true,
        'bautizado', COALESCE(pd.bautizado, false),
        'rango_miembro', pcm.rango_miembro,
        'es_sublider', EXISTS (
          SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = p.id
            AND ca.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        ),
        'ministerios', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', m.nombre, 'es_lider', mp.es_lider) ORDER BY m.nombre), '[]'::jsonb)
          FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
          WHERE mp.persona_id = p.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
        )
      ) AS fila
    FROM casa_de_paz_membresia cm
    JOIN persona p ON p.id = cm.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe
      ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN telefono_asignacion ta
      ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
    LEFT JOIN telefono tel ON tel.id = ta.telefono_id
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
    WHERE cm.casa_de_paz_id = p_casa_de_paz_id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL

    UNION ALL

    -- Asistentes Nuevos (visitas sin membresía formal): SIM, NC o Creyente
    -- por este camino -- cualquier persona que asistió alguna vez a esta
    -- CdP por reporte y no es miembro formal.
    SELECT
      fn_nombre_completo(p) AS orden,
      jsonb_build_object(
        'persona_id', p.id,
        'nombre_completo', fn_nombre_completo(p),
        'sexo', p.sexo,
        'edad', CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
                     ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
        'ci', p.ci,
        'telefono_principal', tel.numero,
        'estado_sigla', e.sigla,
        'estado_nombre', e.nombre,
        'fecha_ingreso', (
          SELECT MIN(r2.fecha_reunion)
          FROM casa_de_paz_asistencia a2
          JOIN casa_de_paz_reporte r2 ON r2.id = a2.reporte_id
          WHERE a2.persona_id = p.id AND r2.casa_de_paz_id = p_casa_de_paz_id
            AND a2.fecha_eliminacion IS NULL AND r2.fecha_eliminacion IS NULL
        ),
        'es_miembro_formal', false,
        'bautizado', COALESCE(pd.bautizado, false),
        'rango_miembro', pcm.rango_miembro,
        'es_sublider', EXISTS (
          SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = p.id
            AND ca.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        ),
        'ministerios', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', m.nombre, 'es_lider', mp.es_lider) ORDER BY m.nombre), '[]'::jsonb)
          FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
          WHERE mp.persona_id = p.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
        )
      ) AS fila
    FROM persona p
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN telefono_asignacion ta
      ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
    LEFT JOIN telefono tel ON tel.id = ta.telefono_id
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
    WHERE p.fecha_eliminacion IS NULL
      AND EXISTS (
        SELECT 1 FROM casa_de_paz_asistencia a
        JOIN casa_de_paz_reporte r ON r.id = a.reporte_id
        WHERE a.persona_id = p.id AND r.casa_de_paz_id = p_casa_de_paz_id
          AND a.fecha_eliminacion IS NULL AND r.fecha_eliminacion IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM casa_de_paz_membresia cm
        WHERE cm.persona_id = p.id AND cm.casa_de_paz_id = p_casa_de_paz_id
          AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
      )

    UNION ALL

    -- NUEVO (extiende 20260908050000): Líderes o Sublíderes con cargo vigente
    -- en esta CdP que no entraron por ninguna de las 2 ramas de arriba --
    -- ninguno de los 2 cargos crea fila en casa_de_paz_membresia (el Líder
    -- "dirige" la CdP, no es un "miembro" de ella en ese sentido), así que
    -- sin esta rama quedaban invisibles. Confirmado: 100% de los 58 Líderes
    -- vigentes del sistema no tenían membresía ni asistencia propia.
    SELECT
      fn_nombre_completo(p) AS orden,
      jsonb_build_object(
        'persona_id', p.id,
        'nombre_completo', fn_nombre_completo(p),
        'sexo', p.sexo,
        'edad', CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
                     ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
        'ci', p.ci,
        'telefono_principal', tel.numero,
        'estado_sigla', e.sigla,
        'estado_nombre', e.nombre,
        'fecha_ingreso', (
          SELECT MIN(cc.fecha_inicio) FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = p.id
            AND ca.codigo IN ('SUBLIDER_CDP', 'LIDER_CDP') AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        ),
        'es_miembro_formal', false,
        'bautizado', COALESCE(pd.bautizado, false),
        'rango_miembro', pcm.rango_miembro,
        'es_sublider', EXISTS (
          SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
          WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = p.id
            AND ca.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        ),
        'ministerios', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', m.nombre, 'es_lider', mp.es_lider) ORDER BY m.nombre), '[]'::jsonb)
          FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
          WHERE mp.persona_id = p.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
        )
      ) AS fila
    FROM persona p
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN telefono_asignacion ta
      ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
    LEFT JOIN telefono tel ON tel.id = ta.telefono_id
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
    WHERE p.fecha_eliminacion IS NULL
      AND EXISTS (
        SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo ca ON ca.id = cc.cargo_id
        WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.persona_id = p.id
          AND ca.codigo IN ('SUBLIDER_CDP', 'LIDER_CDP') AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM casa_de_paz_membresia cm
        WHERE cm.persona_id = p.id AND cm.casa_de_paz_id = p_casa_de_paz_id
          AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM casa_de_paz_asistencia a
        JOIN casa_de_paz_reporte r ON r.id = a.reporte_id
        WHERE a.persona_id = p.id AND r.casa_de_paz_id = p_casa_de_paz_id
          AND a.fecha_eliminacion IS NULL AND r.fecha_eliminacion IS NULL
      )
  ) sub;

  RETURN v_resultado;
END;
$$;
