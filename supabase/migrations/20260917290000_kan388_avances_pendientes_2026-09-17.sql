-- VisionHub -- KAN-388 (2026-09-17): completar /avances con funcionalidades
-- reales que quedaron sin su entrada tras la carga inicial -- 3 del trabajo
-- de hoy (Membresía por CdP, graduar Satélite a Hija, calendario de
-- reportes) + 3 del 2026-09-16 (historial de cambios + ventana de anular +
-- buscador de temas de Reportes), que la carga histórica no había cubierto
-- porque el último ítem cargado de Casas de Paz era del 2026-09-14.
-- Revisado: no se listan acá los fixes 100% internos sin cara visible para
-- el usuario final (seguridad cruzada de roles KAN-251, validación KAN-397,
-- motor de estados KAN-395).

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
  ('TERMINADO', 'Casas de Paz', 'Historial de cambios en los reportes', 'Pastor y Supervisor de la Visión en Acción ahora pueden ver qué se modificó en un reporte ya enviado (asistencia, ingresos, tema) y cuándo se hizo el cambio.', 'SUPERVISION', '2026-09-16 21:00:00-04'),
  ('TERMINADO', 'Casas de Paz', 'Anular un reporte enviado, con confirmación', 'Si un reporte se cargó por error, ahora se puede anular por separado de editarlo, con una confirmación clara y dentro de un tiempo límite en horas.', 'CDP', '2026-09-16 21:05:00-04'),
  ('TERMINADO', 'Casas de Paz', 'Buscador de temas y testimonio unificado en los reportes', 'El buscador de temas ya encuentra los 13 libros de estudio, el campo de testimonio quedó unificado en uno solo, y ya están cargadas todas las lecciones de los Libros 5 y 9 que antes estaban vacíos.', 'CDP', '2026-09-16 21:10:00-04'),
  ('TERMINADO', 'Casas de Paz', 'Nuevo panel de Membresía para tu Casa de Paz', 'El Líder y Sublíder de Casa de Paz ya pueden ver y completar los datos de las personas de su Casa de Paz que quedaron con información incompleta, igual que ya se podía hacer desde Afirmación.', 'CDP', now()),
  ('CORRECCION', 'Casas de Paz', 'Mejoras visuales en el calendario de reportes', 'El color que marca una reunión no realizada ahora es distinto al del porcentaje de cumplimiento para no confundirlos, y en el celular el calendario ya no se corta en dos líneas.', 'CDP', now()),
  ('TERMINADO', 'Estructura organizacional', 'Convertir una Iglesia Satélite en Iglesia Hija', 'El Pastor de la iglesia madre (o el Super Admin) ya puede graduar una Iglesia Satélite a Iglesia Hija con un clic desde el Constructor, y revertirlo si hace falta.', 'SUPERVISION', now());
