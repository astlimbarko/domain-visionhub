-- VisionHub -- KAN-401: bug real encontrado al cerrar la sesión -- el
-- titulo/descripcion del avance "Más formas de filtrar..." (migración
-- 20260920020000) quedó con mojibake (Ã¡, Ã­, etc.) porque se aplicó vía
-- PowerShell (`Get-Content -Raw | supabase db query`) sin forzar
-- `-Encoding utf8`, y el texto con tildes se corrompió en el pipeline.
-- Se corrige el texto ya insertado con la codificación correcta.
UPDATE avance
SET titulo = 'Más formas de filtrar a las personas en Membresía',
    descripcion = 'En Afirmación, Membresía de tu Casa de Paz o Supervisión, ahora se puede filtrar también por si la persona es Apóstol/Profeta/Pastor/Evangelista/Maestro, si participa en algún ministerio, si tiene un cargo de Ministro/Anciano/Diácono, y por su edad (Niños, Adolescentes, Jóvenes, Adultos, Adultos mayores). Los filtros están agrupados por categoría, con el nombre de cada grupo al lado de sus opciones.'
WHERE titulo LIKE '%formas de filtrar%';
