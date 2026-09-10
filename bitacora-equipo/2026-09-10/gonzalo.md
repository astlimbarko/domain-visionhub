# Gonzalo — 2026-09-10

- [x] KAN-358: columna Teléfono en la tabla de Evangelismo -- oculta el +591 (obvio, Bolivia), muestra el código real si es otro país, achica la fuente si no matchea ningún código conocido (aprovecha catálogo `paises-telefono.ts` ya existente)
- [x] KAN-358: sidebar/drawer del Dpto. de Evangelismo (solo 2 pantallas) sacado -- era 100% redundante con los botones cruzados del hero; cuenta (Mi cuenta/Cambiar rol/Salir) sigue intacta en ambos casos
- [x] KAN-358: más contraste en los botones cruzados del hero (Dashboard / Lista de Evangelizados)
- [x] KAN-358: spinner overlay al hacer clic en "Volver al Constructor" (antes no había feedback durante la recarga completa)
- [x] Censo real de membresía por SQL directo (excluye iglesias de prueba + 3 Super Admin): 4 Anillo 344, Montero 202 -- coincide con lo que esperaba el owner. Informe en txt entregado.
- [x] El owner probó los 4 cambios en vivo y corrigió 2: el sidebar solo vaciaba los links (no recuperaba el espacio) -- ahora se oculta el `<aside>` completo; el pill de teléfono seguía siendo grande -- ahora es texto plano, mismo link a WhatsApp, aplicado también en Afirmación (antes sin tratamiento)
- [x] Bonus encontrado en vivo: columna "Evangelizado por" desbordaba el nombre -- mismo patrón de 2 líneas que la columna Nombre
- [x] KAN-359 creado: nombres de Red/Líder/Evangelista clickeables -- sin implementar, falta definir con el owner qué muestra la vista nueva
- [ ] Anotado sin tocar (pedido explícito del owner): bug de scroll-shift al hacer click en cualquier parte de la planilla, probable falta de `modal={false}` en algún Dialog/Sheet -- no arreglar todavía
- [x] Verificado en vivo (cuenta de prueba con rol real Dpto. de Evangelismo): sidebar oculto de verdad, botones del hero con buen contraste, teléfono como texto plano -- KAN-358 pasa a Finalizada
- [x] KAN-360: encontré la causa raíz de "Semillas" en Afirmación -- son personas de conteo de Evangelismo sin datos reales (mismo concepto que ya excluía Personas.tsx para Supervisor), Afirmación nunca las filtraba. Corregido en el listado, CSV y KPIs (migración a producción). Esto también contaminaba el censo que entregué antes -- **censo corregido y reenviado**: 4 Anillo 331 (no 344), Montero 197 (no 202)
- [ ] Bloqueado sin resolver: vista tablet de Evangelismo -- `resize_window` de la extensión de Chrome no afecta el viewport real, Playwright/chrome-devtools siguen desconectados
- [ ] Pendiente: componente de tabla reusable Evangelismo/Afirmación + PDF horizontal para Afirmación (mostrar todos los datos que recoge)
