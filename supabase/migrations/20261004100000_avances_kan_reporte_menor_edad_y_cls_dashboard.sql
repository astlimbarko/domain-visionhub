-- Avances: fix "¿es menor?" al editar reporte de CdP + fix de página que se mueve en el dashboard (2026-10-04).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Casas de Paz',
  'Al editar un reporte, ahora avisa bien quién falta marcar como menor',
  'Si editás un reporte de tu Casa de Paz y alguien quedó sin fecha de nacimiento y sin contestar "¿es menor?", ahora aparece el mismo cartel morado con el nombre de esa persona (contorno rojo) pidiéndolo, en vez de un error genérico que no decía quién era. Se resuelve ahí mismo y se puede seguir con el envío.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'El dashboard de Líder/Sublíder de Casa de Paz ya no "salta" en el celular',
  'En el dashboard de tu Casa de Paz (pestañas Personas y Seguimiento), los gráficos de Composición por sexo/edad, Compromiso, Seguimiento, Ministerios y Antigüedad ya no hacen que toda la pantalla se corra un instante después de abrir la página en el celular.',
  'CDP', now()
);
