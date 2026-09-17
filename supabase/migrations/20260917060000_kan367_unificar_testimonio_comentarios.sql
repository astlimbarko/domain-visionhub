-- VisionHub -- KAN-367 (pedido explicito del owner, 2026-09-17):
-- El reporte de CdP tenia 2 campos de texto libre (Testimonios y
-- Comentarios) bajo la seccion "Narracion". Se unifican en un solo campo
-- ("Testimonio") en el frontend -- el owner pide que se cuente como
-- testimonio lo que Dios hizo en la reunion, no un dato suelto aparte.
--
-- No se toca la columna casa_de_paz_reporte.comentarios (43 de 163
-- reportes ya tienen algo ahi) -- se deja tal cual para no perder datos
-- historicos, el frontend simplemente deja de escribirle y la muestra
-- unificada dentro de "Testimonio" al editar un reporte que la tenia.
--
-- Lo unico que se toca en la base es desactivar el toggle de config
-- "Comentarios obligatorios en el reporte" (REPORTE_COMENTARIOS_OBLIGATORIO):
-- ninguna iglesia lo tenia activado (confirmado antes de tocar nada), pero
-- si se deja activo va a seguir apareciendo en el panel de Supervision como
-- una opcion para un campo que ya no existe en el formulario.

begin;

update public.configuracion_definicion
set fecha_eliminacion = now(), activo = false
where codigo = 'REPORTE_COMENTARIOS_OBLIGATORIO' and fecha_eliminacion is null;

commit;
