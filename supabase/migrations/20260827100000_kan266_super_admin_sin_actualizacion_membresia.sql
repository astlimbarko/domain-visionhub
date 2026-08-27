-- VisionHub -- KAN-266 (reconfirmado por el owner 2026-08-27): el modal
-- "Actualiza tu membresía" (KAN-252 Parte B, fn_mi_actualizacion_membresia_
-- pendiente) le aparecía a los Super Admin pidiéndoles Teléfono/Ministerios.
--
-- Un Super Admin es una cuenta de plataforma, no un miembro de iglesia: no
-- se le pide número de celular ni ministerios. El gate de membresía completa
-- (fn_mi_membresia_incompleta / fn_mi_iglesia_membresia_general) ya excluye
-- el rol SUPER_ADMIN, pero este chequeo de Parte B se agregó después (KAN-252)
-- y nunca lo excluyó -- solo miraba si la Persona tenía telefono_declarado/
-- ministerio_declarado en false, y los 3 Super Admin actuales tienen una
-- Persona (creada por INSERT manual) con esos flags en false, así que a los
-- 3 les aparecía el modal.
--
-- Fix: fn_mi_actualizacion_membresia_pendiente devuelve NULL si el usuario
-- es Super Admin, igual que ya hace el gate de membresía completa. No se
-- tocan los flags telefono_declarado/ministerio_declarado de sus Personas a
-- propósito: si algún día una de esas cuentas dejara de ser Super Admin y
-- pasara a ser miembro real, ahí sí correspondería preguntarle -- la
-- exclusión es por rol de sesión, no por dato guardado.

CREATE OR REPLACE FUNCTION public.fn_mi_actualizacion_membresia_pendiente()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_persona persona;
BEGIN
  -- Super Admin: cuenta de plataforma, nunca se le pide Teléfono/Ministerio.
  IF fn_es_super_admin() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_persona FROM persona
  WHERE usuario_id = auth.uid() AND membresia_completada = true AND fecha_eliminacion IS NULL
    AND btrim(primer_nombre) <> '' AND btrim(primer_apellido) <> '';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_persona.telefono_declarado AND v_persona.ministerio_declarado THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'iglesia_id', v_persona.iglesia_id,
    'falta_telefono', NOT v_persona.telefono_declarado,
    'falta_ministerio', NOT v_persona.ministerio_declarado
  );
END;
$$;
