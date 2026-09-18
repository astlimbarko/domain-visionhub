-- VisionHub -- KAN-390 (2026-09-17, pedido explícito del owner): "RE"
-- (reconciliación) manual -- el líder tilda en el reporte de CdP que una
-- persona "se reconcilió" (volvió después de mucho tiempo e hizo de nuevo
-- la oración de fe). Es manual, no reemplaza ningún motor automático de
-- estados -- queda como evento aparte en Evangelismo, cuenta en sus
-- estadísticas. NO toca persona_estado.
--
-- Ojo (documentado en KAN-395, no se toca acá): ya existe un mecanismo de
-- "RE" automático más viejo (trg_evaluar_estado, activo hoy en producción)
-- que sí escribe en persona_estado -- es un concepto distinto, coexisten.

ALTER TABLE public.evangelismo ADD COLUMN es_reconciliacion BOOLEAN NOT NULL DEFAULT false;

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
