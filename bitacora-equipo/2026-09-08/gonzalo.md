# Gonzalo — 2026-09-08

- [x] Reporte: demora real en la cuenta de Líder de Evangelismo + "Personas evangelizadas" se sentía trabada sin spinner -- investigado y corregido
- [x] Bug real encontrado: `EvangelismoSupervisorVista.tsx` pedía `fn_evangelismo_red` DOS veces por cada Red activa (una para "Tendencia" de 12 meses, otra para el resumen del mes en pantalla, mismo dato recortado) -- con varias Redes eran hasta 4×N idas y vueltas a la base en paralelo. Mismo patrón que ya se había corregido hoy en `fn_alertas_supervisor` (20260908010000, otra sesión). Fix en el frontend: el resumen mensual ahora se deriva del mismo dato de Tendencia en vez de una llamada aparte.
- [x] Bug real encontrado: "Personas evangelizadas" al cambiar de página/filtro solo bajaba la opacidad al 60%, sin spinner -- se sentía como que no respondía. Agregado spinner explícito, mismo patrón que ya usa el dashboard principal.
- [x] Verificado en vivo (viewport real, cuenta "Test TodosLosRoles"): banner, KPIs, anillo "Evangelizados por Red", Tendencia y drill-down de "Resumen semanal" todos con datos reales correctos, sin regresión
- [x] `tsc -b` y lint limpios en ambos archivos
- [x] Rama nueva `fix/evangelismo-rendimiento-y-spinner` (la anterior ya estaba mergeada a master), pusheada a origin -- **sin mergear todavía**, falta aprobación del owner
- [x] Verificado que el paginador de "Personas evangelizadas" funciona (probado bajando POR_PAGINA a 3 temporalmente, revertido después) -- "Mostrando X–Y de Z", botón siguiente avanza bien
- [x] Verificado que el menú "Filtros" (mobile) abre bien con Red/CdP/Tipo
- [x] KAN-350 (filtro por Evangelizador): implementado -- reusa `BuscadorPersona` (buscador existente) en vez de un `<select>` con todos los miembros, ya que el evangelizador puede ser cualquiera de la iglesia, no un catálogo chico. Popover en el encabezado de la tabla (desktop) + campo en el Sheet "Filtros" (mobile). Migración `20260908030000` aplicada a producción (nuevo parámetro `p_evangelizado_por_id` en `fn_buscar_evangelizados`), verificada en vivo (16→0→16 al aplicar/quitar)
- [x] Bug real encontrado y corregido de paso: con 0 resultados, la tabla entera (con los selects de filtro adentro) desaparecía y no había forma de sacar el filtro sin recargar -- el encabezado ahora siempre se muestra
- [x] Bug real encontrado y corregido: el header nuevo de "Evangelizado por" se partía en 2 líneas (le faltaba `flex` al botón, a diferencia de los `<select>` de al lado)
- [ ] Pendiente en KAN-350: filtros clickeables desde la fila (Red/Evangelizador/Tipo), filtro por semana, "Esta semana" como default
