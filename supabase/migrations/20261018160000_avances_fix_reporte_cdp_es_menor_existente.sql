-- Avances: fix de reportes de Casa de Paz que se enviaban y desaparecían solos (2026-10-18).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Casas de Paz',
  'Los reportes de Casa de Paz ya no desaparecen solos al enviarlos',
  'Si entre los presentes había alguien ya registrado sin fecha de nacimiento cargada, el reporte se enviaba y desaparecía sin aviso claro, obligando a reintentar varias veces. Ahora, si falta esa fecha, se abre el cartel "¿es menor?" para esa persona antes de enviar, y el reporte queda guardado a la primera.',
  'CDP', now()
);
