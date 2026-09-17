# Gonzalo — 2026-09-16

- [x] KAN-367: historial de cambios de reportes de CdP (tabla + trigger + RPC, solo Pastor/Supervisor)
- [x] KAN-367: ventana de "Anular" separada de "Editar", ahora en horas configurables (default 3h)
- [x] KAN-367: diálogo de confirmación fuerte + cuenta regresiva de 3s para anular
- [x] Fix: Supervisor/Pastor no podían acceder a la ruta de editar reporte (hueco en permisos.ts)
- [x] Fix: asistentes tipo "visita" invisibles al reabrir un reporte para editar
- [x] "Guardar cambios" en modo edición pasa a rojo sólido + texto blanco
- [x] Fix UX: mini-formulario de diezmante manual sin forma de cancelar -- ahora tiene botón Cancelar
- [x] Historial de cambios extendido: ahora también captura asistencia e ingresos (no solo tema/testimonios)
- [x] Confirmado: Supervisor/Pastor ya tienen entrada de navegación real a los reportes vía "Historial de Reportes" (matriz clickeable) -- no hacía falta nada nuevo
- [x] Fix: botón "Anular reporte" no chequeaba su propia ventana en horas -- ahora se oculta cuando ya pasó (antes solo se enteraba al confirmar y fallar)
- [ ] Falta: desplegar a producción y probar en vivo con usuario real Pastor/Supervisor antes de pasar KAN-367 a "En revisión"
- [x] KAN-386: buscador de temas que cruza los 13 libros (fix de condición de carrera real en la selección)
- [x] KAN-386: "Narración" (Testimonios+Comentarios) unificado en un solo campo "Testimonio"
- [x] KAN-386: lecciones reales cargadas para Libro 5 y Libro 9 (104 temas, estaban vacíos)
- [x] KAN-386: fondo con más contraste (toda la app), botón "agregar persona" más visible, Disertador reubicado, Enviar centrado
- [ ] Falta: desplegar KAN-386 a producción y probar con usuario real
