-- VisionHub -- KAN-264 (2026-09-17): entrada en /avances por normalizar
-- automáticamente mayúsculas/minúsculas de nombre y apellido al salir del
-- campo (onBlur), en los 5 lugares donde se cargan/editan (Membresía
-- obligatoria, formulario público, alta desde Afirmación, ficha de persona,
-- y el mini-formulario de "agregar persona nueva" del reporte de Casa de
-- Paz) -- alcance GLOBAL porque toca formularios usados por todos los
-- roles, no solo uno.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
  ('TERMINADO', 'Cuentas', 'Nombres y apellidos se prolijan solos al escribirlos', 'Ya no importa si escribís todo en mayúscula o minúscula (o tenés el Bloq Mayús activado): al salir del campo, el nombre queda con la primera letra en mayúscula, respetando apellidos compuestos como "de la Cruz" o "del Castillo".', 'GLOBAL', now());
