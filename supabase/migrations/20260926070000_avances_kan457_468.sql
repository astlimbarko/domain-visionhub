-- Avances (KAN-388) -- funcionalidades y correcciones de la sesion del
-- 2026-09-26 (PR #123 y #124), agrupadas por lo que la persona realmente
-- nota, no por ticket individual.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Casas de Paz',
  'Podés cargar reportes de semanas anteriores a tu primera reunión',
  'En Historial de Reportes, las semanas grises antes de tu primera reunión registrada ya no están bloqueadas -- tocá el círculo gris para completar ese historial si hace falta.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'Etiqueta de atraso y Cumplimiento más preciso en Historial de Reportes',
  'La lista "Reportes recientes" ahora marca con una etiqueta roja los reportes entregados tarde, con un fondo distinto para verlos de un vistazo. El indicador "Cumplimiento" pasó a medir puntualidad real (a tiempo), no solo si se mandó algo.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'Botón para salir sin guardar al editar un reporte',
  'Al modificar un reporte ya enviado, ahora hay un botón "Descartar cambios" que te avisa si tenés algo sin guardar y te deja salir sin tocar nada.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'Descarga de PDF más liviana y rápida',
  'El botón "Descargar PDF" (Historial de Reportes y dashboards) generaba archivos pesados que tardaban o fallaban en el celular. Ahora pesan mucho menos, sin perder calidad.',
  'CDP', now()
),
(
  'TERMINADO', 'Casas de Paz',
  'El PDF de Historial de Reportes incluye líder y dirección',
  'El PDF descargado desde Historial de Reportes ahora trae el nombre del líder y la dirección de la Casa de Paz en el encabezado, para identificarlo sin abrir la app.',
  'CDP', now()
),
(
  'CORRECCION', 'Casas de Paz',
  'Gestión de "reunión no realizada" más segura',
  'Al marcar "en realidad sí hubo reunión" sobre una semana no realizada, ya no se pierde esa marca si te arrepentís antes de terminar de cargar el reporte real.',
  'CDP', now()
);
