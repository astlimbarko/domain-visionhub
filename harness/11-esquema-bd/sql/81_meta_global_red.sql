-- VisionHub -- 81_meta_global_red.sql
-- Bloque 4 del pedido del owner (2026-08-02): "Metas Globales" del Líder de
-- Red -- un único objetivo para TODA la red en un período, distinto de las
-- metas que el Líder de Red ya le asigna a cada CdP individual
-- (meta_evangelismo_asignada, casa_de_paz_id NOT NULL, AsignarMetaRedDialog).
--
-- Esto es exactamente lo que 99-modulos-futuros.md ya dejaba anotado como
-- pendiente del Módulo 2: "Metas por red e iglesia | Extender
-- meta_evangelismo_asignada con ámbito, igual que evento." Se sigue ese
-- mismo patrón (evento: casa_de_paz_id/red_id nullable + CHECK de ámbito
-- exclusivo) en vez de crear una tabla nueva.

ALTER TABLE meta_evangelismo_asignada
  ALTER COLUMN casa_de_paz_id DROP NOT NULL,
  ADD COLUMN red_id UUID REFERENCES red(id),
  ADD CONSTRAINT chk_meta_asignada_ambito CHECK ((casa_de_paz_id IS NOT NULL)::int + (red_id IS NOT NULL)::int = 1);

CREATE INDEX idx_meta_asignada_red ON meta_evangelismo_asignada (red_id) WHERE fecha_eliminacion IS NULL;

-- Exclusion aparte para el ambito RED: la que ya existe (casa_de_paz_id) no
-- detecta solapamiento entre filas con casa_de_paz_id NULL, porque el
-- operador de igualdad nunca matchea NULL = NULL.
ALTER TABLE meta_evangelismo_asignada
  ADD CONSTRAINT excl_meta_asignada_red_solapada EXCLUDE USING gist (
    red_id WITH =, daterange(fecha_inicio, fecha_fin, '[]') WITH &&
  ) WHERE (fecha_eliminacion IS NULL AND red_id IS NOT NULL);

-- pol_meta_asignada_insert asumia casa_de_paz_id siempre presente
-- (fn_es_rol_superior_de_cdp lo requiere no-nulo) -- se reemplaza por una
-- version que bifurca segun el ambito de la fila.
DROP POLICY IF EXISTS pol_meta_asignada_insert ON meta_evangelismo_asignada;

CREATE POLICY pol_meta_asignada_insert ON meta_evangelismo_asignada
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_es_rol_superior_de_cdp(casa_de_paz_id))
      OR (red_id IS NOT NULL AND (fn_es_lider_de_red(red_id) OR fn_es_operativo_en(iglesia_id)))
    )
  );

-- Meta global vigente de una Red -- mismo patron de lectura directa que
-- obtenerMetaPropia (evangelismo.service.ts), pero como RPC porque hace
-- falta filtrar por vigencia (fecha_inicio/fecha_fin) ademas de red_id, y
-- PostgREST no arma ese WHERE compuesto de forma limpia contra "hoy".
CREATE OR REPLACE FUNCTION fn_meta_global_red(p_red_id UUID)
RETURNS TABLE (id UUID, meta INTEGER, fecha_inicio DATE, fecha_fin DATE, observaciones TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.meta, m.fecha_inicio, m.fecha_fin, m.observaciones
  FROM meta_evangelismo_asignada m
  WHERE m.red_id = p_red_id AND m.fecha_eliminacion IS NULL
    AND CURRENT_DATE BETWEEN m.fecha_inicio AND m.fecha_fin
  ORDER BY m.fecha_inicio DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION fn_meta_global_red(UUID) TO authenticated;
