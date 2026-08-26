-- VisionHub -- KAN-252 (seguimiento): pedido explícito del owner tras
-- probar el wizard en vivo -- CI, Estado civil, Ocupación, Grado de
-- instrucción y Teléfono deben ser obligatorios en el formulario de
-- Membresía para todas las iglesias (mismo criterio que ya se aplicó a
-- fecha_nacimiento, 20260825170000). CI/Ocupación/Grado ya existían como
-- flags en 'false' por defecto -- se suben a 'true'. Estado civil y
-- Teléfono son flags nuevos.

UPDATE configuracion_definicion
SET valor_defecto = 'true'
WHERE codigo IN ('MEMBRESIA_CI_OBLIGATORIO', 'MEMBRESIA_OCUPACION_OBLIGATORIO', 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO');

INSERT INTO configuracion_definicion (codigo, nombre, descripcion, tipo, valor_defecto, categoria, modulo, orden)
VALUES
  ('MEMBRESIA_ESTADO_CIVIL_OBLIGATORIO', 'Estado civil obligatorio en membresía', 'Exige el estado civil en el formulario de membresía.', 'BOOLEANO', 'true', 'FORMULARIO_MEMBRESIA', 1, 22),
  ('MEMBRESIA_TELEFONO_OBLIGATORIO', 'Teléfono obligatorio en membresía', 'Exige el teléfono en el formulario de membresía (con opción "No tiene teléfono").', 'BOOLEANO', 'true', 'FORMULARIO_MEMBRESIA', 1, 23)
ON CONFLICT (codigo) DO NOTHING;

-- Overrides existentes por iglesia (configuracion_valor) para estos 3 flags
-- ya-existentes: igual que con fecha_nacimiento, si alguna iglesia tiene su
-- propio 'false' explícito, ese override gana sobre el valor_defecto de
-- arriba -- se sube también, para que "obligatorio para todas" sea real.
ALTER TABLE configuracion_valor DISABLE TRIGGER trg_validar_configuracion;

UPDATE configuracion_valor cv
SET valor = 'true'
FROM configuracion_definicion cd
WHERE cv.definicion_id = cd.id
  AND cd.codigo IN ('MEMBRESIA_CI_OBLIGATORIO', 'MEMBRESIA_OCUPACION_OBLIGATORIO', 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
  AND cv.fecha_eliminacion IS NULL;

ALTER TABLE configuracion_valor ENABLE TRIGGER trg_validar_configuracion;
