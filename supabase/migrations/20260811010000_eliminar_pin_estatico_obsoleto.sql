-- VisionHub -- limpieza del PIN estatico viejo (2026-08-10, pedido del owner).
-- El commit 62992c5 (2026-07-30) reemplazo el PIN fijo guardado de
-- antemano por el codigo de 6 digitos por correo (usuario_otp,
-- fn_generar_otp/fn_verificar_otp/fn_exigir_pin) y ya habia sacado del
-- frontend la seccion "PIN de Super Admin" y los servicios
-- establecerPin/tengoPin -- pero nunca se borraron los restos del lado de
-- la base: la tabla usuario_pin (1 fila vieja, sin ninguna otra tabla
-- referenciandola) y las funciones fn_verificar_pin/fn_establecer_pin.
-- Confirmado hoy: ningun codigo actual (frontend ni funciones SQL) las usa.
DROP FUNCTION IF EXISTS fn_verificar_pin(text);
DROP FUNCTION IF EXISTS fn_establecer_pin(text);
DROP TABLE IF EXISTS usuario_pin;
