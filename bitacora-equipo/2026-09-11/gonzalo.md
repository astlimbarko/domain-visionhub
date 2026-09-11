# Gonzalo — 2026-09-11

- [x] KAN-361 seguimiento: filtro de Estado en el encabezado de Membresía verificado en vivo (Playwright) contra producción -- narrowing server-side confirmado por red y por conteo de filas
- [x] KAN-362: las 14 tarjetas de KPI de arriba de Membresía (Hombres/Mujeres, Por URL/formulario, Estado, Con profesión, Estado civil) pasan a ser botones de filtro -- toggle, combinables entre sí y con Red/Casa de Paz/Estado del encabezado
- [x] Auditoría de categorías de KPI faltantes: se sumó tarjeta nueva "Bautizados" (única categoría adicional sin ambigüedad). Descartado `rango_miembro` como tarjeta -- tiene un valor "Creyente" que colisiona en nombre con el Estado "Creyente" (CRE) ya existente, serían dos conceptos distintos con el mismo texto en pantalla. Cargos de CdP/Red no se duplican como tarjeta porque ya son columna en la tabla
- [x] `fn_afirmacion_buscar_membresia` suma p_sexo/p_via_registro/p_con_profesion/p_estado_civil/p_bautizado; `fn_afirmacion_estadisticas_personas` suma conteo de bautizados -- 2 migraciones aplicadas a producción
- [x] Verificado en vivo: click individual y combinado narrowing correctamente el total server-side; build de producción (Docker) limpio
