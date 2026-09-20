# Gonzalo — 2026-09-20

- [x] KAN-401 seguimiento: bug real corregido -- al abrir cualquier filtro de columna (Cumpleaños/Red/CdP/Estado) el ancho de la página se corría ~10px (Radix compensaba una scrollbar que en este proyecto vive en `<html>`, no en `<body>`), anulado en `index.css`
- [x] KAN-401 seguimiento: filtro Cumpleaños sin opción "Todos" (no tenía sentido conceptual), arranca sin filtrar (no oculta a nadie por defecto), encabezado de columna centrado, ícono de torta ~10% más grande
- [x] KAN-401 seguimiento: 4 categorías de filtro nuevas en Membresía -- Efesios, Ministerios, Cargos (Ministro/Anciano/Diácono), Edad (mismos rangos que ya usa el dashboard) -- 26 chips en total, reorganizados en 8 categorías compactas
- [x] Backend: `fn_afirmacion_buscar_membresia` y `fn_afirmacion_estadisticas_personas` extendidas para soportar los filtros nuevos, migración aplicada a la base real
- [x] Se sacaron los chips "Por URL"/"Por formulario" a pedido del owner
- [x] Diseño compacto: título de categoría en la misma línea que sus chips, categorías colapsadas por defecto en celular (toque para abrir), siempre visibles en tablet/desktop -- verificado en vivo en ambos tamaños
- [ ] Pendiente (en cola, "al final de todo"): el difuminado de fondo del modal de anuncio de inicio de sesión aparece unas milésimas antes que la imagen -- debe aparecer junto, no antes
- [ ] Sin desplegar a producción todavía (KAN-403/404 completos, incluido lo de hoy)
