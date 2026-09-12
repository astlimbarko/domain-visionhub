# Gonzalo — 2026-09-12

- [x] KAN-365: investigación completa de la demora en filtros de Membresía -- descartado `retry`, descartada la vista ampliada (solo 18ms de diferencia real medido con EXPLAIN ANALYZE), descartado el tamaño de página (ya es de a 50, achicarlo empeoraría por más viajes de red). Conclusión: latencia de red real Bolivia↔Canadá, no optimizable desde el código
- [x] Spinner de percepción: el botón de KPI que se toca reemplaza su ícono por un `Spinner` (componente ya existente) mientras esa consulta puntual está en vuelo, en vez de solo atenuar toda la tabla -- rama `feature/spinner-boton-filtro-membresia`, pusheada
- [x] Bug real encontrado en vivo por el owner y corregido el mismo día: el spinner se quedaba pegado girando cuando la respuesta llegaba instantánea de caché (React Query nunca ponía `isFetching` en `true`) -- fix: exigir `isFetching` real en el momento del render, no solo el último filtro tocado
- [x] Verificado en vivo por el owner ("quedó genial, super elegante")
