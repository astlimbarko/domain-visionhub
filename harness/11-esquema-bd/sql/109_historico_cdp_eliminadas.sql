-- VisionHub -- 109_historico_cdp_eliminadas.sql
-- KAN-34: vista "Histórico Anual" de Casas de Paz eliminadas (soft-delete),
-- filtrable por año -- hoy una CdP eliminada (fn_eliminar_cdp) desaparece
-- del todo del sistema, sin ninguna forma de consultarla despues.
--
-- 1) casa_de_paz.motivo_eliminacion: no existia ningun lugar para registrar
--    por que se elimino una CdP. fn_eliminar_cdp pasa a aceptar un motivo
--    opcional (parametro nuevo al final, con default NULL -- no rompe a
--    ningun caller existente que la invoque con un solo argumento).
-- 2) fn_historico_cdp_eliminadas: lista las CdP eliminadas de una iglesia
--    (opcionalmente acotado a una Red y/o a un anio de eliminacion), con su
--    red y lider "historicos" -- casa_de_paz_red y casa_de_paz_cargo son
--    tablas de vigencia (fecha_inicio/fecha_fin), asi que la fila vigente al
--    momento de la eliminacion (fn_eliminar_cdp no las cierra) ya identifica
--    la red/lider que tenia esa CdP. "usuario" se resuelve via
--    persona.usuario_id -> auth.users.id (mismo patron que fn_mi_persona_id).
--
-- Mismo criterio de permisos que fn_listar_cdp (27_permisos_estructura.sql):
-- SECURITY DEFINER filtrado por p_iglesia_id, sin chequeo interno de rol --
-- el frontend solo pasa la iglesia activa del usuario autenticado, igual que
-- el resto de las funciones de este modulo.
--
-- NO aplicada contra la base real (sin CLI de Supabase disponible en esta
-- sesion) -- pendiente de aplicar, igual que 100/101/107/108.

ALTER TABLE casa_de_paz ADD COLUMN motivo_eliminacion TEXT;

CREATE OR REPLACE FUNCTION fn_eliminar_cdp(p_casa_de_paz_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM casa_de_paz WHERE id = p_casa_de_paz_id AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: esa casa de paz no existe o ya fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_rol_superior_de_cdp(p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'CDP_ELIMINAR_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_casa_de_paz_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz
  SET activo = false, fecha_eliminacion = now(), motivo_eliminacion = NULLIF(btrim(p_motivo), '')
  WHERE id = p_casa_de_paz_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_historico_cdp_eliminadas(p_iglesia_id UUID, p_anio INT DEFAULT NULL, p_red_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, etiqueta TEXT, red_nombre VARCHAR, lider_nombre TEXT,
  fecha_creacion TIMESTAMPTZ, fecha_eliminacion TIMESTAMPTZ,
  eliminado_por_nombre TEXT, motivo_eliminacion TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    fn_etiqueta_cdp(c.id) AS etiqueta,
    r.nombre AS red_nombre,
    (SELECT fn_nombre_completo(p) FROM persona p
     JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
     JOIN cargo ca ON ca.id = cc.cargo_id
     WHERE cc.casa_de_paz_id = c.id AND ca.codigo = 'LIDER_CDP'
       AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL LIMIT 1) AS lider_nombre,
    c.fecha_creacion,
    c.fecha_eliminacion,
    (SELECT fn_nombre_completo(p) FROM persona p WHERE p.usuario_id = c.eliminado_por LIMIT 1) AS eliminado_por_nombre,
    c.motivo_eliminacion
  FROM casa_de_paz c
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
    AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE c.iglesia_id = p_iglesia_id AND c.fecha_eliminacion IS NOT NULL
    AND (p_anio IS NULL OR EXTRACT(YEAR FROM c.fecha_eliminacion) = p_anio)
    AND (p_red_id IS NULL OR cdr.red_id = p_red_id)
  ORDER BY c.fecha_eliminacion DESC;
$$;
