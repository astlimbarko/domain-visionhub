-- VisionHub -- 23_etiqueta_cdp.sql
-- Aclaracion del owner (2026-07-18): las Casas de Paz NO se identifican por un
-- nombre propio como las Redes. Se identifican por el nombre de su lider, y
-- solo si el mismo lider tiene 2+ CdP vigentes se agrega la zona del
-- anfitrion para desambiguar. `casa_de_paz.nombre` pasa de obligatorio a
-- opcional (una iglesia que SI quiera nombrarlas puede hacerlo; el default es
-- calcular la etiqueta).

ALTER TABLE casa_de_paz ALTER COLUMN nombre DROP NOT NULL;

CREATE OR REPLACE FUNCTION fn_etiqueta_cdp(p_casa_de_paz_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nombre_manual   VARCHAR;
  v_lider_persona   UUID;
  v_lider_nombre    TEXT;
  v_cantidad_cdp    INT;
  v_zona            VARCHAR;
BEGIN
  SELECT nombre INTO v_nombre_manual FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_nombre_manual IS NOT NULL AND btrim(v_nombre_manual) <> '' THEN
    RETURN v_nombre_manual;
  END IF;

  SELECT cc.persona_id INTO v_lider_persona
  FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
  WHERE cc.casa_de_paz_id = p_casa_de_paz_id AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL;

  IF v_lider_persona IS NULL THEN
    RETURN 'Casa de Paz sin líder';
  END IF;

  SELECT fn_nombre_completo(p) INTO v_lider_nombre FROM persona p WHERE p.id = v_lider_persona;

  SELECT count(*) INTO v_cantidad_cdp
  FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
  WHERE cc.persona_id = v_lider_persona AND c.codigo = 'LIDER_CDP'
    AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL;

  IF v_cantidad_cdp <= 1 THEN
    RETURN v_lider_nombre;
  END IF;

  -- Desambiguar con la zona del domicilio del anfitrion (vinculado a la CdP)
  SELECT d.zona INTO v_zona
  FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
  WHERE da.casa_de_paz_id = p_casa_de_paz_id AND da.activo AND da.fecha_eliminacion IS NULL
  LIMIT 1;

  IF v_zona IS NOT NULL AND btrim(v_zona) <> '' THEN
    RETURN v_lider_nombre || ' (' || v_zona || ')';
  END IF;

  RETURN v_lider_nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_etiqueta_cdp(UUID) TO authenticated;
