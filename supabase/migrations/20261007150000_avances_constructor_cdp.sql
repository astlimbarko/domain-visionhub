-- Avances (KAN-388): mejoras del panel de Casa de Paz en el Constructor (2026-10-07).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Estructura',
  'El horario de reunión de la Casa de Paz ahora se ve en el organigrama',
  'En el Constructor, al abrir una Casa de Paz, la sección "Horario de reunión" ahora muestra el día y la hora que estén guardados (antes decía "Horario pendiente" aunque ya estuviera configurado). Tocá "Editar" para cambiarlo; queda registrado el historial de cambios.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Estructura',
  'Cambiar al Líder de una Casa de Paz es más claro, con historial',
  'En el panel de la Casa de Paz, el botón del Líder y del Anfitrión dice "Añadir" si no hay nadie y "Editar" si ya hay alguien. Al editar, el cuadro muestra solo a la persona actual con una X para quitarla (para poner otra, primero se quita la actual). Y hay un "Ver historial de líderes" que lista quién lideró la CdP, desde cuándo y quién lo designó.',
  'AFIRMACION', now()
);
