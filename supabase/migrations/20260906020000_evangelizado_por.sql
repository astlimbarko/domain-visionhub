-- VisionHub -- KAN-338 (nuevo): registrar y mostrar quien evangelizo a cada
-- persona. La columna evangelismo.evangelizado_por_id ya existe desde el
-- diseno original (harness/11-esquema-bd/sql/12_evangelismo.sql) pero nunca
-- se lleno desde el formulario ni se mostro en ningun listado -- pedido
-- explicito del owner (2026-09-06) tras revisar "Personas evangelizadas".

CREATE OR REPLACE FUNCTION public.fn_registrar_evangelizado(p_datos JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_persona_id UUID := NULLIF(p_datos->>'persona_id', '')::UUID;
  v_telefono TEXT := NULLIF(btrim(coalesce(p_datos->>'telefono', '')), '');
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  IF v_persona_id IS NULL THEN
    INSERT INTO persona (iglesia_id, primer_nombre, primer_apellido, sexo, fecha_nacimiento, membresia_completada)
    VALUES (
      (p_datos->>'iglesia_id')::UUID,
      p_datos->>'primer_nombre',
      p_datos->>'primer_apellido',
      (p_datos->>'sexo')::sexo_enum,
      NULLIF(p_datos->>'fecha_nacimiento', '')::DATE,
      false
    )
    RETURNING id INTO v_persona_id;

    IF v_telefono IS NOT NULL THEN
      SELECT id INTO v_tipo_telefono_id FROM tipo_telefono WHERE activo ORDER BY orden LIMIT 1;
      IF v_tipo_telefono_id IS NOT NULL THEN
        INSERT INTO telefono (iglesia_id, tipo_telefono_id, numero)
        VALUES ((p_datos->>'iglesia_id')::UUID, v_tipo_telefono_id, v_telefono)
        RETURNING id INTO v_telefono_id;

        INSERT INTO telefono_asignacion (iglesia_id, telefono_id, persona_id, es_principal)
        VALUES ((p_datos->>'iglesia_id')::UUID, v_telefono_id, v_persona_id, true);
      END IF;
    END IF;
  END IF;

  INSERT INTO evangelismo (iglesia_id, casa_de_paz_id, persona_id, fecha, domicilio, observaciones, tipo_evangelismo_id, evangelizado_por_id)
  VALUES (
    (p_datos->>'iglesia_id')::UUID,
    (p_datos->>'casa_de_paz_id')::UUID,
    v_persona_id,
    (p_datos->>'fecha')::DATE,
    p_datos->>'domicilio',
    p_datos->>'observaciones',
    NULLIF(p_datos->>'tipo_evangelismo_id', '')::UUID,
    NULLIF(p_datos->>'evangelizado_por_id', '')::UUID
  );

  RETURN v_persona_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_registrar_evangelizado(JSONB) TO authenticated;

-- fn_buscar_evangelizados: DROP primero porque se agrega una columna nueva
-- al RETURNS TABLE (Postgres no permite cambiar el row type con
-- CREATE OR REPLACE, mismo gotcha ya documentado con fn_mis_iglesias_detalle).
DROP FUNCTION IF EXISTS public.fn_buscar_evangelizados(UUID, UUID, TEXT, DATE, DATE, INT, INT, UUID, UUID);

CREATE FUNCTION public.fn_buscar_evangelizados(
  p_iglesia_id UUID,
  p_red_id UUID DEFAULT NULL,
  p_texto TEXT DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 50,
  p_casa_de_paz_id UUID DEFAULT NULL,
  p_tipo_evangelismo_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  persona_id UUID,
  nombre_completo TEXT,
  fecha DATE,
  domicilio TEXT,
  telefono_principal VARCHAR,
  red_id UUID,
  red_nombre VARCHAR,
  casa_de_paz_id UUID,
  casa_de_paz_etiqueta TEXT,
  tipo_evangelismo_nombre VARCHAR,
  tipo_evangelismo_color CHARACTER,
  evangelizado_por_nombre TEXT,
  total BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_offset INT := GREATEST(p_pagina - 1, 0) * p_por_pagina;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    fn_es_operativo_en(p_iglesia_id)
    OR fn_es_pastor_en(p_iglesia_id)
    OR fn_es_lider_evangelismo_en(p_iglesia_id)
  ) THEN
    RAISE EXCEPTION 'SIN_PERMISO: no tenes permiso para ver el listado de evangelizados de esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF p_red_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM red WHERE red.id = p_red_id AND red.iglesia_id = p_iglesia_id AND red.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: la red % no pertenece a esta iglesia', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT ev.id, ev.persona_id, fn_nombre_completo(p), ev.fecha, ev.domicilio,
         tel.numero,
         r.id, r.nombre,
         ev.casa_de_paz_id, fn_etiqueta_cdp(ev.casa_de_paz_id),
         te.nombre, te.color,
         fn_nombre_completo(evz),
         count(*) OVER()
  FROM evangelismo ev
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = ev.casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  LEFT JOIN persona evz ON evz.id = ev.evangelizado_por_id
  WHERE ev.iglesia_id = p_iglesia_id
    AND ev.fecha_eliminacion IS NULL
    -- "Semilla" es un conteo agregado, no personas con nombre real (mismo
    -- criterio que ya usa fn_buscar_personas con p_excluir_semillas) --
    -- pedido explicito del owner (2026-09-06): esta pantalla es de personas,
    -- no debe listar filas "Semilla (sin datos)".
    AND (te.codigo IS DISTINCT FROM 'SEMILLA')
    AND (p_red_id IS NULL OR r.id = p_red_id)
    AND (p_casa_de_paz_id IS NULL OR ev.casa_de_paz_id = p_casa_de_paz_id)
    AND (p_tipo_evangelismo_id IS NULL OR te.id = p_tipo_evangelismo_id)
    AND (p_desde IS NULL OR ev.fecha >= p_desde)
    AND (p_hasta IS NULL OR ev.fecha <= p_hasta)
    AND (p_texto IS NULL OR btrim(p_texto) = '' OR fn_nombre_completo(p) ILIKE '%' || p_texto || '%')
  ORDER BY ev.fecha DESC
  LIMIT p_por_pagina OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_buscar_evangelizados(UUID, UUID, TEXT, DATE, DATE, INT, INT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_buscar_evangelizados(UUID, UUID, TEXT, DATE, DATE, INT, INT, UUID, UUID) TO authenticated;
