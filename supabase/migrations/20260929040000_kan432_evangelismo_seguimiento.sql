-- KAN-432: seguimiento/contacto de una persona evangelizada. No existia
-- ninguna tabla de seguimiento/contacto en el esquema (0 resultados sobre
-- %seguimiento%/%contacto% en information_schema.tables al investigar,
-- 2026-09-29) -- tabla nueva real, N filas por `evangelismo_id`, sin
-- limite (el "1 de 2 contactos" del boceto evangelismo3.jpeg es solo un
-- ejemplo, no una regla -- confirmado en KAN-431/432).
--
-- Mismo patron RLS que persona_evangelista/persona_proceso_afirmacion:
-- ENABLE sin policies para `authenticated`, todo por RPC SECURITY
-- DEFINER.
CREATE TYPE evangelismo_seguimiento_medio_enum AS ENUM ('WHATSAPP', 'LLAMADA', 'VISITA');

CREATE TABLE evangelismo_seguimiento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evangelismo_id      UUID NOT NULL REFERENCES evangelismo(id),
  fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT now(),
  medio               evangelismo_seguimiento_medio_enum NOT NULL,
  notas               TEXT,
  registrado_por      UUID REFERENCES persona(id),
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por          UUID REFERENCES auth.users(id),
  fecha_actualizacion TIMESTAMPTZ,
  actualizado_por     UUID REFERENCES auth.users(id),
  fecha_eliminacion   TIMESTAMPTZ,
  eliminado_por       UUID REFERENCES auth.users(id)
);

CREATE INDEX ix_evangelismo_seguimiento_evangelismo
  ON evangelismo_seguimiento (evangelismo_id, fecha_hora DESC) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_evangelismo_seguimiento
  BEFORE INSERT OR UPDATE ON evangelismo_seguimiento FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_evangelismo_seguimiento
  BEFORE DELETE ON evangelismo_seguimiento FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE evangelismo_seguimiento ENABLE ROW LEVEL SECURITY;

-- Registrar un contacto -- "Contactar ahora" (WhatsApp/llamada) abre el
-- enlace externo desde el frontend pero NUNCA llama a este RPC solo: el
-- Evangelista tiene que volver y confirmar explicitamente (Requisito 7
-- AC4, ya confirmado en requirements.md).
CREATE OR REPLACE FUNCTION public.fn_evangelista_registrar_seguimiento(
  p_evangelismo_id UUID,
  p_medio evangelismo_seguimiento_medio_enum,
  p_notas TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_evangelista_id UUID := fn_mi_persona_id();
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM evangelismo WHERE id = p_evangelismo_id AND evangelizado_por_id = v_evangelista_id AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'EVANGELISTA_SEGUIMIENTO_SIN_PERMISO: ese registro no pertenece a este Evangelista' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO evangelismo_seguimiento (evangelismo_id, medio, notas, registrado_por)
  VALUES (p_evangelismo_id, p_medio, NULLIF(btrim(coalesce(p_notas, '')), ''), v_evangelista_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_evangelista_historial_seguimiento(p_evangelismo_id UUID)
RETURNS TABLE (id UUID, fecha_hora TIMESTAMPTZ, medio evangelismo_seguimiento_medio_enum, notas TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_evangelista_id UUID := fn_mi_persona_id();
BEGIN
  -- `id` a secas es ambiguo aca -- RETURNS TABLE declara `id` como columna
  -- de salida, que plpgsql trata como variable en todo el cuerpo de la
  -- funcion. Hay que calificar con el alias de la tabla (ev.id), a
  -- diferencia de fn_evangelista_registrar_seguimiento (RETURNS UUID, sin
  -- esa colision) que sí puede usar `id` sin calificar.
  IF NOT EXISTS (
    SELECT 1 FROM evangelismo ev WHERE ev.id = p_evangelismo_id AND ev.evangelizado_por_id = v_evangelista_id AND ev.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'EVANGELISTA_SEGUIMIENTO_SIN_PERMISO: ese registro no pertenece a este Evangelista' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT s.id, s.fecha_hora, s.medio, s.notas
  FROM evangelismo_seguimiento s
  WHERE s.evangelismo_id = p_evangelismo_id AND s.fecha_eliminacion IS NULL
  ORDER BY s.fecha_hora DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_evangelista_registrar_seguimiento(UUID, evangelismo_seguimiento_medio_enum, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_evangelista_historial_seguimiento(UUID) TO authenticated;
