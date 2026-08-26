# Gonzalo — 2026-08-26

- [x] Probado en vivo el asistente de Membresía hasta el paso 9/10 con cuenta real de prueba
- [x] KAN-261 (nuevo, crítico): el asistente fallaba en silencio al finalizar si un dato de una página anterior quedaba inválido (ej. CI/fecha de nacimiento de un borrador viejo) -- ahora avisa qué falta y vuelve a esa página automáticamente
- [x] KAN-258: corregido el desborde visual de la página 7 -- el diálogo ahora tiene scroll interno acotado, título y botones Atrás/Siguiente/Saltar quedan siempre visibles
- [x] KAN-257 (extensión): "Posición en la iglesia" ahora tiene "Ninguno" explícito y obligatorio, igual que Discipulados/Seminario
- [x] KAN-262 (nuevo): separadas "Familia" y "Ministerios" en 2 páginas -- juntas se hacían muy largas con varios familiares
- [x] Todo commiteado (`283d2c6`) en rama `kan252`
- [ ] Falta: destrabar en vivo la cuenta de prueba real que quedó atascada en el paso final (CI/fecha de nacimiento vacíos), y confirmar en el navegador los 4 fixes de hoy
- [ ] Pendiente de antes: KAN-259 (probar en móvil), KAN-260 (encabezado no actualiza el nombre), Mi Cuenta con pestañas
