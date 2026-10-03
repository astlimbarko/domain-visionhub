-- Avances (KAN-388): acceso de responsables sin cuenta + ajustes de la ficha de
-- Casa de Paz (2026-10-03). Se agrega con el merge; se aplica en el próximo deploy.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Estructura',
  'Ahora podés dar acceso a un líder o sublíder que todavía no tiene cuenta',
  'En el organigrama, al abrir una Casa de Paz, Red o Departamento, cada responsable muestra ahora su correo debajo del nombre y una acción según su situación: si ya tiene cuenta, "Restablecer contraseña"; si todavía no tiene cuenta, el botón "Dar acceso" le crea una con la contraseña 12345678 (la persona la cambia al entrar) sin duplicar su registro. Así los sublíderes que nunca pudieron entrar ya pueden hacerlo.',
  'AFIRMACION', now()
),
(
  'CORRECCION', 'Estructura',
  'El botón de líder/anfitrión ahora dice "Editar"',
  'En la ficha de Casa de Paz, Red y Departamento, el botón para abrir los datos de un responsable ya asignado pasó de decir "Cambiar" a "Editar".',
  'AFIRMACION', now()
);
