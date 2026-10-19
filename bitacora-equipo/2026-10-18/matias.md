# Matías — 2026-10-18

- [x] Investigué por qué Herland Soliz (Yeshua), Mariana Urquidi (Kairos) y Mayuf Roque (Apostólica) no podían enviar su reporte de CdP — sus datos propios estaban bien, el bloqueo era un bug real
- [x] Causa: `fn_validar_asistencia` rechaza el reporte entero si un asistente sin fecha de nacimiento no tiene "es menor" resuelto; el frontend solo validaba eso para visitas nuevas, no para asistentes ya existentes (ej. al restaurar un borrador)
- [x] Fix en `Reportes.tsx` (ambos flujos, reporte normal y Megafiesta): encola al asistente faltante y abre el modal antes de enviar, en vez de fallar en el backend y revertir en silencio
- [x] Mergeado a `master`, pusheado a origin
- [x] Avances agregado (migración `20261018160000`, tipo CORRECCION) y aplicado en producción
- [x] Deploy a producción por SSH (backup `public_deploy_backup_20261018_234858`), verificado: hash de bundle coincide, rutas SPA responden 200
- [ ] Falta: confirmar en vivo con Herland, Mariana y Mayuf que ya pueden enviar su reporte
- [ ] Falta: ticket de Jira (OAuth de Atlassian sigue bloqueado, igual que la vez anterior)
