-- VisionHub -- fn_personas_de_cdp_lider.sql
-- Modulo "Lider de CdP > Personas": roster de SOLO LECTURA de los miembros
-- vigentes de la propia Casa de Paz. Mismo patron que fn_personas_de_red
-- (46_personas_de_red.sql / 20260809080000_paridad_pastor_supervisor.sql),
-- pero acotado a una sola CdP -- no hace falta procedencia/fusion porque ya
-- se sabe de antemano cual es la Casa de Paz.
--
-- Alcance: Lider/Sublider vigente de esa CdP, o Pastor/Supervisor operativo
-- (mismo chequeo triple que ya usan los dashboards de CdP, ver
-- 78_dashboard_cdp_nombre_dinamico.sql).

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
        'fecha_ingreso', cm.fecha_inicio
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
  ) sub;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_personas_de_cdp(UUID) TO authenticated;
