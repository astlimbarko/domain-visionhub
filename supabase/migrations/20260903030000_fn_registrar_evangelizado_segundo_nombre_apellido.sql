-- VisionHub -- fn_registrar_evangelizado solo insertaba primer_nombre/
-- primer_apellido: una persona evangelizada con segundo nombre o apellido
-- materno los perdía. Pedido del owner (2026-09-03): los modales de alta de
-- persona nueva del reporte no contemplaban "más de un nombre". Se agregan
-- ambos campos al INSERT, opcionales (NULL si no vienen).

CREATE OR REPLACE FUNCTION public.fn_registrar_evangelizado(p_datos jsonb)
RETURNS uuid
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
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

  INSERT INTO evangelismo (iglesia_id, casa_de_paz_id, persona_id, fecha, domicilio, observaciones, tipo_evangelismo_id)
  VALUES (
    (p_datos->>'iglesia_id')::UUID,
    (p_datos->>'casa_de_paz_id')::UUID,
    v_persona_id,
    (p_datos->>'fecha')::DATE,
    p_datos->>'domicilio',
    p_datos->>'observaciones',
    NULLIF(p_datos->>'tipo_evangelismo_id', '')::UUID
  );

  RETURN v_persona_id;
END;
$function$;
