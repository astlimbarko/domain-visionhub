-- VisionHub -- "Personas" del Líder de CdP debe mostrar a TODA persona
-- ingresada por reporte, sin importar su estado (SIM, NC o Creyente) --
-- spec del owner (2026-09-07), punto 9: "toda persona ingresada mediante
-- reporte debe aparecer también en la sección Personas, independientemente
-- de su estado". Antes (20260907010000) solo se mostraba NC/Creyente, igual
-- que "Asistencia Regular" -- son cosas distintas: Asistencia Regular sigue
-- siendo solo NC/Creyente (spec punto 11), pero Personas es más amplio.

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
        'es_miembro_formal', true
      ) AS fila
    FROM casa_de_paz_membresia cm
    JOIN persona p ON p.id = cm.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe
      ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN telefono_asignacion ta
      ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
    LEFT JOIN telefono tel ON tel.id = ta.telefono_id
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
        'es_miembro_formal', false
      ) AS fila
    FROM persona p
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    LEFT JOIN telefono_asignacion ta
      ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
    LEFT JOIN telefono tel ON tel.id = ta.telefono_id
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
