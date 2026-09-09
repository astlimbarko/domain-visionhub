-- VisionHub -- Accesos rapidos del Dashboard de Lider de Red/Supervisor de
-- Red (2026-09-09, pedido con base en REPORTE 2026 VISION.xlsx, hoja "DATOS
-- FINALES 2026"): igual que fn_personas_de_cdp ya trae bautizado/
-- rango_miembro/es_sublider/ministerios para alimentar los accesos rapidos
-- del Dashboard de CdP, fn_personas_de_red suma los mismos campos de censo
-- (persona_censo_membresia/persona_detalle) mas ministerios y milagros, para
-- poder calcular en el cliente los 13 conteos nuevos sin una RPC aparte por
-- cada uno -- mismo patron ya usado y ya probado.
--
-- No se toca el alcance/permiso de la funcion (fn_es_lider_de_red/
-- fn_es_operativo_en/fn_es_pastor_en), solo se agregan campos al mismo JSON
-- por fila.

CREATE OR REPLACE FUNCTION public.fn_personas_de_red(p_red_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id UUID;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: no administras esta Red' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(fila ORDER BY orden), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT
      fn_nombre_completo(p) AS orden,
      jsonb_build_object(
        'persona_id', p.id,
        'nombre_completo', fn_nombre_completo(p),
        'sexo', p.sexo,
        'edad', CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
                     ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
        'estado_sigla', e.sigla,
        'estado_nombre', e.nombre,
        'casa_de_paz_id', cdp.id,
        'casa_de_paz_etiqueta', fn_etiqueta_cdp(cdp.id),
        'lider_nombre', (
          SELECT fn_nombre_completo(lp)
          FROM casa_de_paz_cargo cc
          JOIN cargo c ON c.id = cc.cargo_id
          JOIN persona lp ON lp.id = cc.persona_id
          WHERE cc.casa_de_paz_id = cdp.id AND c.codigo = 'LIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
          LIMIT 1
        ),
        'sublider_nombre', (
          SELECT string_agg(fn_nombre_completo(sp), ', ' ORDER BY fn_nombre_completo(sp))
          FROM casa_de_paz_cargo cc
          JOIN cargo c ON c.id = cc.cargo_id
          JOIN persona sp ON sp.id = cc.persona_id
          WHERE cc.casa_de_paz_id = cdp.id AND c.codigo = 'SUBLIDER_CDP'
            AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
        ),
        'fecha_ingreso', (
          SELECT MIN(m2.fecha_inicio) FROM casa_de_paz_membresia m2
          WHERE m2.persona_id = p.id AND m2.fecha_eliminacion IS NULL
        ),
        'procedencia', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'casa_de_paz_id', mh.casa_de_paz_id,
            'etiqueta', fn_etiqueta_cdp(mh.casa_de_paz_id),
            'fecha_inicio', mh.fecha_inicio,
            'fecha_fin', mh.fecha_fin,
            'vigente', mh.fecha_fin IS NULL,
            'por_fusion', f.id IS NOT NULL,
            'motivo', f.motivo
          ) ORDER BY mh.fecha_inicio)
          FROM casa_de_paz_membresia mh
          LEFT JOIN fusion_casa_de_paz f
            ON f.casa_de_paz_origen_id = mh.casa_de_paz_id
           AND f.fecha_fusion::date = mh.fecha_fin
           AND f.deshecha_en IS NULL
           AND f.fecha_eliminacion IS NULL
          WHERE mh.persona_id = p.id AND mh.fecha_eliminacion IS NULL
        ), '[]'::jsonb),
        'proviene_de_fusion', EXISTS (
          SELECT 1
          FROM casa_de_paz_membresia mh
          JOIN fusion_casa_de_paz f
            ON f.casa_de_paz_origen_id = mh.casa_de_paz_id
           AND f.fecha_fusion::date = mh.fecha_fin
           AND f.deshecha_en IS NULL
           AND f.fecha_eliminacion IS NULL
          WHERE mh.persona_id = p.id AND mh.fecha_eliminacion IS NULL
        ),
        -- Censo autodeclarado (persona_censo_membresia) -- mismos campos que
        -- ya trae fn_personas_de_cdp para rango_miembro/bautizado.
        'rango_miembro', pcm.rango_miembro,
        'bautizado', COALESCE(pd.bautizado, false),
        'tiene_efesio', pcm.efesio_tipo IS NOT NULL,
        'cargo_ministro', COALESCE(pcm.cargo_ministro, false),
        'cargo_anciano', COALESCE(pcm.cargo_anciano, false),
        'cargo_diacono', COALESCE(pcm.cargo_diacono, false),
        'cargo_sub_mentor', COALESCE(pcm.cargo_sub_mentor, false),
        'cargo_mentor', COALESCE(pcm.cargo_mentor, false),
        -- Cargo real (no autodeclarado) de ESTA persona en su propia CdP --
        -- distinto de lider_nombre/sublider_nombre de arriba, que son el
        -- nombre del lider/sublider de la CdP (para mostrar en la fila), no
        -- si esta fila especifica lo es.
        'es_lider_cdp', EXISTS (
          SELECT 1 FROM casa_de_paz_cargo cc3 JOIN cargo c3 ON c3.id = cc3.cargo_id
          WHERE cc3.casa_de_paz_id = cdp.id AND cc3.persona_id = p.id
            AND c3.codigo = 'LIDER_CDP' AND cc3.fecha_fin IS NULL AND cc3.fecha_eliminacion IS NULL
        ),
        'es_sublider_cdp', EXISTS (
          SELECT 1 FROM casa_de_paz_cargo cc4 JOIN cargo c4 ON c4.id = cc4.cargo_id
          WHERE cc4.casa_de_paz_id = cdp.id AND cc4.persona_id = p.id
            AND c4.codigo = 'SUBLIDER_CDP' AND cc4.fecha_fin IS NULL AND cc4.fecha_eliminacion IS NULL
        ),
        'ministerios', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', m.nombre, 'es_lider', mp.es_lider) ORDER BY m.nombre), '[]'::jsonb)
          FROM ministerio_persona mp JOIN ministerio m ON m.id = mp.ministerio_id
          WHERE mp.persona_id = p.id AND mp.fecha_fin IS NULL AND mp.fecha_eliminacion IS NULL
        ),
        'milagros', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('categoria', pm.categoria, 'fecha', pm.fecha) ORDER BY pm.fecha DESC), '[]'::jsonb)
          FROM persona_milagro pm WHERE pm.persona_id = p.id AND pm.fecha_eliminacion IS NULL
        )
      ) AS fila
    FROM casa_de_paz_membresia cm
    JOIN casa_de_paz_red cr
      ON cr.casa_de_paz_id = cm.casa_de_paz_id
     AND cr.red_id = p_red_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
    JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
    JOIN persona p ON p.id = cm.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe
      ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN persona_censo_membresia pcm ON pcm.persona_id = p.id AND pcm.fecha_eliminacion IS NULL
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    WHERE cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  ) sub;

  RETURN v_resultado;
END;
$function$;
