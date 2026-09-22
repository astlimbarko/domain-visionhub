-- VisionHub -- KAN-402 seguimiento: entrada obligatoria en /avances
-- (CLAUDE.md, sección "Avances de VisionHub") para el fix de precarga del
-- anuncio de inicio de sesión (2026-09-20). CORRECCION porque ya está
-- desplegado en el código de esta rama y es un arreglo de algo que el
-- usuario podía notar, no una funcionalidad nueva en curso.
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo)
VALUES (
  'CORRECCION',
  'Cuentas',
  'El anuncio de inicio de sesión ya no aparece "a saltos"',
  'Cuando hay un anuncio activo, al iniciar sesión ahora aparece completo desde el primer instante -- antes se veía primero el fondo oscuro y un momento después la imagen, dando la sensación de que algo se estaba cargando de más.',
  'GLOBAL'
);
