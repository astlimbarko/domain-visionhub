-- VisionHub -- KAN-403: entrada obligatoria en /avances (CLAUDE.md, sección
-- "Avances de VisionHub") para el rediseño de la ficha de persona.
-- EN_CURSO a propósito -- el PR todavía no está mergeado ni desplegado;
-- pasar a TERMINADO recién cuando esté en producción real.
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo)
VALUES (
  'EN_CURSO',
  'Casas de Paz',
  'Ficha de persona más simple: todo en un solo lugar, ordenada por páginas',
  'En Afirmación, Membresía de tu Casa de Paz o Supervisión, al hacer clic en una persona ahora se abre un solo cuadro con toda su información, dividida en páginas (con botones Atrás/Siguiente) en vez de tener que buscar en varios paneles. El botón "Editar" habilita los campos; los cambios se guardan todos juntos con el botón "Actualizar" al final.',
  'CDP'
);
