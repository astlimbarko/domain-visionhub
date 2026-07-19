-- VisionHub -- 39_titulo_header.sql
-- Titulo a mostrar en el header (nombre + cargo), a pedido del owner.
-- Prioridad: Pastor > Supervisor > cargo "A" ministerial o "B" de iglesia
-- (persona_cargo, el de menor 'orden' del catalogo) > cargo de Red > cargo
-- de Casa de Paz. NULL si no tiene ninguno -- el frontend cae al correo.

CREATE OR REPLACE FUNCTION fn_mi_titulo(p_iglesia_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_titulo TEXT;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RETURN NULL;
  END IF;

  IF fn_es_pastor_en(p_iglesia_id) THEN
    RETURN 'Pastor';
  END IF;
  IF fn_es_operativo_en(p_iglesia_id) THEN
    RETURN 'Supervisor de la Visión en Acción';
  END IF;

  SELECT c.nombre INTO v_titulo
  FROM persona_cargo pc
  JOIN cargo c ON c.id = pc.cargo_id
  JOIN persona p ON p.id = pc.persona_id
  WHERE p.usuario_id = auth.uid() AND pc.iglesia_id = p_iglesia_id
    AND pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL
  ORDER BY c.orden LIMIT 1;
  IF v_titulo IS NOT NULL THEN RETURN v_titulo; END IF;

  SELECT c.nombre INTO v_titulo
  FROM red_cargo rc
  JOIN cargo c ON c.id = rc.cargo_id
  JOIN persona p ON p.id = rc.persona_id
  WHERE p.usuario_id = auth.uid() AND rc.iglesia_id = p_iglesia_id
    AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  ORDER BY c.orden LIMIT 1;
  IF v_titulo IS NOT NULL THEN RETURN v_titulo; END IF;

  SELECT c.nombre INTO v_titulo
  FROM casa_de_paz_cargo cc
  JOIN cargo c ON c.id = cc.cargo_id
  JOIN persona p ON p.id = cc.persona_id
  WHERE p.usuario_id = auth.uid() AND cc.iglesia_id = p_iglesia_id
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  ORDER BY c.orden LIMIT 1;

  RETURN v_titulo;
END;
$$;
