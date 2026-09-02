-- VisionHub -- fix: evangelizar (o agregar una visita) creaba la Persona en
-- un INSERT y el registro de evangelismo/visita en OTRO INSERT separado,
-- sin transaccion (2 round-trips independientes desde el cliente). Si el
-- segundo insert fallaba por cualquier motivo (el mas comun: el bug de
-- KAN-275, CI obligatorio -- ya arreglado hoy, pero el patron de fondo
-- seguia siendo fragil para CUALQUIER falla futura), la Persona quedaba
-- creada de todas formas -- huerfana, sin evangelismo/visita asociado. El
-- lider veia "No se pudo registrar", reintentaba con el mismo formulario, y
-- el reintento creaba una SEGUNDA persona desde cero (nunca reusa la
-- huerfana) -- de ahi los duplicados reportados por el owner ("rellenaron
-- una vez" pero aparecen 2 personas).
--
-- Confirmado con datos reales: 2 filas "Luis Enrique Bustamante Egüez",
-- mismo creado_por, 4 minutos de diferencia -- la primera sin ninguna fila
-- en evangelismo, la segunda con evangelismo completo.
--
-- Fix: encapsular persona + telefono (opcional) + evangelismo en una sola
-- funcion PL/pgSQL -- transaccional por naturaleza, si CUALQUIER paso falla
-- (ahora o en el futuro) TODO se revierte solo, no hace falta logica de
-- compensacion/rollback manual en el cliente. SECURITY INVOKER (no DEFINER):
-- corre con los mismos permisos/RLS que ya aplican hoy al insert directo
-- desde el cliente, sin reimplementar chequeos de permiso a mano.

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
$$;

GRANT EXECUTE ON FUNCTION public.fn_registrar_evangelizado(JSONB) TO authenticated;
