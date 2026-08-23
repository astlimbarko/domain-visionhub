# Gonzalo — 2026-08-22

- [x] Limpieza de base de datos: eliminé a rojasnely627@gmail.com (alta en iglesia de prueba equivocada) y a mariajulietavm2020@gmail.com (invitación huérfana sin persona) para volver a añadirlas manualmente
- [x] Diseñé y aprobé el flujo unificado de invitación de líderes (KAN-246): confirmar antes de asignar si el correo ya existe (antes solo Red lo hacía, Casa de Paz/Departamento asignaban en silencio) + botón Cancelar/Reenviar invitación pendiente en los paneles de Casa de Paz y Departamento (antes solo en Red)
- [x] Implementado en `feature/invitacion-lider-flujo-unificado`: Edge Function `invitar-lider` + 5 archivos de frontend + `otp_expiry` de 3 a 5 días
- [x] Probado en vivo en Centro de Vida Génesis (iglesia de prueba) con test@somoscdv.com: invitación nueva real, "ya existe/confirmar" (envioskian@gmail.com), y cancelar/reenviar (niukaoj@gmail.com) — los 3 casos funcionaron
- [x] Extendí lo mismo al Constructor (el lienzo visual, distinto de los paneles de menú) — mismo bug ahí también, corregido y probado en vivo haciendo clic en los nodos
- [x] Edge Function y `otp_expiry` (3→5 días) ya desplegados en Supabase (afecta a las 3 iglesias, sin tocar datos existentes)
- [x] Mergeado KAN-246 a `master` (PR #35). Al compilar para producción salió un bug real de tipos (rompía `npm run build`, no se veía en dev) — corregido y mergeado aparte (PR #36). Build de `frontend/dist/` generado y limpio; falta que Matías lo suba a `somoscdv.com`
- [x] Diagnosticado: Matías dice tener un "2do Supervisor de Red" en una rama local `new_frontend` que nunca pusheó a ningún remoto (ni origin ni forks) — probablemente merge directo a su propio master local. Pendiente que la pushee
- [ ] Pendiente: investigar el bug real reportado en Centro de Vida 4 Anillo (sublíder no se elimina al hacer clic en X) — probar solo en iglesia de prueba, nunca en 4 Anillo
