-- KAN-481: proceso "Altar" de Afirmacion.
--
-- Tabla y funciones GENERICAS por proceso_codigo a proposito -- sienta la
-- base reusable para KAN-483 (Retiro de Sanidad Interior) y KAN-484 (Fiesta
-- de Bienvenida): misma tabla, mismo RPC, solo cambia el codigo de proceso.
-- No se crea una tabla por proceso (evita repetir 3 veces la misma
-- estructura y las mismas funciones).
--
-- Mismo patron que colaborador_codigo/colaborador_sesion (KAN-405): trigger
-- fn_auditoria() para creado_por/fecha_creacion, RLS habilitado SIN
-- policies para `authenticated` -- todo el acceso pasa por RPC SECURITY
-- DEFINER, nunca por escritura directa via PostgREST.
--
-- "Estado acumulado" (true/false) no es una columna -- se deriva de si
-- existe al menos un registro no eliminado para esa persona+proceso. Asi
-- nunca puede volver a false por accidente, y el historial de fechas queda
-- gratis (una persona puede pasar por Altar mas de una vez).

CREATE TYPE proceso_afirmacion_codigo_enum AS ENUM ('ALTAR', 'RSIL', 'FIESTA_BIENVENIDA');

CREATE TABLE persona_proceso_afirmacion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          UUID NOT NULL REFERENCES persona(id),
  iglesia_id          UUID NOT NULL REFERENCES iglesia(id),
  proceso_codigo      proceso_afirmacion_codigo_enum NOT NULL,
  fecha               DATE NOT NULL,
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por          UUID REFERENCES auth.users(id),
  fecha_actualizacion TIMESTAMPTZ,
  actualizado_por     UUID REFERENCES auth.users(id),
  fecha_eliminacion   TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id)
);

CREATE INDEX ix_persona_proceso_afirmacion_persona
  ON persona_proceso_afirmacion (persona_id, proceso_codigo) WHERE fecha_eliminacion IS NULL;
CREATE INDEX ix_persona_proceso_afirmacion_iglesia
  ON persona_proceso_afirmacion (iglesia_id, proceso_codigo, fecha_creacion DESC) WHERE fecha_eliminacion IS NULL;
CREATE INDEX ix_persona_proceso_afirmacion_creado_por
  ON persona_proceso_afirmacion (creado_por) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_persona_proceso_afirmacion
  BEFORE INSERT OR UPDATE ON persona_proceso_afirmacion FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_persona_proceso_afirmacion
  BEFORE DELETE ON persona_proceso_afirmacion FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE persona_proceso_afirmacion ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Permiso comun a los 3 procesos: operativo/Pastor/Lider de Afirmacion
-- "de verdad", o colaborador con sesion activa en el departamento
-- AFIRMACION (fn_es_colaborador_activo_en, ya existe de KAN-405). La
-- granularidad por tarea puntual (Altar vs RSIL vs Fiesta) queda para
-- KAN-485 -- por ahora un colaborador activo en Afirmacion puede
-- registrar cualquiera de los 3, igual que ya puede hoy con el resto de
-- las funciones de Afirmacion.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_puede_gestionar_afirmacion(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_operativo_en(p_iglesia_id)
    OR fn_es_pastor_en(p_iglesia_id)
    OR fn_es_lider_afirmacion_en(p_iglesia_id)
    OR fn_es_colaborador_activo_en(p_iglesia_id, 'AFIRMACION');
$$;

CREATE OR REPLACE FUNCTION fn_afirmacion_registrar_proceso(
  p_persona_id UUID,
  p_proceso_codigo proceso_afirmacion_codigo_enum,
  p_fecha DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'PERSONA_INEXISTENTE: la persona no existe' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_puede_gestionar_afirmacion(v_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene permiso para registrar este proceso' USING ERRCODE = 'P0001';
  END IF;
  IF p_fecha IS NULL OR p_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'FECHA_INVALIDA: la fecha no puede estar vacia ni ser futura' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona_proceso_afirmacion (persona_id, iglesia_id, proceso_codigo, fecha)
  VALUES (p_persona_id, v_iglesia_id, p_proceso_codigo, p_fecha)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Estado acumulado + fechas de un proceso puntual para una persona (para
-- pintar los puntos de la columna "Afirmacion" en MembresiaTabla.tsx).
CREATE OR REPLACE FUNCTION fn_afirmacion_estado_proceso(p_persona_id UUID, p_proceso_codigo proceso_afirmacion_codigo_enum)
RETURNS TABLE (realizado BOOLEAN, primera_fecha DATE, ultima_fecha DATE, cantidad INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*) > 0, min(fecha), max(fecha), count(*)::INT
  FROM persona_proceso_afirmacion
  WHERE persona_id = p_persona_id AND proceso_codigo = p_proceso_codigo AND fecha_eliminacion IS NULL;
$$;

-- Historial para la pestaña "Datos": un colaborador (que no sea ademas
-- operativo/Pastor/Lider de Afirmacion) SOLO ve lo que el mismo registro,
-- sin importar que parametros mande -- forzado en el propio RPC, no
-- confiado al frontend. Afirmacion "de verdad" ve todo, puede filtrar por
-- un colaborador puntual (p_registrado_por) o ver todos.
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
DECLARE
  v_es_afirmacion BOOLEAN;
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO' USING ERRCODE = 'P0001';
  END IF;

  v_es_afirmacion := fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id) OR fn_es_lider_afirmacion_en(p_iglesia_id);

  RETURN QUERY
  SELECT r.id, r.persona_id, fn_nombre_completo(p), r.fecha, r.fecha_creacion,
         r.creado_por, coalesce(fn_nombre_completo(pr), split_part(au.email, '@', 1))
  FROM persona_proceso_afirmacion r
  JOIN persona p ON p.id = r.persona_id
  LEFT JOIN persona pr ON pr.usuario_id = r.creado_por AND pr.fecha_eliminacion IS NULL
  LEFT JOIN auth.users au ON au.id = r.creado_por
  WHERE r.iglesia_id = p_iglesia_id AND r.proceso_codigo = p_proceso_codigo AND r.fecha_eliminacion IS NULL
    -- Colaborador raso: forzado a solo lo suyo, gane lo que gane p_registrado_por.
    AND (v_es_afirmacion OR r.creado_por = auth.uid())
    -- Afirmacion "de verdad": si pide un colaborador puntual, filtra por ese.
    AND (NOT v_es_afirmacion OR p_registrado_por IS NULL OR r.creado_por = p_registrado_por)
  ORDER BY r.fecha_creacion DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_puede_gestionar_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_afirmacion_registrar_proceso(UUID, proceso_afirmacion_codigo_enum, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_afirmacion_estado_proceso(UUID, proceso_afirmacion_codigo_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_afirmacion_historial_proceso(UUID, proceso_afirmacion_codigo_enum, UUID) TO authenticated;
