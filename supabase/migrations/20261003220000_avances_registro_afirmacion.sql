-- Avances (KAN-388): pestaña "Registro" de Afirmación (2026-10-03).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'En "Registro" ahora todos ven a toda la gente y quién la registró',
  'La pestaña que antes se llamaba "Datos" (en Altar, Bautismo, RSIL y Form. de Membresía) ahora se llama "Registro". Cualquier colaborador de Afirmación ve a TODAS las personas registradas de su iglesia (antes cada uno veía solo las suyas) y una columna muestra qué colaborador registró a cada persona. Además hay un botón de papelera para eliminar un registro duplicado (pide confirmación; borra solo ese registro, no a la persona).',
  'AFIRMACION', now()
);
