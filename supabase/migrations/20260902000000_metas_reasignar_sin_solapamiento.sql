-- VisionHub -- 20260902000000_metas_reasignar_sin_solapamiento.sql
-- Pedido del owner (2026-09-02, sesion de Matias): quien asigna una meta de
-- evangelismo (el Lider de Red para una CdP puntual, o el Lider de Red /
-- Supervisor / Pastor para toda la Red) tiene que poder CAMBIARLA para el
-- mismo periodo, sin toparse con el error de "solapamiento".
--
-- Hoy el frontend hace un INSERT directo a meta_evangelismo_asignada
-- (asignarMetaEvangelismo / asignarMetaRedEvangelismo). Las constraints
-- EXCLUDE del mismo ambito -- excl_meta_asignada_solapada (por casa_de_paz_id,
-- 12_evangelismo.sql) y excl_meta_asignada_red_solapada (por red_id,
-- 81_meta_global_red.sql) -- rechazan cualquier rango de fechas que se solape
-- con una meta ya vigente. Asi, "cambiar la meta de este mes" = insertar un
-- rango que se solapa con el anterior = viola la EXCLUDE. Ademas la tabla no
-- tiene policy de UPDATE (solo SELECT/INSERT, 16_rls.sql), asi que dar de baja
-- la meta vieja desde el cliente lo bloquea el RLS en silencio.
--
-- Fix: dos RPC SECURITY DEFINER que, en una sola transaccion, dan de baja
-- LOGICA (fecha_eliminacion) la(s) meta(s) vigente(s) del MISMO ambito que se
-- solapan con el nuevo rango, y recien despues insertan la nueva. El permiso
-- que se exige es exactamente el mismo que ya exige pol_meta_asignada_insert
-- (fn_es_rol_superior_de_cdp para el ambito CdP; fn_es_lider_de_red o
-- fn_es_operativo_en para el ambito Red) -- no se amplia quien puede asignar,
-- solo se permite reemplazar en vez de chocar.
--
-- Los dos ambitos (CdP vs Red) NO colisionan entre si: cada EXCLUDE es por su
-- propia columna de ambito, y la prioridad efectiva (la meta de Red del
-- Supervisor le gana a la meta CdP del Lider) la sigue resolviendo
-- fn_meta_efectiva (104_fix_prioridad_meta_supervisor.sql) sin cambios. Por
-- eso cada RPC solo retira metas de su propio ambito: un Lider de Red que
-- reasigna la meta de su CdP no toca la meta de Red que puso el Supervisor.

-- ============================================================
-- 1) Meta por Casa de Paz (ambito CdP, casa_de_paz_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_asignar_meta_cdp(
  p_casa_de_paz_id UUID,
  p_meta INTEGER,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID := fn_mi_persona_id();
  v_nueva_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: la casa de paz % no existe', p_casa_de_paz_id USING ERRCODE = 'P0001';
  END IF;

  -- Mismo permiso que pol_meta_asignada_insert para el ambito CdP.
  IF NOT fn_es_rol_superior_de_cdp(p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'META_SIN_PERMISO: no tenes permiso para asignar la meta de esta casa de paz'
      USING ERRCODE = 'P0001';
  END IF;

  -- Retira la(s) meta(s) vigente(s) del MISMO ambito que se solapan con el
  -- nuevo rango, para poder reemplazarlas sin violar excl_meta_asignada_solapada.
  UPDATE meta_evangelismo_asignada
  SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE casa_de_paz_id = p_casa_de_paz_id
    AND fecha_eliminacion IS NULL
    AND daterange(fecha_inicio, fecha_fin, '[]') && daterange(p_fecha_inicio, p_fecha_fin, '[]');

  INSERT INTO meta_evangelismo_asignada (iglesia_id, casa_de_paz_id, asignador_id, meta, fecha_inicio, fecha_fin, observaciones)
  VALUES (v_iglesia_id, p_casa_de_paz_id, v_persona_id, p_meta, p_fecha_inicio, p_fecha_fin, NULLIF(btrim(coalesce(p_observaciones, '')), ''))
  RETURNING id INTO v_nueva_id;

  RETURN v_nueva_id;
END;
$$;

-- ============================================================
-- 2) Meta por Red completa (ambito Red, red_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_asignar_meta_red(
  p_red_id UUID,
  p_meta INTEGER,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_persona_id UUID := fn_mi_persona_id();
  v_nueva_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'RED_INEXISTENTE: la red % no existe', p_red_id USING ERRCODE = 'P0001';
  END IF;

  -- Mismo permiso que pol_meta_asignada_insert para el ambito Red.
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'META_SIN_PERMISO: no tenes permiso para asignar la meta de esta red'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE meta_evangelismo_asignada
  SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE red_id = p_red_id
    AND fecha_eliminacion IS NULL
    AND daterange(fecha_inicio, fecha_fin, '[]') && daterange(p_fecha_inicio, p_fecha_fin, '[]');

  INSERT INTO meta_evangelismo_asignada (iglesia_id, red_id, asignador_id, meta, fecha_inicio, fecha_fin, observaciones)
  VALUES (v_iglesia_id, p_red_id, v_persona_id, p_meta, p_fecha_inicio, p_fecha_fin, NULLIF(btrim(coalesce(p_observaciones, '')), ''))
  RETURNING id INTO v_nueva_id;

  RETURN v_nueva_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_asignar_meta_cdp(UUID, INTEGER, DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_asignar_meta_red(UUID, INTEGER, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_asignar_meta_cdp(UUID, INTEGER, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_asignar_meta_red(UUID, INTEGER, DATE, DATE, TEXT) TO authenticated;
