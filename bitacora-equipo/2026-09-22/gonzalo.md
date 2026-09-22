# Gonzalo — 2026-09-22

- [x] Deploy manual a producción confirmado (v1.0.101): filtros de Membresía, ficha paginada, scroll superior de tabla, Mi cuenta/Membresía verificados en vivo. KAN-401/403/404/408 pasados a Finalizada.
- [x] Skill `supabase-postgres-best-practices` compartida al repo (PR #102).
- [x] KAN-418 (buscador no encontraba por nombre completo/segundo nombre) -- RPC `fn_buscar_personas_reporte`, PR #103, mergeado.
- [x] KAN-419 (Disertador/Evangelizado por priorizan CdP) -- 3 niveles CdP→Red→iglesia (pedido explícito, ajustado en vivo), PR #104/#105, mergeado.
- [x] KAN-420 (niños <12 y Nuevo Convertido) -- **incidente real**: 2 sesiones de Claude Code implementaron el mismo ticket en paralelo sin saberlo, con interpretaciones opuestas (bloquear NC vs. mostrarlo distinto). Detectado por un fork en tarea no relacionada. Corregido: un menor de 12 SÍ llega a NC, se revirtió el bloqueo, se reparó el caso real afectado (Valentina Panozo, 6 años), y se agregó la etiqueta "NC" en la zona de niños del reporte. PR #106, mergeado.
- [x] Investigación completa de Colaboraciones (KAN-405) vs. flujo esperado -- sin implementar, documento de 9 secciones entregado. Sin riesgos de seguridad reales encontrados (vencimiento protegido en BD). Pendiente de tu revisión/aprobación.
- [ ] KAN-421 (simplificar checkboxes de asistencia) -- código listo, tsc limpio, PR #107 abierta SIN mergear: falta verificación visual en vivo (el navegador dejó de responder antes de poder confirmar con captura).
- [ ] KAN-422 (modal de fecha de nacimiento obligatoria en asistencia CdP) -- sin empezar.
- [ ] KAN-423 (testimonios múltiples por categoría + "Qué se desató en la CdP") -- sin empezar.
- [ ] Sesión cortada por reinicio de la computadora -- retomar con KAN-421 (verificar en vivo, mergear) y seguir con KAN-422/423.
