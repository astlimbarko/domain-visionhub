-- Avances (KAN-388) -- KAN-485: portal intermedio de Colaborar
-- (Departamento -> Colaboraciones). El PR se mergea con esta entrada para no
-- mergear funcionalidad visible sin su publicacion en /avances.
-- Se agrega ahora aunque el deploy este en pausa: la entrada se aplica junto
-- con el portal en el proximo deploy, asi no aparece sola ni tarde.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'Entrar a Colaborar ahora es elegir en un portal de tarjetas',
  'Al canjear un código de colaboración ya no se abre directo un formulario. Ahora aparece un portal: primero elegís el departamento (hoy Afirmación) y después la colaboración que querés trabajar (Altar, Bautismo, Retiro de Sanidad Interior o Membresía). Desde cualquiera de ellas volvés al portal con un botón, sin cerrar sesión. Altar ya se puede usar; las otras tres colaboraciones aparecen como "Próximamente".',
  'AFIRMACION', now()
);
