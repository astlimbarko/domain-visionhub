-- Avances (KAN-388) -- funcionalidad nueva de la sesión: gestionar una
-- "reunión no realizada" ya cargada (KAN-450, agregado después de la
-- tanda inicial de avances de hoy).

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Casas de Paz',
  'Corregir o deshacer una "reunión no realizada"',
  'En Historial de Reportes, tocá una burbuja gris (semana marcada como "no hubo reunión") dentro de los días que tenés para editar -- se abre un menú para corregir el motivo/fecha, o para avisar que en realidad sí hubo reunión y pasar directo a cargar el reporte completo de esa fecha.',
  'CDP', now()
);
