# Gonzalo — 2026-09-18

- [x] KAN-387: confirmado que no se gradúa ninguna iglesia satélite por ahora, plan de roles cruzados queda en Jira para cuando se decida hacerlo
- [x] Verificado en código: visitas/membresía cruzada y designar líderes entre iglesia madre-satélite ya funcionan bidireccional; ver lista completa de Personas de la otra iglesia es asimétrico a propósito (solo madre ve al satélite) -- confirmado que se queda así
- [x] Jaqueline Justiniano: agregado rol Pastor en Centro de Vida Montero (además de Supervisor de la Visión en Acción, que se mantiene en ambas iglesias -- confirmado que así debe ser)
- [x] Análisis completo de UI de Membresía/Afirmación: ficha de persona tiene 3 pasos anidados (resumen→extendido→editor) en vez de 1 modal con toggle reducida/ampliada; confirmación de guardado solo en Identidad y censo, no en las otras 7 secciones -- plan entregado, no implementado
- [x] KAN-401: columna de cumpleaños de la semana (ícono + tooltip) y filtro Día/Semana/Mes en la tabla de Membresía (se ve en Afirmación, Membresía por CdP y Supervisión) -- código completo, 5 commits progresivos, tsc/lint limpios
- [x] KAN-401: verificado en vivo (Playwright, Afirmación y Membresía por CdP) -- encontrados y corregidos 2 bugs reales: callejón sin salida con 0 resultados (la tabla y su select de Cumpleaños desaparecían, sin forma de volver a ver a todos) y mensaje de "CdP vacía" engañoso cuando en realidad era el filtro
- [x] KAN-401: encontrado y limpiado un overload viejo de fn_afirmacion_buscar_membresia que había quedado duplicado en la base; agregada la entrada obligatoria en /avances
- [x] KAN-401: PR #88 mergeado a master -- deploy a producción diferido a propósito (pedido explícito del owner, "no despliegues todavía")
- [ ] UI de ficha de persona (modal único + confirmación uniforme): análisis entregado, sin implementar
- [ ] KAN-401: falta el deploy real a producción
