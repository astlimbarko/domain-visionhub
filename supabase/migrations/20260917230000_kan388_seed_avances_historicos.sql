-- VisionHub -- KAN-388 (2026-09-17): carga inicial de avances históricos
-- reales, pedido explícito del owner para probar la pantalla con contenido
-- real (no inventado) -- extraído de bitacora-equipo/ (Gonzalo + Matías,
-- 2026-08-20 a 2026-09-16) y verificado contra la fuente antes de cargar.
-- Fechas de publicación puestas al mediodía hora Bolivia del día real en
-- que se hizo cada cosa (no la fecha de hoy).

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
('TERMINADO', 'Afirmación', 'Nuevo panel de Membresía en Afirmación', 'Ya se puede ver quién se registró por enlace o por formulario interno, con una tabla de personas con búsqueda y un censo de cargos (Ministro, Diácono, Mentor, etc.).', 'AFIRMACION', '2026-08-20 16:00:00-04'),
('TERMINADO', 'Afirmación', 'Ficha de persona con 3 vistas', 'Cada ficha ahora tiene un resumen rápido, una vista completa de solo lectura, y un modo de edición con confirmación antes de guardar.', 'AFIRMACION', '2026-08-21 16:00:00-04'),
('TERMINADO', 'Cuentas', 'El formulario de membresía ya no se repite sin sentido', 'Si tenías más de un cargo, antes te lo podía pedir varias veces y algunos cargos quedaban sin activar. Ahora se completa una sola vez y activa todo lo pendiente.', 'GLOBAL', '2026-08-21 16:05:00-04'),
('TERMINADO', 'Casas de Paz', 'Botón para eliminar invitaciones pendientes', 'Líder y Supervisor de Red ya pueden cancelar una invitación pendiente directo desde el panel.', 'RED', '2026-08-21 16:10:00-04'),
('TERMINADO', 'Cuentas', 'Mostrar/ocultar contraseña', 'Los campos de contraseña ahora tienen el ícono del ojo para ver lo que escribiste.', 'GLOBAL', '2026-08-21 16:15:00-04'),
('TERMINADO', 'Estructura organizacional', 'El Constructor ya está disponible para Líder y Supervisor de Red', 'Antes solo lo veían Pastor y Supervisor de la Visión en Acción -- ahora pueden ver y editar su propia Red desde ahí.', 'RED', '2026-08-21 16:20:00-04'),
('TERMINADO', 'Estructura organizacional', 'Ahora se pueden tener 2 Supervisores de Red a la vez', 'Antes el Constructor solo permitía asignar uno.', 'RED', '2026-08-21 16:25:00-04'),
('TERMINADO', 'Cuentas', 'Forma más segura de recuperar el acceso a tu cuenta', 'Si perdiste el acceso, ahora se te puede asignar una contraseña temporal directa, sin depender de un enlace por correo que puede vencer.', 'GLOBAL', '2026-09-04 16:00:00-04'),
('TERMINADO', 'Evangelismo', 'Nuevo Departamento de Evangelismo', 'Ya existe un rol y panel propio para el Departamento de Evangelismo, con alcance sobre toda la iglesia.', 'GLOBAL', '2026-09-05 16:00:00-04'),
('TERMINADO', 'Evangelismo', 'Filtro por quién evangelizó', 'En la lista de evangelizados ahora hay un filtro para buscar por la persona que evangelizó.', 'EVANGELISMO', '2026-09-08 16:00:00-04'),
('TERMINADO', 'Evangelismo', 'Tabla y reportes de evangelizados con mejor diseño', 'La tabla y los archivos exportados (CSV/PDF) ahora muestran más datos (teléfono, edad, quién evangelizó) de forma más clara.', 'EVANGELISMO', '2026-09-08 16:05:00-04'),
('TERMINADO', 'Cuentas', 'Foto de perfil', 'Ya podés subir tu propia foto de perfil desde tu Cuenta, con recorte y ajuste antes de guardar.', 'GLOBAL', '2026-09-08 16:10:00-04'),
('TERMINADO', 'Anuncios', 'Los anuncios cargan más rápido', 'Las imágenes de los anuncios ahora se optimizan al mostrarse, sin esperar a que baje el archivo completo.', 'GLOBAL', '2026-09-09 16:00:00-04'),
('CORRECCION', 'Casas de Paz', 'Invitaciones duplicadas corregidas', 'Se corrigió un problema real que afectó cuentas reales al reintentar una invitación -- ahora avisa en vez de duplicar.', 'RED', '2026-09-13 16:00:00-04'),
('TERMINADO', 'Casas de Paz', 'Reportes editables con calendario visual', 'El calendario de reportes ahora es clickeable, con aviso de cuánto tiempo queda para poder editar un reporte ya enviado.', 'CDP', '2026-09-14 16:00:00-04');
