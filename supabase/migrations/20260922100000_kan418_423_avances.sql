-- VisionHub -- entradas obligatorias en /avances (CLAUDE.md, sección
-- "Avances de VisionHub") para los 6 tickets de observaciones de Casa de
-- Paz cerrados el 2026-09-22 (KAN-418 a KAN-423).

begin;

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo)
VALUES
  (
    'CORRECCION',
    'Casas de Paz',
    'El buscador de "Evangelizado por" ahora encuentra por nombre completo',
    'En el reporte de Casa de Paz, al buscar a quién evangelizó a una visita ya podés escribir el nombre y el apellido juntos -- antes solo encontraba resultados si escribías una sola palabra.',
    'CDP'
  ),
  (
    'TERMINADO',
    'Casas de Paz',
    'Los buscadores de Disertador y "Evangelizado por" ahora priorizan tu Casa de Paz',
    'Al buscar quién enseñó o quién evangelizó, el sistema busca primero entre los miembros de tu propia Casa de Paz, luego en tu Red, y recién si no aparece nadie, en toda la iglesia -- así encontrás a la persona correcta más rápido.',
    'CDP'
  ),
  (
    'CORRECCION',
    'Casas de Paz',
    'Los niños menores de 12 años ya muestran correctamente la etiqueta "NC"',
    'En la sección de asistencia de niños del reporte de Casa de Paz, ahora se ve la etiqueta "NC" (Nuevo Convertido) cuando corresponde, igual que en la sección de mayores.',
    'CDP'
  ),
  (
    'TERMINADO',
    'Casas de Paz',
    'Los checkboxes de asistencia se simplificaron a un botón "RE" y un menú de opciones',
    'En la lista de asistentes del reporte de Casa de Paz, en vez de dos casilleros separados ahora hay un botón "RE" para marcar Reunión Especial y un menú de tres puntos (⋮) con "Asiste a esta CDP" -- mismo resultado, menos clics.',
    'CDP'
  ),
  (
    'TERMINADO',
    'Casas de Paz',
    'Si no sabés la fecha de nacimiento exacta de alguien, ahora te lo pide al marcarlo presente',
    'Al marcar la asistencia de alguien sin fecha de nacimiento registrada, aparece una ventana para cargarla -- si todavía no la sabés, podés tocar "Aún se desconoce" e indicar la edad aproximada, y el sistema te la va a volver a pedir más adelante.',
    'CDP'
  ),
  (
    'TERMINADO',
    'Casas de Paz',
    'Ahora podés cargar varios testimonios por categoría en el reporte de Casa de Paz',
    'En la sección Testimonios del reporte, además de contar en general qué pasó en la reunión ("¿Qué se desató en la CdP?"), podés agregar testimonios puntuales con su categoría (Finanzas, Sanidad o Restauración) y, si querés, indicar quién lo contó -- buscando a la persona si es de la iglesia, o escribiendo su nombre si es alguien externo.',
    'CDP'
  );

commit;
