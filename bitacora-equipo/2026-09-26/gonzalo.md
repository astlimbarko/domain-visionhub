# Gonzalo — 2026-09-26

- [x] PR #121 y #122 mergeados a master (integración KAN-438 a 456)
- [x] Auditadas ~80 ramas del repo buscando PRs sueltos -- ninguna real quedó sin mergear (2 parecían huérfanas, investigadas y descartadas: una cerrada a propósito, otra ya integrada por otro camino)
- [x] Descubierto: el deploy automático a producción (GitHub Actions) nunca funcionó ni una sola vez desde que se creó (14/09) -- 33/33 corridas fallidas por bloqueo de facturación de la cuenta de GitHub. Deploy real a producción queda EN PAUSA a pedido explícito del owner hasta que resuelva la facturación
- [x] KAN-457: "en realidad sí hubo reunión" ya no borra la marca de "no realizada" al confirmar -- se difiere hasta que se envía el reporte real (evita perder la marca si es un click por error)
- [x] KAN-458: reset del formulario tras enviar un reporte volvía a precargar "hoy" y dejaba Libro/Tema/Disertador/Ofrendas sin limpiar -- corregido en los 3 formularios
- [x] KAN-459: etiqueta roja de atraso ("X días de atraso") en la lista "Reportes recientes"
- [x] KAN-461 (bug real): PDF de dashboards pesaba hasta 13 MB (PNG sin comprimir) -- cambiado a JPEG, ahora ~283 KB sin pérdida visible
- [x] KAN-462 → KAN-466: "% Cumplimiento" redefinido para exigir puntualidad, no solo envío -- reveló un bug real más profundo: "reunión no realizada" se colaba como reporte entregado en Semanas con reporte/Racha/Cumplimiento (Historial de Reportes y Dashboard Líder de CdP). Corregido con caso límite manejado (semana con reporte real + marca perdida no se excluye)
- [x] KAN-463: PDF de Historial de Reportes ahora lleva encabezado con líder + dirección, solo en el documento (mecanismo nuevo `data-pdf-solo`, reusable)
- [x] KAN-464: botón "Descartar cambios" al editar un reporte -- bug real encontrado y corregido en el camino (precarga de asistentes ya existentes se contaba como cambio sin guardar)
- [x] KAN-465: semanas anteriores a la primera reunión real de una CdP ya no quedan bloqueadas para siempre -- se pueden completar retroactivamente, sin cambiar su color gris (ajustado en vivo a pedido del owner)
- [x] PR #123 (KAN-457/458/459/461/462) mergeado a master
- [x] PR #124 (KAN-463/464/465/466) abierto contra master, sin mergear -- pendiente de que el owner lo revise
- [x] 2 corridas de QA en vivo con agente Urías (fork), en paralelo con el trabajo de Jira/bitácora
- [ ] Cola: buscador de diezmante en Finanzas, "franja blanca" sin reproducir, pregunta OpenCode sin responder, deploy real a producción (bloqueado por facturación de GitHub)
