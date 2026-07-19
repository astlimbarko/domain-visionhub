-- VisionHub -- 35_fix_nucleos_familiares.sql
-- Cuarto caso del mismo patron de bug de esta sesion (ya visto en
-- fn_eventos_cdp/fn_cumpleanos_cdp y fn_ingresos_comparativo): una funcion
-- plpgsql con RETURNS TABLE convierte cada columna de salida en variable de
-- todo el cuerpo, y una referencia sin calificar a una columna de tabla con
-- el mismo nombre es ambigua en tiempo de ejecucion. fn_nucleos_familiares
-- declara "persona_id" como columna de salida y despues hace "SELECT
-- persona_id FROM familia_override"/"FROM excluida" sin calificar en varias
-- CTEs -- nunca se habia ejercitado con datos reales hasta armar el
-- dashboard del Pastor (fn_dashboard_pastor -> fn_total_familias ->
-- fn_nucleos_familiares), que fue quien lo encontro. De paso, "MIN(alcanzado)"
-- fallaba con "function min(uuid) does not exist": Postgres no trae un
-- agregado MIN/MAX para uuid de fabrica (si soporta comparar con < > para
-- ordenar/indexar, pero no un aggregate). Solo hace falta un id estable
-- para identificar el nucleo, no un orden con significado -- se castea a
-- text para el MIN y se vuelve a castear a uuid.
CREATE OR REPLACE FUNCTION fn_nucleos_familiares(p_iglesia_id UUID)
RETURNS TABLE (persona_id UUID, nucleo_id UUID)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  excluida AS (
    SELECT fo.persona_id AS excluido_id FROM familia_override fo
    WHERE fo.iglesia_id = p_iglesia_id AND fo.tipo = 'EXCLUIR' AND fo.fecha_eliminacion IS NULL
  ),
  arista_real AS (
    SELECT f.persona_id AS a, f.familiar_id AS b
    FROM familia f
    JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id
    WHERE f.iglesia_id = p_iglesia_id
      AND f.fecha_eliminacion IS NULL
      AND tr.activo
      AND fn_config_bool(p_iglesia_id, 'FAMILIA_CUENTA_' || tr.codigo)
      AND f.persona_id NOT IN (SELECT excluido_id FROM excluida)
      AND f.familiar_id NOT IN (SELECT excluido_id FROM excluida)
  ),
  arista_override AS (
    SELECT fo.persona_id AS a, fo.persona_referencia_id AS b
    FROM familia_override fo
    WHERE fo.iglesia_id = p_iglesia_id AND fo.tipo = 'INCLUIR_CON' AND fo.fecha_eliminacion IS NULL
      AND fo.persona_id NOT IN (SELECT excluido_id FROM excluida)
      AND fo.persona_referencia_id NOT IN (SELECT excluido_id FROM excluida)
    UNION ALL
    SELECT fo.persona_referencia_id AS a, fo.persona_id AS b
    FROM familia_override fo
    WHERE fo.iglesia_id = p_iglesia_id AND fo.tipo = 'INCLUIR_CON' AND fo.fecha_eliminacion IS NULL
      AND fo.persona_id NOT IN (SELECT excluido_id FROM excluida)
      AND fo.persona_referencia_id NOT IN (SELECT excluido_id FROM excluida)
  ),
  arista AS (
    SELECT a, b FROM arista_real
    UNION
    SELECT a, b FROM arista_override
  ),
  nodo AS (
    SELECT p.id FROM persona p WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
  ),
  alcance AS (
    SELECT n.id AS origen, n.id AS alcanzado FROM nodo n
    UNION
    SELECT al.origen, ar.b FROM alcance al JOIN arista ar ON ar.a = al.alcanzado JOIN nodo n ON n.id = ar.b
  )
  SELECT origen AS persona_id, MIN(alcanzado::text)::uuid AS nucleo_id
  FROM alcance
  GROUP BY origen;
END;
$$;
