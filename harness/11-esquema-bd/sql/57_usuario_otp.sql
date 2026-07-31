-- VisionHub -- 57_usuario_otp.sql
-- 15-gestion-administrativa, Panel 1. Reemplaza el PIN estatico de Super Admin
-- (usuario_pin, 30_fusiones_y_pin.sql) por un codigo de un solo uso (OTP)
-- enviado por correo en el momento de la accion sensible. usuario_pin y sus
-- funciones quedan deprecadas (no se dropean todavia, ver OQ-OTP-PIN) pero
-- fn_exigir_pin (58_otp_verificacion.sql) deja de usarlas.

CREATE TABLE usuario_otp (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES auth.users(id),
  codigo_hash    TEXT NOT NULL,
  proposito      VARCHAR(60) NOT NULL DEFAULT 'ACCION_SENSIBLE',
  expira_en      TIMESTAMPTZ NOT NULL,
  usado_en       TIMESTAMPTZ,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sin RLS con policies para `authenticated` a proposito -- mismo patron que
-- usuario_pin: todo acceso pasa por RPC SECURITY DEFINER (fn_generar_otp,
-- fn_verificar_otp), nunca por PostgREST directo.
ALTER TABLE usuario_otp ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_usuario_otp_usuario ON usuario_otp (usuario_id, fecha_creacion DESC);
