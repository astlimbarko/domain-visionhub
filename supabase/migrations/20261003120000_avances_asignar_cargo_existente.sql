-- Avances (KAN-388): fixes de asignación de cargos de estructura (2026-10-03).
-- Se agrega con el merge; se aplica en el próximo deploy junto con la
-- funcionalidad (deploy en pausa).

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Estructura',
  'Ahora se puede nombrar sublíder/anfitrión a alguien que ya está registrado',
  'En el organigrama (Estructura organizacional), al abrir una Casa de Paz o una Red y usar "+ Añadir" sublíder (o cambiar el anfitrión/encargado), ya se puede elegir a una persona que YA existe en el sistema. Antes daba "No se pudo asignar el cargo" y solo dejaba invitar a alguien nuevo por correo. Funciona para quien administra la iglesia (Pastor, Supervisor y Super Admin), no solo para el líder de esa Red.',
  'AFIRMACION', now()
),
(
  'CORRECCION', 'Estructura',
  'Ya no aparece "Reenviar invitación" en personas que no tienen invitación',
  'En el panel de cada Casa de Paz, Red y Departamento, el botón "Reenviar invitación" aparecía también para responsables que ya estaban en el sistema (no tenían ninguna invitación pendiente), lo que confundía. Ahora "Reenviar invitación" se muestra solo cuando de verdad hay una invitación sin aceptar. A quien ya tiene cuenta se le ofrece "Restablecer contraseña".',
  'AFIRMACION', now()
);
