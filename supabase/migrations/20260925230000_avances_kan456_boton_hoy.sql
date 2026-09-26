-- Avances (KAN-388) -- corrección visual menor del botón "Hoy" agregado
-- en KAN-451, quedaba más bajo que el campo Fecha.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Casas de Paz',
  'Botón "Hoy" prolijo junto al campo Fecha',
  'En el Reporte de CdP, el botón "Hoy" (al lado del campo Fecha de la reunión) ahora tiene la misma altura que el campo de fecha, en los 3 tipos de reporte (normal, semana sin reunión y Megafiesta).',
  'CDP', now()
);
