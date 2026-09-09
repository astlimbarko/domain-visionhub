-- VisionHub -- Bug real encontrado (2026-09-08, pedido del owner): "Sublideres"
-- y "Ministerios por personas" del dashboard del Lider de CdP no mostraban
-- gente que SI tiene el cargo/ministerio real asignado.
--
-- Causa raiz confirmada contra produccion: fn_personas_de_cdp arma el roster
-- con 2 ramas -- (1) membresia formal principal vigente en esta CdP, (2)
-- asistencia registrada en algun reporte de esta CdP sin membresia formal.
-- Asignar un cargo de Sublider (Constructor -> Asignar Cargo) NO crea una
-- fila en casa_de_paz_membresia, y llenar los ministerios del formulario de
-- membresia tampoco garantiza que la persona ya tenga membresia/asistencia
-- registrada en ESTA CdP puntual -- asi que una persona con cargo real
-- vigente, pero sin ninguna de esas 2 señales, quedaba 100% invisible para
-- el roster (confirmado con un caso real: persona con SUBLIDER_CDP vigente
-- desde el 2026-09-01 y 2 ministerios asignados, cero filas en
-- casa_de_paz_membresia y cero asistencias en casa_de_paz_asistencia para
-- esa CdP).
--
-- El selector de periodo del dashboard NO participa de este bug -- ver
-- fn_personas_de_cdp: no recibe fecha_desde/fecha_hasta, es un roster
-- puntual sin ventana de tiempo.
--
-- Fix aditivo: 3ra rama del UNION ALL para personas con cargo SUBLIDER_CDP
-- vigente en esta CdP que no entraron por ninguna de las 2 ramas anteriores.

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

    -- NUEVO: Sublíderes con cargo vigente en esta CdP que no entraron por
    -- ninguna de las 2 ramas de arriba (sin membresía formal ni asistencia
    -- registrada aquí) -- el cargo es real y se asigna independientemente
    -- de esas 2 tablas, así que sin esta rama quedaban invisibles.
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
        'fecha_ingreso', cc.fecha_inicio,
        'es_miembro_formal', false,
        'bautizado', COALESCE(pd.bautizado, false),
        'rango_miembro', pcm.rango_miembro,
        'es_sublider', true,
        'ministerios', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', m.nombre, 'es_lider', mp.es_lider) ORDER BY m.nombre), '[]'::jsonb)
          FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
          WHERE mp.persona_id = p.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
        )
      ) AS fila
    FROM casa_de_paz_cargo cc
    JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'SUBLIDER_CDP'
    JOIN persona p ON p.id = cc.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN telefono_asignacion ta
      ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
    LEFT JOIN telefono tel ON tel.id = ta.telefono_id
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
    WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
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
