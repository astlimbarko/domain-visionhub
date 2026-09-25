-- KAN-444 (2026-09-25): fn_registrar_evangelizado y fn_registrar_evangelizado_red
-- reciben segundo_nombre/segundo_apellido desde el frontend pero nunca los
-- insertaban en `persona` -- quedaban siempre en NULL sin importar lo que
-- se tipeara en el formulario. Se agregan las 2 columnas al INSERT.
CREATE OR REPLACE FUNCTION public.fn_registrar_evangelizado(p_datos jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_persona_id UUID := NULLIF(p_datos->>'persona_id', '')::UUID;
  v_telefono TEXT := NULLIF(btrim(coalesce(p_datos->>'telefono', '')), '');
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
  v_tipo_evangelismo_id UUID := NULLIF(p_datos->>'tipo_evangelismo_id', '')::UUID;
  v_testimonio TEXT := NULLIF(btrim(coalesce(p_datos->>'testimonio', '')), '');
  v_es_reconciliacion BOOLEAN := COALESCE((p_datos->>'es_reconciliacion')::boolean, false);
  v_evangelismo_id UUID;
BEGIN
  IF v_persona_id IS NULL THEN
    INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, membresia_completada)
    VALUES (
      (p_datos->>'iglesia_id')::UUID,
      p_datos->>'primer_nombre',
      NULLIF(p_datos->>'segundo_nombre', ''),
      p_datos->>'primer_apellido',
      NULLIF(p_datos->>'segundo_apellido', ''),
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

  INSERT INTO evangelismo (iglesia_id, casa_de_paz_id, persona_id, fecha, domicilio, observaciones, tipo_evangelismo_id, evangelizado_por_id, es_reconciliacion)
  VALUES (
    (p_datos->>'iglesia_id')::UUID,
    (p_datos->>'casa_de_paz_id')::UUID,
    v_persona_id,
    (p_datos->>'fecha')::DATE,
    p_datos->>'domicilio',
    p_datos->>'observaciones',
    v_tipo_evangelismo_id,
    NULLIF(p_datos->>'evangelizado_por_id', '')::UUID,
    v_es_reconciliacion
  )
  RETURNING id INTO v_evangelismo_id;

  -- Testimonio/milagro opcional: el campo del formulario solo aparece cuando
  -- ya se eligio tipo Elite, esto es un resguardo (si llega texto con otro
  -- tipo, se ignora en silencio en vez de hacer fallar todo el registro) --
  -- fn_validar_evangelismo_testimonio_elite vuelve a validar esto mismo si
  -- alguna vez se inserta por otra via.
  IF v_testimonio IS NOT NULL AND EXISTS (
    SELECT 1 FROM tipo_evangelismo WHERE id = v_tipo_evangelismo_id AND codigo = 'ELITE'
  ) THEN
    INSERT INTO evangelismo_testimonio (iglesia_id, casa_de_paz_id, evangelismo_id, texto)
    VALUES ((p_datos->>'iglesia_id')::UUID, (p_datos->>'casa_de_paz_id')::UUID, v_evangelismo_id, v_testimonio);
  END IF;

  RETURN v_persona_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registrar_evangelizado_red(p_datos jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_persona_id UUID := NULLIF(p_datos->>'persona_id', '')::UUID;
  v_telefono TEXT := NULLIF(btrim(coalesce(p_datos->>'telefono', '')), '');
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  IF v_persona_id IS NULL THEN
    INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, membresia_completada)
    VALUES (
      (p_datos->>'iglesia_id')::UUID,
      p_datos->>'primer_nombre',
      NULLIF(p_datos->>'segundo_nombre', ''),
      p_datos->>'primer_apellido',
      NULLIF(p_datos->>'segundo_apellido', ''),
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

  INSERT INTO evangelismo_red (iglesia_id, red_id, persona_id, fecha, domicilio, observaciones, tipo_evangelismo_id, evangelizado_por_id)
  VALUES (
    (p_datos->>'iglesia_id')::UUID,
    (p_datos->>'red_id')::UUID,
    v_persona_id,
    (p_datos->>'fecha')::DATE,
    p_datos->>'domicilio',
    p_datos->>'observaciones',
    NULLIF(p_datos->>'tipo_evangelismo_id', '')::UUID,
    NULLIF(p_datos->>'evangelizado_por_id', '')::UUID
  );

  RETURN v_persona_id;
END;
$function$;
