-- VisionHub -- evangelismo_testimonio_elite.sql
-- KAN pendiente: pestana nueva en Evangelismo de CdP para cargar milagros o
-- testimonios, solo de evangelizados de tipo Elite (pedido del owner,
-- 2026-09-10). Texto libre, sin distincion milagro/testimonio (una sola
-- entrada), asociado siempre a un evangelizado puntual -- no se edita ni se
-- borra desde el frontend (registro historico), mismo criterio que el resto
-- de tablas de este modulo (trg_no_delete bloquea el DELETE fisico igual).

CREATE TABLE evangelismo_testimonio (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id          UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id      UUID NOT NULL REFERENCES casa_de_paz(id),
  evangelismo_id      UUID NOT NULL REFERENCES evangelismo(id),
  texto               TEXT NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_evangelismo_testimonio_texto CHECK (btrim(texto) <> '')
);

CREATE INDEX idx_evangelismo_testimonio_cdp ON evangelismo_testimonio (casa_de_paz_id) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_evangelismo_testimonio_evangelismo ON evangelismo_testimonio (evangelismo_id) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_evangelismo_testimonio BEFORE INSERT OR UPDATE ON evangelismo_testimonio FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_evangelismo_testimonio BEFORE DELETE ON evangelismo_testimonio FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- El evangelizado tiene que existir, pertenecer a la MISMA Casa de Paz que se
-- manda en el insert, y tener tipo_evangelismo Elite -- validado por codigo
-- (estable), no por nombre (editable). No se puede expresar con un simple
-- CHECK porque necesita mirar otra tabla.
CREATE OR REPLACE FUNCTION fn_validar_evangelismo_testimonio_elite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cdp_id UUID;
  v_tipo_codigo VARCHAR;
BEGIN
  SELECT e.casa_de_paz_id, te.codigo INTO v_cdp_id, v_tipo_codigo
  FROM evangelismo e
  LEFT JOIN tipo_evangelismo te ON te.id = e.tipo_evangelismo_id
  WHERE e.id = NEW.evangelismo_id AND e.fecha_eliminacion IS NULL;

  IF v_cdp_id IS NULL THEN
    RAISE EXCEPTION 'EVANGELISMO_TESTIMONIO_SIN_EVANGELIZADO: el evangelizado no existe'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_cdp_id IS DISTINCT FROM NEW.casa_de_paz_id THEN
    RAISE EXCEPTION 'EVANGELISMO_TESTIMONIO_CDP_DISTINTA: el evangelizado no pertenece a esta Casa de Paz'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tipo_codigo IS DISTINCT FROM 'ELITE' THEN
    RAISE EXCEPTION 'EVANGELISMO_TESTIMONIO_SOLO_ELITE: solo se pueden cargar testimonios de evangelismo tipo Elite'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_evangelismo_testimonio_elite
  BEFORE INSERT ON evangelismo_testimonio
  FOR EACH ROW EXECUTE FUNCTION fn_validar_evangelismo_testimonio_elite();

ALTER TABLE evangelismo_testimonio ENABLE ROW LEVEL SECURITY;

-- Mismo alcance que pol_evangelismo_select (16_rls.sql): cualquiera de la
-- misma iglesia, no acotado a la CdP -- ya es el criterio existente para el
-- resto de datos de evangelismo.
CREATE POLICY pol_evangelismo_testimonio_select ON evangelismo_testimonio
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

-- Mismo permiso que ya tiene el resto de Evangelismo para cargar (Lider y
-- Sublider vigente de la CdP, o rol operativo de la iglesia) -- fn_puede_reportar_cdp.
CREATE POLICY pol_evangelismo_testimonio_insert ON evangelismo_testimonio
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

-- Sin UPDATE/DELETE por decision del owner (2026-09-10): queda como registro
-- historico, no editable ni borrable desde el frontend.
