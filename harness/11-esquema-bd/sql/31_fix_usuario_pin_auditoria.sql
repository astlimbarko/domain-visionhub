-- Corrige huecos encontrados en el chequeo de integridad de la BD tras el
-- trabajo de fusiones/PIN (30_fusiones_y_pin.sql):
--   1) usuario_pin se creó sin las columnas de auditoría ni los disparadores
--      estándar del proyecto (00-fundacion/design.md: toda tabla nueva lleva
--      trg_auditoria_<tabla> y trg_no_delete_<tabla>).
--   2) Los disparadores de fusion_casa_de_paz usaban un nombre abreviado
--      (trg_auditoria_fusion_cdp) en vez de trg_auditoria_<tabla>. Se
--      renombran por consistencia; el comportamiento no cambia.

ALTER TABLE usuario_pin
  ADD COLUMN IF NOT EXISTS creado_por UUID,
  ADD COLUMN IF NOT EXISTS actualizado_por UUID,
  ADD COLUMN IF NOT EXISTS eliminado_por UUID,
  ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMPTZ;

DROP TRIGGER IF EXISTS trg_auditoria_usuario_pin ON usuario_pin;
CREATE TRIGGER trg_auditoria_usuario_pin
  BEFORE INSERT OR UPDATE ON usuario_pin
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

DROP TRIGGER IF EXISTS trg_no_delete_usuario_pin ON usuario_pin;
CREATE TRIGGER trg_no_delete_usuario_pin
  BEFORE DELETE ON usuario_pin
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

DROP TRIGGER IF EXISTS trg_auditoria_fusion_cdp ON fusion_casa_de_paz;
CREATE TRIGGER trg_auditoria_fusion_casa_de_paz
  BEFORE INSERT OR UPDATE ON fusion_casa_de_paz
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

DROP TRIGGER IF EXISTS trg_no_delete_fusion_cdp ON fusion_casa_de_paz;
CREATE TRIGGER trg_no_delete_fusion_casa_de_paz
  BEFORE DELETE ON fusion_casa_de_paz
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();
