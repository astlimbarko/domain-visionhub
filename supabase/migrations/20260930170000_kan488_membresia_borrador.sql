-- Membresía desde 0 (harness/21, KAN-488): borrador autoguardado.
--
-- Mismo patrón que casa_de_paz_reporte_borrador (KAN-435): tabla SEPARADA
-- (no un estado "borrador" dentro de las tablas reales de persona), payload
-- JSONB con todo el formulario (no columnas que mantener sincronizadas), y
-- DELETE real -- un borrador es dato de trabajo descartable, no un registro
-- de negocio con auditoría. Se borra en cuanto se guarda la membresía real
-- o cuando la persona decide empezar de cero.
--
-- Diferencia con el borrador de reporte: la clave es por USUARIO+iglesia, no
-- por (CdP, fecha). Acá se está creando gente NUEVA, no hay una persona
-- existente como clave -- un borrador activo por quien está cargando. Al
-- guardar o limpiar se borra y queda libre para el siguiente.
--
-- Acceso SOLO por RPC SECURITY DEFINER (RLS habilitado sin policies para
-- authenticated), como el resto de Afirmación -- así un colaborador temporal
-- puede guardar su borrador en una iglesia que no está en fn_mis_iglesias
-- (el gate es fn_puede_gestionar_afirmacion, que ya contempla colaborador
-- activo + super admin).

CREATE TABLE membresia_borrador (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id           UUID NOT NULL REFERENCES iglesia(id),
  usuario_id           UUID NOT NULL REFERENCES auth.users(id),
  payload              JSONB NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un borrador activo por usuario+iglesia (soporta el upsert de autoguardado).
CREATE UNIQUE INDEX uq_membresia_borrador_usuario ON membresia_borrador (iglesia_id, usuario_id);

ALTER TABLE membresia_borrador ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Autoguardado: upsert del borrador del usuario actual.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_guardar_borrador_membresia(p_iglesia_id UUID, p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene permiso para esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO membresia_borrador (iglesia_id, usuario_id, payload)
  VALUES (p_iglesia_id, auth.uid(), p_payload)
  ON CONFLICT (iglesia_id, usuario_id)
  DO UPDATE SET payload = EXCLUDED.payload, fecha_actualizacion = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- Recuperación: devuelve el payload del borrador del usuario (o NULL).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_obtener_borrador_membresia(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene permiso para esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  SELECT payload INTO v_payload
  FROM membresia_borrador
  WHERE iglesia_id = p_iglesia_id AND usuario_id = auth.uid();

  RETURN v_payload;
END;
$$;

-- ============================================================
-- Limpiar / empezar de cero: borra el borrador del usuario.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_eliminar_borrador_membresia(p_iglesia_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM membresia_borrador
  WHERE iglesia_id = p_iglesia_id AND usuario_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION fn_guardar_borrador_membresia(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_borrador_membresia(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_eliminar_borrador_membresia(UUID) TO authenticated;
