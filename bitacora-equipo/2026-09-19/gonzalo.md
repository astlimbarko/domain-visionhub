# Gonzalo — 2026-09-19

- [x] KAN-403: reemparejado Sexo+Fecha de nacimiento (después revertido a Sexo+Carnet de identidad a pedido del owner tras verlo en vivo)
- [x] KAN-403: bug real encontrado y corregido -- `SelectTrigger` usa `w-fit` (no `w-full` como `Input`), dejaba espacio vacío al lado de los selects (Sexo, Estado civil, etc.); ahora los 4 selects de Identidad y censo ocupan todo el ancho de su columna
- [x] KAN-403: convertida la ficha en asistente paginado de 9 páginas (Atrás/Siguiente en ambos modos) a pedido del owner -- con 8 secciones no entraba nada sin scroll en ningún dispositivo. Botón "Actualizar" grande y centrado solo en la última página al editar
- [x] KAN-403: bug real encontrado y corregido antes de probar -- la primera versión del paginado montaba `FichaIdentidad` 2 veces (una por página), cada una con su propio formulario aislado; el guardado solo veía la mitad de los datos. Corregido a una sola instancia compartida
- [x] KAN-403: verificado en vivo extremo a extremo (editar un campo, navegar entre páginas sin perderlo, Actualizar, confirmar que persiste de verdad, revertir el dato de prueba) + capturas reales en desktop/móvil
- [x] KAN-403: PR #89 creado (https://github.com/astlimbarko/domain-visionhub/pull/89), sin mergear todavía
- [x] KAN-403: corregida la simplificación de filtros de Membresía -- el owner aclaró que el pedido era sacar solo Nuevos Convertidos/Reconciliados (son de Evangelismo), no todos los chips. Restaurados Por URL/Formulario, Simpatizantes/Creyentes, Con profesión, estado civil, Bautizados
- [ ] KAN-404 creado (en cola, sin implementar): falta scroll horizontal también arriba de la tabla de Membresía, no solo abajo
- [x] KAN-403: entrada en /avances aplicada a la base real (EN_CURSO, se pasa a TERMINADO cuando se despliegue) -- el owner preguntó si ya estaba hecho, no lo estaba, se creó y aplicó en el momento
