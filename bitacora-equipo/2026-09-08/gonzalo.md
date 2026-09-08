# Gonzalo — 2026-09-08

- [x] Reporte: demora real en la cuenta de Líder de Evangelismo + "Personas evangelizadas" se sentía trabada sin spinner -- investigado y corregido
- [x] Bug real encontrado: `EvangelismoSupervisorVista.tsx` pedía `fn_evangelismo_red` DOS veces por cada Red activa (una para "Tendencia" de 12 meses, otra para el resumen del mes en pantalla, mismo dato recortado) -- con varias Redes eran hasta 4×N idas y vueltas a la base en paralelo. Mismo patrón que ya se había corregido hoy en `fn_alertas_supervisor` (20260908010000, otra sesión). Fix en el frontend: el resumen mensual ahora se deriva del mismo dato de Tendencia en vez de una llamada aparte.
- [x] Bug real encontrado: "Personas evangelizadas" al cambiar de página/filtro solo bajaba la opacidad al 60%, sin spinner -- se sentía como que no respondía. Agregado spinner explícito, mismo patrón que ya usa el dashboard principal.
- [x] Verificado en vivo (viewport real, cuenta "Test TodosLosRoles"): banner, KPIs, anillo "Evangelizados por Red", Tendencia y drill-down de "Resumen semanal" todos con datos reales correctos, sin regresión
- [x] `tsc -b` y lint limpios en ambos archivos
- [x] Rama nueva `fix/evangelismo-rendimiento-y-spinner` (la anterior ya estaba mergeada a master), 1 commit, pusheada a origin -- **sin mergear todavía**, falta aprobación del owner
