# Gonzalo — 2026-09-20

- [x] KAN-401 seguimiento: bug real corregido -- al abrir cualquier filtro de columna (Cumpleaños/Red/CdP/Estado) el ancho de la página se corría ~10px (Radix compensaba una scrollbar que en este proyecto vive en `<html>`, no en `<body>`), anulado en `index.css`
- [x] KAN-401 seguimiento: filtro Cumpleaños sin opción "Todos" (no tenía sentido conceptual), arranca sin filtrar (no oculta a nadie por defecto), encabezado de columna centrado, ícono de torta ~10% más grande
- [x] KAN-401 seguimiento: 4 categorías de filtro nuevas en Membresía -- Efesios, Ministerios, Cargos (Ministro/Anciano/Diácono), Edad (mismos rangos que ya usa el dashboard) -- 26 chips en total, reorganizados en 8 categorías compactas
- [x] Backend: `fn_afirmacion_buscar_membresia` y `fn_afirmacion_estadisticas_personas` extendidas para soportar los filtros nuevos, migración aplicada a la base real
- [x] Se sacaron los chips "Por URL"/"Por formulario" a pedido del owner
- [x] Diseño compacto: título de categoría en la misma línea que sus chips, categorías colapsadas por defecto en celular (toque para abrir), siempre visibles en tablet/desktop -- verificado en vivo en ambos tamaños
- [x] KAN-401 seguimiento: chips de filtro activos con color sólido y texto blanco (antes solo un anillo) -- se sienta más claro cuál filtro está prendido
- [x] Fix real corregido: el difuminado de fondo del anuncio de inicio de sesión aparecía unas milésimas antes que la imagen -- se precarga la imagen real antes de montar el modal, ahora aparecen juntos
- [x] Conteo "X personas encontradas" pegado a la barra de búsqueda (antes suelto en su propia línea) + tooltip del ícono de cumpleaños con la fecha en 2 líneas, y ahora también se abre con clic en PC (antes solo hover)
- [x] Verificado que el combo Mujeres+Con profesión (mostraba 1 persona) es matemáticamente correcto, no un bug -- solo 1 de las 3 personas con profesión es mujer
- [ ] Último bloque (conteo pegado a la búsqueda + tooltip 2 líneas/clic en PC) quedó SIN verificar en vivo -- Playwright se desconectó a mitad de la prueba y no volvió a conectar en esta sesión. `tsc`/lint limpios.
- [ ] Sin desplegar a producción todavía (KAN-401/403/404 completos, incluido lo de hoy)
