# Matías — 2026-08-27

- [x] KAN-271: nueva feature -- editar reportes de Casa de Paz ya enviados (antes solo existía el alta). Pueden editar Líder de Red, Supervisor de Red, Líder de CdP y Sublíder de CdP, con ventana de 7 días desde la fecha de reunión
- [x] Backend: `fn_puede_editar_reporte_cdp` (rol + ventana de 7 días) reemplaza la policy de UPDATE que estaba dormida sin usarse; extendido a asistencia e ingresos (con fix de cambio de moneda al editar, para no duplicar filas)
- [x] Notificación nueva: si edita el Sublíder, avisa al Líder de esa CdP (nunca al revés), mismo patrón que ya existía para el alta
- [x] Frontend: `Reportes.tsx` ahora tiene modo edición (`/reportes/:reporteId/editar`), precarga todo lo ya guardado; botón "Editar" en Historial de Reportes (Líder/Sublíder CdP) y en la grilla de Control de Reportes (Líder/Supervisor de Red), solo dentro de la ventana de 7 días
- [x] `tsc -b`, `oxlint` y `vite build` limpios; lógica de permiso verificada contra datos reales de producción (reporte de 4 días permitido, de 13 días rechazado)
- [x] Mergeado a `master` y desplegado en producción (verificado que el bundle en vivo coincide)
- [x] Ajuste: el Sublíder de CdP no tenía acceso a "Historial de Reportes" (donde vive el botón Editar) -- se le agregó esa ruta a su navegación
- [x] Verificado que la notificación de edición Sublíder→Líder funciona (prueba controlada con roles genuinamente separados); el caso donde "no notificaba" era una cuenta que es Líder Y Sublíder a la vez de la misma CdP -- por diseño no se autonotifica (mismo criterio que KAN-240)
- [x] KAN-266: el modal "Actualiza tu membresía" (KAN-252 Parte B) le pedía teléfono/ministerios a los Super Admin -- `fn_mi_actualizacion_membresia_pendiente` no los excluía. Fix: devuelve NULL si es Super Admin (migración 20260827100000). Verificado en vivo: los 3 Super Admin dan NULL, un miembro normal sigue recibiendo el modal, y el guardado funciona bien para miembros normales (el error de guardado que veía el SA era artefacto de que el modal le aparecía indebidamente)
- [x] Auditoría multitenant de KAN-271: `fn_puede_editar_reporte_cdp` está bien acotado por iglesia/CdP/Red -- prueba cruzada en vivo confirma que un Líder de CdP no puede editar reportes de otra iglesia (puede_editar=false)
- [ ] Falta: probar en vivo en el navegador con las 4 cuentas de rol (edición de reportes) y confirmar que a los Super Admin ya no les aparece el modal, antes de pasar KAN-271/KAN-266 a Finalizada
