-- VisionHub -- Rediseno del dashboard del Lider de CdP (pedido del owner,
-- 2026-09-08): las cards nuevas (Discipulos, Creyentes, Simpatizantes,
-- Bautizados, Afirmados, Sublideres, Ministerios) funcionan como botones de
-- acceso rapido que abren "Personas" ya filtrado -- para eso, fn_personas_de_cdp
-- necesita exponer datos que hoy no trae: bautizado y rango_miembro
-- (persona_detalle, ya existen desde el formulario de membresia), si es
-- Sublider vigente de esta CdP (casa_de_paz_cargo), y los ministerios en los
-- que participa (ministerio_persona, tambien poblado desde el formulario de
-- membresia -- el owner confirmo que se puede sacar de ahi, sin tocar el
-- modulo Ministerios general).
--
-- Aditivo puro sobre fn_personas_de_cdp (20260907030000): mismas 2 ramas
-- (miembros formales + asistentes nuevos), mismo criterio de acceso, solo se
-- suman campos al jsonb_build_object de cada fila.

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
    -- rango_miembro (Discípulo/Afirmado/Creyente autodeclarado) vive en
    -- persona_censo_membresia, NO en persona_detalle -- son tablas distintas
    -- (KAN-217, 20260821050000_afirmacion_censo_cargos_membresia.sql).
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
  ) sub;

  RETURN v_resultado;
END;
$$;

-- fn_testimonios_cdp: "Testimonio" -- pedido del owner (2026-09-08) de
-- listar los testimonios ya guardados en casa_de_paz_reporte.testimonios
-- (existe desde el diseno original, campo de texto libre del reporte
-- semanal) agrupados por reunion. Sin tabla nueva -- el dato ya se guarda,
-- solo faltaba una forma de listarlo.
CREATE OR REPLACE FUNCTION public.fn_testimonios_cdp(p_casa_de_paz_id UUID, p_desde DATE DEFAULT NULL, p_hasta DATE DEFAULT NULL)
RETURNS TABLE (
  reporte_id UUID,
  fecha_reunion DATE,
  testimonios TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  RETURN QUERY
  SELECT r.id, r.fecha_reunion, r.testimonios
  FROM casa_de_paz_reporte r
  WHERE r.casa_de_paz_id = p_casa_de_paz_id
    AND r.fecha_eliminacion IS NULL
    AND r.testimonios IS NOT NULL AND btrim(r.testimonios) <> ''
    AND (p_desde IS NULL OR r.fecha_reunion >= p_desde)
    AND (p_hasta IS NULL OR r.fecha_reunion <= p_hasta)
  ORDER BY r.fecha_reunion DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_testimonios_cdp(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_testimonios_cdp(UUID, DATE, DATE) TO authenticated;
