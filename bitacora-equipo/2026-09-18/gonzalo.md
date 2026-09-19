# Gonzalo — 2026-09-18

- [x] KAN-387: confirmado que no se gradúa ninguna iglesia satélite por ahora, plan de roles cruzados queda en Jira para cuando se decida hacerlo
- [x] Verificado en código: visitas/membresía cruzada y designar líderes entre iglesia madre-satélite ya funcionan bidireccional; ver lista completa de Personas de la otra iglesia es asimétrico a propósito (solo madre ve al satélite) -- confirmado que se queda así
- [x] Jaqueline Justiniano: agregado rol Pastor en Centro de Vida Montero (además de Supervisor de la Visión en Acción, que se mantiene en ambas iglesias -- confirmado que así debe ser)
- [x] Análisis completo de UI de Membresía/Afirmación: ficha de persona tiene 3 pasos anidados (resumen→extendido→editor) en vez de 1 modal con toggle reducida/ampliada; confirmación de guardado solo en Identidad y censo, no en las otras 7 secciones -- plan entregado, no implementado
- [x] KAN-401: columna de cumpleaños de la semana (ícono + tooltip) y filtro Día/Semana/Mes en la tabla de Membresía (se ve en Afirmación, Membresía por CdP y Supervisión) -- código completo, 5 commits progresivos, tsc/lint limpios
- [x] KAN-401: verificado en vivo (Playwright, Afirmación y Membresía por CdP) -- encontrados y corregidos 2 bugs reales: callejón sin salida con 0 resultados (la tabla y su select de Cumpleaños desaparecían, sin forma de volver a ver a todos) y mensaje de "CdP vacía" engañoso cuando en realidad era el filtro
- [x] KAN-401: PR #88 mergeado a master -- deploy a producción sigue pendiente
- [x] KAN-402: cuadro gris antes del difuminado del anuncio + CI con ceros no bloquea duplicado -- ambos fixes probados en vivo por UI real (2 personas con "0000" guardan OK, CI real duplicado sigue bloqueado con 409). Rama pusheada, PR sin crear
- [x] KAN-403: fusión de la ficha de persona en 1 solo modal centrado con edición in-place (Editar/Cancelar), estilo de campo activo en edición, precarga por hover, filtros de análisis simplificados -- 4 commits, verificado en vivo (Afirmación): clic en fila abre la ficha completa de una, Editar habilita las 8 secciones, Cancelar descarta cambios sin guardar, guardar funciona y confirma con toast
- [x] KAN-403: bug real encontrado al pedir captura de pantalla real (el snapshot de accesibilidad de Playwright no lo detectaba) -- las 9 secciones del modal se comprimían a franjas vacías por un bug de flexbox (overflow-hidden sin shrink-0). Corregido y verificado con capturas antes/después
- [x] KAN-403: campos de Identidad y censo reordenados por pares cortos/largos (Sexo+CI, etc.), botones Editar/Guardar cambios en rojo fuerte, alerta de advertencia de responsabilidad antes de activar edición -- verificado con capturas reales en desktop/tablet/móvil (1440/820/390px)
- [ ] KAN-403: confirmación uniforme de guardado en las 7 secciones de lista (Direcciones/Teléfonos/etc, hoy guardan al toque) quedó fuera de alcance -- señalado en Jira para decidir si se hace aparte
- [ ] KAN-403: falta probar en vivo el modo scoped (Membresía por CdP) -- mismo componente compartido, no se pudo cambiar de rol en esta sesión
- [ ] KAN-401/402/403: falta el deploy real a producción de los 3
