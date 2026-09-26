-- Avances visibles para /avances (KAN-388) -- funcionalidad con efecto
-- perceptible entregada en la sesión del 2026-09-25 sobre el Reporte de
-- Casa de Paz. Alcance CDP: lo usa quien llena el reporte semanal
-- (Líder/Sub-líder de Casa de Paz).

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Casas de Paz',
  'Datos de contacto en el reporte semanal',
  'En el Reporte de CdP, arriba del formulario, ahora ves quién lo está llenando y la dirección de la Casa de Paz -- útil para confirmar que estás en el reporte correcto antes de cargar datos.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'Edad y estado espiritual visibles en toda la Asistencia',
  'En Reportes > Asistencia, las 3 listas (nuevos, regulares, niños) y el buscador ahora muestran siempre la edad y el estado (Simpatizante/Nuevo Convertido/Creyente/Reconciliado) de cada persona -- antes solo aparecía en algunos lugares. Si la persona es Nuevo Convertido o Reconciliado, también ves su teléfono ahí mismo, para el seguimiento pastoral.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'Corregir el estado espiritual de alguien a mano',
  'Al tocar a una persona en Asistencia se abre su ficha rápida -- ahí hay 3 botones (SIM/NC/CRE) para corregir su estado si quedó mal registrado, por ejemplo si en verdad aceptó a Cristo y no quedó marcado como Nuevo Convertido.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'Conteo de Asistencia separado por mayores y niños',
  'En Reportes, la sección Asistencia ahora dice "X personas... + Y niños" en vez de un solo número mezclado -- así de un vistazo sabés cuántos son mayores de 12 años y cuántos niños.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'El buscador de Asistencia ahora encuentra visitas de tu iglesia hermana',
  'Si tu Casa de Paz es madre o satélite de otra, el buscador de Asistencia del Reporte ahora también encuentra a las personas de esa iglesia hermana, para poder marcarles asistencia cuando visitan.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'La fecha del reporte ya no viene precargada',
  'Al abrir Reportes, el campo "Fecha de la reunión" arranca vacío (con un botón "Hoy" al lado para completarla rápido) -- antes venía con la fecha de hoy puesta sola, lo que a veces mostraba un aviso confuso de "se restauró tu borrador" sin que hubieras cargado nada.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'Botones de "Guardar" centrados',
  'Los botones "Guardar semana sin reunión" y "Enviar reporte de Megafiesta" quedaban pegados a la izquierda -- ahora están centrados como el resto de los botones del formulario.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'El botón "+" para agregar persona nueva avisa antes de perder datos',
  'En Reportes > Asistencia, si tocás "+" para agregar una persona nueva y después lo volvés a tocar para cerrarlo, ahora te avisa si vas a perder datos que ya escribiste, en vez de cerrarse solo.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'Color más claro para "Reunión no realizada" en el calendario',
  'En Historial de Reportes, las burbujas del calendario que marcan una semana sin reunión (justificada) cambiaron a un gris oscuro, más fácil de distinguir del resto de colores.',
  'CDP', now()
);
