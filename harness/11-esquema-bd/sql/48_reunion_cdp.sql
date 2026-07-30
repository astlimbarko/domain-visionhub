-- ============================================================
-- 48 · Día y hora de reunión de la Casa de Paz
-- ------------------------------------------------------------
-- El "Perfil de Casa de Paz" (frontend) muestra y edita el día/hora de la
-- reunión semanal. Antes no existían como dato: se agregan dos columnas
-- nullables en casa_de_paz (una CdP recién creada todavía no las tiene) y una
-- función de perfil que junta red vigente + estado + fecha de apertura + esos
-- dos campos en una sola llamada, para no armar joins frágiles en el cliente.
--
-- La ESCRITURA de dia_reunion/hora_reunion NO necesita RPC: la política
-- pol_casa_de_paz_update (24_permisos_meta_propia.sql) ya permite al Líder de
-- CdP (y roles superiores) hacer UPDATE directo sobre casa_de_paz, igual que
-- toggleActivoCdp en el frontend.
-- ============================================================

ALTER TABLE casa_de_paz
  ADD COLUMN IF NOT EXISTS dia_reunion  SMALLINT
    CHECK (dia_reunion BETWEEN 0 AND 6),   -- 0=domingo … 6=sábado (getDay() de JS)
  ADD COLUMN IF NOT EXISTS hora_reunion TIME;

-- ------------------------------------------------------------
-- fn_mi_cdp_perfil: resumen del perfil de una CdP propia.
-- Visible para Líder, Sublíder y roles superiores (Supervisor/Pastor) de la
-- CdP. SECURITY DEFINER para poder leer el nombre de la Red vigente sin que la
-- RLS de red/casa_de_paz_red complique el join.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_mi_cdp_perfil(p_casa_de_paz_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'PERFIL_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT (
       fn_es_lider_cdp(p_casa_de_paz_id)
    OR fn_es_sublider_cdp(p_casa_de_paz_id)
    OR fn_es_rol_superior_de_cdp(p_casa_de_paz_id)
  ) THEN
    RAISE EXCEPTION 'PERFIL_FUERA_DE_ALCANCE: sin cargo vigente en la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'nombre',         fn_etiqueta_cdp(c.id),
      'activo',         c.activo,
      'fecha_creacion', c.fecha_creacion,
      'dia_reunion',    c.dia_reunion,
      'hora_reunion',   c.hora_reunion,
      'red_nombre', (
        SELECT r.nombre
        FROM casa_de_paz_red cdr
        JOIN red r ON r.id = cdr.red_id
        WHERE cdr.casa_de_paz_id = c.id
          AND cdr.fecha_fin IS NULL
          AND cdr.fecha_eliminacion IS NULL
        ORDER BY cdr.fecha_inicio DESC
        LIMIT 1
      )
    )
    FROM casa_de_paz c
    WHERE c.id = p_casa_de_paz_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_mi_cdp_perfil(UUID) TO authenticated;
