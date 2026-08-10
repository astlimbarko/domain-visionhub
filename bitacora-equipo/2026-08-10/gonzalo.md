# Gonzalo — 2026-08-10

- [x] Auditoría completa KAN-152 (aislamiento multi-tenant, resolución de rol/iglesia activa) — Finalizada en Jira
- [x] Fix: contexto de rol persistido reactivaba el rol de la sesión anterior en cada login nuevo, sin dejar elegir otro
- [x] Fix: al crear una iglesia nueva no se sembraban los 4 Departamentos ni `estructura_organigrama` (trigger nuevo)
- [x] Reparadas 3 iglesias reales existentes que tenían ese mismo gap (Sion, 4 Anillo, Guabira)
- [x] Aplicadas las 3 migraciones de KAN-135 que quedaban preparadas de antes, con un bug real corregido en el camino (`solicitud_estructura`)
- [x] Fix: menú de cuenta mostraba el cargo por prioridad fija en vez del rol activo real (KAN-73) — sin verificar en navegador (MCP desconectado)
- [x] Revisadas cuentas Super Admin creadas por INSERT manual (astlimbark, Daniel, Matías) — sin inconsistencias funcionales, solo falta el dato de auditoría de quién las creó
- [x] `CLAUDE.md`: 2 reglas nuevas (comentar en Jira antes de pasar de ticket; actualizar memoria al cerrar cada tarea)
- [x] KAN-154: rol Super Admin Secundario (astlimbark queda como principal; Daniel/Matías/test@somoscdv.com quedan como secundarios) — código listo y aplicado a la BD real, falta probar en vivo en el navegador
- [x] Nueva acción "Eliminar cuenta" en el panel de Super Admin (limpieza de cuentas de prueba, borra todos los cargos + personas de una cuenta de una vez)
- [x] Check "Iglesia raíz" en Nueva Iglesia (crear iglesia sin madre, antes no había forma en la UI aunque la BD ya lo soportaba)
- [ ] Confirmado con `git merge-tree`: mergear esta rama a master NO es seguro todavía (conflicto real en `AppShell.tsx` con el trabajo de Matías, KAN-86) — ver memoria
- [ ] Todo en rama `codex/refactorizacion-multirol`, sin mergear a master todavía
- [ ] Pendiente: probar en vivo en el navegador lo de hoy (MCP de Playwright desconectado toda la sesión) — crear iglesia raíz + asignar Pastor con OTP real a test@somoscdv.com en Iglesia Sion
