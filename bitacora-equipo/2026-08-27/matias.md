# Matías — 2026-08-27

- [x] KAN-271: nueva feature -- editar reportes de Casa de Paz ya enviados (antes solo existía el alta). Pueden editar Líder de Red, Supervisor de Red, Líder de CdP y Sublíder de CdP, con ventana de 7 días desde la fecha de reunión
- [x] Backend: `fn_puede_editar_reporte_cdp` (rol + ventana de 7 días) reemplaza la policy de UPDATE que estaba dormida sin usarse; extendido a asistencia e ingresos (con fix de cambio de moneda al editar, para no duplicar filas)
- [x] Notificación nueva: si edita el Sublíder, avisa al Líder de esa CdP (nunca al revés), mismo patrón que ya existía para el alta
- [x] Frontend: `Reportes.tsx` ahora tiene modo edición (`/reportes/:reporteId/editar`), precarga todo lo ya guardado; botón "Editar" en Historial de Reportes (Líder/Sublíder CdP) y en la grilla de Control de Reportes (Líder/Supervisor de Red), solo dentro de la ventana de 7 días
- [x] `tsc -b`, `oxlint` y `vite build` limpios; lógica de permiso verificada contra datos reales de producción (reporte de 4 días permitido, de 13 días rechazado)
- [x] Mergeado a `master` y desplegado en producción (verificado que el bundle en vivo coincide)
- [ ] Falta: probar en vivo en el navegador con las 4 cuentas de rol (no tuve acceso al navegador en esta sesión) antes de pasar KAN-271 a Finalizada
