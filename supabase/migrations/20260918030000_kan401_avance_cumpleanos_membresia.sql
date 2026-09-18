-- VisionHub -- KAN-401: entrada obligatoria en /avances (CLAUDE.md, sección
-- "Avances de VisionHub") para el ícono + filtro de cumpleaños en Membresía.
-- EN_CURSO a propósito -- la rama todavía no está mergeada ni desplegada;
-- pasar a TERMINADO recién cuando esté en producción real.
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo)
VALUES (
  'EN_CURSO',
  'Casas de Paz',
  'Aviso de cumpleaños de la semana en Membresía',
  'En la tabla de Membresía (Afirmación, tu Casa de Paz o Supervisión), vas a ver un ícono de torta junto a la edad de quien cumple años esta semana -- pasá el mouse o tocalo para ver el día exacto. Arriba de esa columna podés cambiar el filtro a Día, Semana, Mes, o "Cumpleaños" para ver a todos de nuevo.',
  'CDP'
);
