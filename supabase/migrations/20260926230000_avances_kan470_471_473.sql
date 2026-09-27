-- Avances (KAN-388) -- funcionalidades de la sesion del 2026-09-26
-- (PR #127 y #128), quedaron sin registrar en el momento del merge.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Casas de Paz',
  'Aviso del calendario de reportes más claro',
  'En Historial de Reportes, el mensaje de arriba del calendario ahora explica por separado dos cosas: que el número de cada círculo es la semana del año, y cuántos días tenés para modificar un reporte ya enviado.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'Semana y edición rápida en "Reportes recientes"',
  'Cada reporte de la lista "Reportes recientes" ahora muestra a qué semana del año corresponde, y se puede tocar en cualquier parte de la fila (no solo un ícono) para abrirlo y modificarlo, dentro del plazo permitido.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'Etiqueta de atraso mejor ubicada en "Reportes recientes"',
  'La etiqueta roja de "días de atraso" se movió debajo del resumen de asistencia de cada reporte, para que se lea de forma más ordenada.',
  'CDP', now()
);
