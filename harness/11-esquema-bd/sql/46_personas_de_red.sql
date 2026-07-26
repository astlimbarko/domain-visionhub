-- VisionHub -- 46_personas_de_red.sql
-- Modulo "Lider de Red > Personas": roster de SOLO LECTURA de todas las
-- personas de las Casas de Paz que hoy pertenecen a una Red, con su procedencia
-- (historial de membresias) y una marca de si llegaron por una fusion.
--
-- No agrega tablas ni cambia datos: la procedencia YA existe en el modelo
-- (casa_de_paz_membresia nunca borra filas -- trg_no_delete_casa_de_paz_membresia
-- --, cada movimiento cierra fecha_fin y abre una fila nueva) y las fusiones ya
-- linkean origen->destino en fusion_casa_de_paz. Esta funcion solo lo ensambla
-- del lado del servidor para no reimplementar fn_nombre_completo / fn_etiqueta_cdp
-- en el cliente. Mismo patron que fn_buscar_personas / fn_persona_ficha.
--
-- Alcance: el Lider de Red solo ve su Red (fn_es_lider_de_red); Pastor/Supervisor
-- operativo tambien pueden consultarla.

CREATE OR REPLACE FUNCTION fn_personas_de_red(p_red_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_iglesia_id UUID;
  v_resultado JSONB;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
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
        -- "Fecha de ingreso" = la primera vez que la persona entro a una CdP
        -- (la mas vieja de todo su historial de membresias).
        'fecha_ingreso', (
          SELECT MIN(m2.fecha_inicio) FROM casa_de_paz_membresia m2
          WHERE m2.persona_id = p.id AND m2.fecha_eliminacion IS NULL
        ),
        -- Cadena de procedencia: cada CdP por la que paso, en orden. Una fila
        -- se marca por_fusion cuando su cierre (fecha_fin) coincide con una
        -- fusion vigente que la tuvo como origen.
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
    WHERE cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  ) sub;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_personas_de_red(UUID) TO authenticated;
