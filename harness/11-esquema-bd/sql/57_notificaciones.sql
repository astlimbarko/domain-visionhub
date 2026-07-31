-- VisionHub -- 57_notificaciones.sql
-- Centro de notificaciones persistente: primera pieza generica de la app
-- (hoy no existe nada de esto). Nace para dos casos puntuales pedidos por el
-- owner -- (1) avisar al Lider de CdP cuando su Sublider carga un reporte,
-- (2) avisar al Lider de Red cuando el Supervisor pide una accion
-- estructural que requiere su autorizacion (ver 58_solicitudes_estructura.sql)
-- -- pero la tabla queda generica para poder sumar mas tipos despues sin
-- volver a tocar el esquema.

CREATE TABLE notificacion (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id              UUID NOT NULL REFERENCES iglesia(id),
  destinatario_persona_id UUID NOT NULL REFERENCES persona(id),
  tipo                    TEXT NOT NULL, -- 'REPORTE_SUBLIDER' | 'SOLICITUD_ESTRUCTURA' | 'SOLICITUD_RESUELTA'
  titulo                  VARCHAR NOT NULL,
  mensaje                 TEXT NOT NULL,
  entidad_tipo            TEXT,
  entidad_id              UUID,
  leida                   BOOLEAN NOT NULL DEFAULT false,
  fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_notificacion_tipo CHECK (
    tipo IN ('REPORTE_SUBLIDER', 'SOLICITUD_ESTRUCTURA', 'SOLICITUD_RESUELTA')
  )
);

CREATE INDEX idx_notificacion_destinatario ON notificacion (destinatario_persona_id, fecha_creacion DESC);
CREATE INDEX idx_notificacion_no_leidas ON notificacion (destinatario_persona_id) WHERE NOT leida;

-- Sin trigger de auditoria/no-delete: es un mensaje efimero, no un registro
-- estructural del negocio -- no aplica el mismo patron append-only del resto
-- del esquema. Marcar "leida" es la unica escritura que le cabe al cliente.

ALTER TABLE notificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_notificacion_select ON notificacion
  FOR SELECT TO authenticated
  USING (destinatario_persona_id = fn_mi_persona_id());

CREATE POLICY pol_notificacion_update ON notificacion
  FOR UPDATE TO authenticated
  USING (destinatario_persona_id = fn_mi_persona_id())
  WITH CHECK (destinatario_persona_id = fn_mi_persona_id());

-- Sin policy de INSERT: toda notificacion nace desde fn_crear_notificacion
-- (SECURITY DEFINER), llamada por otras funciones/triggers del servidor,
-- nunca insertada directamente por el cliente.

CREATE OR REPLACE FUNCTION fn_crear_notificacion(
  p_destinatario_persona_id UUID,
  p_tipo TEXT,
  p_titulo VARCHAR,
  p_mensaje TEXT,
  p_entidad_tipo TEXT DEFAULT NULL,
  p_entidad_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_destinatario_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RETURN NULL; -- destinatario invalido/eliminado: no bloquea la accion que disparo la notificacion
  END IF;

  INSERT INTO notificacion (iglesia_id, destinatario_persona_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  VALUES (v_iglesia_id, p_destinatario_persona_id, p_tipo, p_titulo, p_mensaje, p_entidad_tipo, p_entidad_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_mis_notificaciones(p_solo_no_leidas BOOLEAN DEFAULT false, p_limite INT DEFAULT 30)
RETURNS TABLE (
  id UUID, tipo TEXT, titulo VARCHAR, mensaje TEXT,
  entidad_tipo TEXT, entidad_id UUID, leida BOOLEAN, fecha_creacion TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT n.id, n.tipo, n.titulo, n.mensaje, n.entidad_tipo, n.entidad_id, n.leida, n.fecha_creacion
  FROM notificacion n
  WHERE n.destinatario_persona_id = fn_mi_persona_id()
    AND (NOT p_solo_no_leidas OR NOT n.leida)
  ORDER BY n.fecha_creacion DESC
  LIMIT p_limite;
$$;

CREATE OR REPLACE FUNCTION fn_notificaciones_no_leidas_count()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::INT FROM notificacion
  WHERE destinatario_persona_id = fn_mi_persona_id() AND NOT leida;
$$;

CREATE OR REPLACE FUNCTION fn_marcar_notificacion_leida(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE notificacion SET leida = true
  WHERE id = p_id AND destinatario_persona_id = fn_mi_persona_id();
$$;

CREATE OR REPLACE FUNCTION fn_marcar_todas_leidas()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE notificacion SET leida = true
  WHERE destinatario_persona_id = fn_mi_persona_id() AND NOT leida;
$$;

-- ============================================================
-- Reporte de Sublider -> notifica al Lider de CdP vigente
-- ============================================================
-- El reporte ya cuenta para la CdP sin importar quien lo suba (usa
-- casa_de_paz_id); esto solo agrega el aviso. crearReporte() en el frontend
-- inserta directo a casa_de_paz_reporte (no hay un fn_crear_reporte que
-- envolver), asi que el aviso se dispara con un trigger AFTER INSERT.
CREATE OR REPLACE FUNCTION fn_notificar_reporte_sublider()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_persona_id UUID := fn_mi_persona_id();
  v_es_sublider BOOLEAN;
  v_lider_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND cc.persona_id = v_actor_persona_id
      AND c.codigo = 'SUBLIDER_CDP' AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  ) INTO v_es_sublider;

  IF v_es_sublider THEN
    SELECT cc.persona_id INTO v_lider_id
    FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.casa_de_paz_id = NEW.casa_de_paz_id AND c.codigo = 'LIDER_CDP'
      AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    LIMIT 1;

    IF v_lider_id IS NOT NULL THEN
      PERFORM fn_crear_notificacion(
        v_lider_id, 'REPORTE_SUBLIDER',
        'Nuevo reporte de tu sublíder',
        'Tu sublíder cargó el reporte de la reunión del ' || to_char(NEW.fecha_reunion, 'DD/MM/YYYY'),
        'casa_de_paz_reporte', NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_reporte_sublider AFTER INSERT ON casa_de_paz_reporte
  FOR EACH ROW EXECUTE FUNCTION fn_notificar_reporte_sublider();
