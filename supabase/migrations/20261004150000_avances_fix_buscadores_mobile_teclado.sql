-- Avances: fix de buscadores desplegables que perdían el tap en celular con el teclado abierto (2026-10-04).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Casas de Paz',
  'Los buscadores de personas ya no "se traban" en el celular',
  'En Reportes de Casa de Paz (buscar un asistente, un disertador, un tema) y en otros buscadores similares, tocar un resultado de la lista con el teclado abierto a veces no hacía nada, como si el campo solo quisiera que sigas escribiendo. Ahora el toque se registra bien a la primera.',
  'CDP', now()
);
