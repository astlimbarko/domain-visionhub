# Gonzalo — 2026-08-22

- [x] Limpieza de base de datos: eliminé a rojasnely627@gmail.com (alta en iglesia de prueba equivocada) y a mariajulietavm2020@gmail.com (invitación huérfana sin persona) para volver a añadirlas manualmente
- [x] Diseñé y aprobé el flujo unificado de invitación de líderes (KAN-246): confirmar antes de asignar si el correo ya existe (antes solo Red lo hacía, Casa de Paz/Departamento asignaban en silencio) + botón Cancelar/Reenviar invitación pendiente en los paneles de Casa de Paz y Departamento (antes solo en Red)
- [x] Implementado en `feature/invitacion-lider-flujo-unificado`: Edge Function `invitar-lider` + 5 archivos de frontend + `otp_expiry` de 3 a 5 días
- [x] Probado en vivo en Centro de Vida Génesis (iglesia de prueba) con test@somoscdv.com: invitación nueva real, "ya existe/confirmar" (envioskian@gmail.com), y cancelar/reenviar (niukaoj@gmail.com) — los 3 casos funcionaron
- [x] Extendí lo mismo al Constructor (el lienzo visual, distinto de los paneles de menú) — mismo bug ahí también, corregido y probado en vivo haciendo clic en los nodos
- [x] Edge Function y `otp_expiry` ya desplegados en Supabase (afecta a las 3 iglesias, sin tocar datos existentes)
- [ ] `otp_expiry` de 3→5 días: bloqueado por el permiso automático al intentar el PATCH scoped a Supabase, falta reintentar
- [x] Decidido explícitamente: por ahora queda en la rama `feature/invitacion-lider-flujo-unificado`, sin mergear a master — KAN-246 en "En revisión" hasta que se decida el merge + deploy del frontend
- [ ] Pendiente: investigar el bug real reportado en Centro de Vida 4 Anillo (sublíder no se elimina al hacer clic en X) — probar solo en iglesia de prueba, nunca en 4 Anillo
