-- VisionHub -- 104_fix_prioridad_meta_supervisor.sql
-- Correccion del owner (2026-08-06) sobre 103_evangelismo_meta_supervisor_red.sql:
-- la prioridad que arme ahi estaba invertida. La 103 dejaba ganar a la meta
-- CdP-especifica (la que asigna el Lider de Red) por sobre la meta de Red
-- del Supervisor -- el owner aclaro que tiene que ser al reves: "si la casa
-- de paz ya tenia una meta de red y ahora tiene una meta por parte del
-- supervisor de la vision, se prioriza la meta del supervisor de la vision
-- en accion". Prioridad correcta, de mayor a menor:
--   1) Meta de Red asignada por el Supervisor (ASIGNADA_RED) -- GANA SIEMPRE
--      que este vigente, incluso por sobre una meta CdP-especifica.
--   2) Meta CdP-especifica asignada por el Lider de Red (ASIGNADA)
--   3) Meta propia de la CdP (PROPIA)
--
-- fn_tasa_evangelismo_red no cambia: sigue excluyendo origen ASIGNADA_RED de
-- su SUM (evita contar la misma meta de Red una vez por cada CdP que la
-- hereda) -- esa parte del diseño no dependia del orden de prioridad.

CREATE OR REPLACE FUNCTION fn_meta_efectiva(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (meta INTEGER, origen VARCHAR)
LANGUAGE sql STABLE
AS $$
  -- 1) Meta de Red del Supervisor -- maxima prioridad.
  (SELECT ma.meta, 'ASIGNADA_RED'::VARCHAR
   FROM meta_evangelismo_asignada ma
   JOIN casa_de_paz_red cdr ON cdr.red_id = ma.red_id AND cdr.casa_de_paz_id = p_casa_de_paz_id
     AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
   WHERE ma.red_id IS NOT NULL AND p_fecha BETWEEN ma.fecha_inicio AND ma.fecha_fin AND ma.fecha_eliminacion IS NULL
   LIMIT 1)

  UNION ALL

  -- 2) Meta CdP-especifica del Lider de Red -- solo si no hay una de Red vigente.
  (SELECT ma.meta, 'ASIGNADA'::VARCHAR
   FROM meta_evangelismo_asignada ma
   WHERE ma.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma.fecha_inicio AND ma.fecha_fin AND ma.fecha_eliminacion IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma2
       JOIN casa_de_paz_red cdr2 ON cdr2.red_id = ma2.red_id AND cdr2.casa_de_paz_id = p_casa_de_paz_id
         AND cdr2.fecha_fin IS NULL AND cdr2.fecha_eliminacion IS NULL
       WHERE ma2.red_id IS NOT NULL AND p_fecha BETWEEN ma2.fecha_inicio AND ma2.fecha_fin AND ma2.fecha_eliminacion IS NULL
     )
   LIMIT 1)

  UNION ALL

  -- 3) Meta propia -- solo si no hay ninguna de las dos anteriores.
  (SELECT c.meta_evangelismo, 'PROPIA'::VARCHAR
   FROM casa_de_paz c
   WHERE c.id = p_casa_de_paz_id AND c.meta_evangelismo IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma2
       JOIN casa_de_paz_red cdr2 ON cdr2.red_id = ma2.red_id AND cdr2.casa_de_paz_id = p_casa_de_paz_id
         AND cdr2.fecha_fin IS NULL AND cdr2.fecha_eliminacion IS NULL
       WHERE ma2.red_id IS NOT NULL AND p_fecha BETWEEN ma2.fecha_inicio AND ma2.fecha_fin AND ma2.fecha_eliminacion IS NULL
     )
     AND NOT EXISTS (
       SELECT 1 FROM meta_evangelismo_asignada ma3
       WHERE ma3.casa_de_paz_id = p_casa_de_paz_id AND p_fecha BETWEEN ma3.fecha_inicio AND ma3.fecha_fin AND ma3.fecha_eliminacion IS NULL
     )
   LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION fn_bloquear_meta_propia_bajo_asignada()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_asignada RECORD;
  v_evangelizados INTEGER;
BEGIN
  IF NEW.meta_evangelismo IS NOT DISTINCT FROM OLD.meta_evangelismo THEN
    RETURN NEW;
  END IF;

  IF fn_es_rol_superior_de_cdp(NEW.id) THEN
    RETURN NEW;
  END IF;

  -- 1) Meta de Red del Supervisor primero -- misma prioridad que fn_meta_efectiva.
  SELECT ma.meta, ma.fecha_inicio, ma.fecha_fin INTO v_asignada
  FROM meta_evangelismo_asignada ma
  JOIN casa_de_paz_red cdr ON cdr.red_id = ma.red_id AND cdr.casa_de_paz_id = NEW.id
    AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  WHERE ma.red_id IS NOT NULL AND ma.fecha_eliminacion IS NULL
    AND CURRENT_DATE BETWEEN ma.fecha_inicio AND ma.fecha_fin
  LIMIT 1;

  -- 2) Si no hay, la CdP-especifica del Lider de Red.
  IF v_asignada IS NULL THEN
    SELECT meta, fecha_inicio, fecha_fin INTO v_asignada
    FROM meta_evangelismo_asignada
    WHERE casa_de_paz_id = NEW.id AND fecha_eliminacion IS NULL
      AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
    LIMIT 1;
  END IF;

  IF v_asignada IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_evangelizados
  FROM evangelismo
  WHERE casa_de_paz_id = NEW.id AND fecha_eliminacion IS NULL
    AND fecha BETWEEN v_asignada.fecha_inicio AND v_asignada.fecha_fin;

  IF v_evangelizados < v_asignada.meta THEN
    RAISE EXCEPTION 'META_ASIGNADA_SIN_CUMPLIR: tu red te asignó una meta de % (llevás %) -- no podés cambiar tu meta propia hasta alcanzarla', v_asignada.meta, v_evangelizados USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
