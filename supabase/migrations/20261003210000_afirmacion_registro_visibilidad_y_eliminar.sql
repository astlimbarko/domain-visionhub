-- Afirmación -- pestaña "Registro" (antes "Datos") de los procesos (Altar,
-- Bautismo, RSIL, Membresía de nuevos). Dos cambios pedidos por el owner
-- (2026-10-03):
--
--   1. VISIBILIDAD: cualquier colaborador activo de Afirmación ve TODOS los
--      registros de su iglesia, no solo los que cargó él. Antes el RPC forzaba
--      al colaborador raso a ver únicamente lo suyo (r.creado_por = auth.uid());
--      Afirmación "de verdad" (operativo/Pastor/Líder) ya veía todo. El filtro
--      opcional por colaborador (p_registrado_por) pasa a aplicar a cualquiera.
--
--   2. ELIMINAR: botón para que los propios colaboradores borren registros
--      DUPLICADOS desde esa pestaña. Es un soft-delete del registro del proceso
--      (persona_proceso_afirmacion), NO de la persona. La responsabilidad queda
--      en el equipo de Afirmación (pedido explícito del owner).
--
-- Sin cambios de esquema: solo CREATE OR REPLACE del historial + una función
-- nueva de borrado. RLS de la tabla sigue sin policies -- todo pasa por estos
-- RPC SECURITY DEFINER, igual que el resto del módulo (KAN-481).

-- 1) Historial: todos los que pueden gestionar Afirmación ven todos los
--    registros de la iglesia.
CREATE OR REPLACE FUNCTION fn_afirmacion_historial_proceso(
  p_iglesia_id UUID,
  p_proceso_codigo proceso_afirmacion_codigo_enum,
  p_registrado_por UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  persona_id UUID,
  nombre_completo TEXT,
  fecha DATE,
  fecha_creacion TIMESTAMPTZ,
  registrado_por UUID,
  registrado_por_nombre TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT r.id, r.persona_id, fn_nombre_completo(p), r.fecha, r.fecha_creacion,
         r.creado_por, coalesce(fn_nombre_completo(pr), split_part(au.email, '@', 1))
  FROM persona_proceso_afirmacion r
  JOIN persona p ON p.id = r.persona_id
  LEFT JOIN persona pr ON pr.usuario_id = r.creado_por AND pr.fecha_eliminacion IS NULL
  LEFT JOIN auth.users au ON au.id = r.creado_por
  WHERE r.iglesia_id = p_iglesia_id AND r.proceso_codigo = p_proceso_codigo AND r.fecha_eliminacion IS NULL
    -- Filtro opcional por colaborador puntual -- ahora disponible para todos.
    AND (p_registrado_por IS NULL OR r.creado_por = p_registrado_por)
  ORDER BY r.fecha_creacion DESC;
END;
$$;

-- 2) Soft-delete de un registro de proceso -- para quitar duplicados desde la
--    pestaña "Registro". Cualquiera que pueda gestionar Afirmación en esa
--    iglesia (incluye colaboradores activos) puede hacerlo. No toca la persona,
--    solo marca fecha_eliminacion/eliminado_por en la fila del proceso
--    (soft-delete, respeta fn_bloquear_delete).
CREATE OR REPLACE FUNCTION fn_afirmacion_eliminar_proceso(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id
  FROM persona_proceso_afirmacion
  WHERE id = p_id AND fecha_eliminacion IS NULL;

  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'REGISTRO_INEXISTENTE: el registro no existe o ya fue eliminado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_puede_gestionar_afirmacion(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene permiso para eliminar este registro' USING ERRCODE = 'P0001';
  END IF;

  UPDATE persona_proceso_afirmacion
  SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_afirmacion_historial_proceso(UUID, proceso_afirmacion_codigo_enum, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_afirmacion_eliminar_proceso(UUID) TO authenticated;
