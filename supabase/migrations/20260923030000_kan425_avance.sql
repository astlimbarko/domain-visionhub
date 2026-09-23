-- KAN-425: entrada obligatoria en /avances (CLAUDE.md) -- antes, invitar
-- de nuevo a alguien cuyo alta anterior quedó a medias era un callejón sin
-- salida para cualquier admin (Líder de Red, Pastor, Supervisor); ahora se
-- resuelve solo con el mismo botón de siempre.

begin;

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo)
VALUES (
  'CORRECCION',
  'Estructura organizacional',
  'Invitar de nuevo a alguien cuya cuenta quedó a medias ya no da error',
  'Si invitás a una persona por correo y su alta anterior había quedado incompleta (por ejemplo, se canceló una invitación por error), antes el sistema mostraba un error y pedía avisar al equipo técnico. Ahora, al tocar "Invitar" con el mismo correo, el sistema lo resuelve solo: le llega un correo para que restablezca su contraseña y complete su registro.',
  'GLOBAL'
);

commit;
