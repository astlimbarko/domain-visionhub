-- VisionHub -- KAN-401: entrada obligatoria en /avances (CLAUDE.md, sección
-- "Avances de VisionHub") para los filtros nuevos de Membresía.
-- EN_CURSO a propósito -- la rama todavía no está mergeada ni desplegada;
-- pasar a TERMINADO recién cuando esté en producción real.
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo)
VALUES (
  'EN_CURSO',
  'Afirmación',
  'Más formas de filtrar a las personas en Membresía',
  'En Afirmación, Membresía de tu Casa de Paz o Supervisión, ahora se puede filtrar también por si la persona es Apóstol/Profeta/Pastor/Evangelista/Maestro, si participa en algún ministerio, si tiene un cargo de Ministro/Anciano/Diácono, y por su edad (Niños, Adolescentes, Jóvenes, Adultos, Adultos mayores). Los filtros están agrupados por categoría, con el nombre de cada grupo al lado de sus opciones.',
  'AFIRMACION'
);
