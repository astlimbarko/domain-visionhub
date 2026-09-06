# Gonzalo — 2026-09-06

- [x] KAN-333: formulario "Nuevo evangelizado" ampliado (segundo nombre, segundo apellido, fecha de nacimiento, teléfono con código de país) -- verificado en vivo con registro real
- [x] KAN-286: navegabilidad del calendario de Evangelismo -- acordeón Red → Casa de Paz → persona, cada nombre abre su ficha. Reusado también en la vista de Líder de Red
- [x] KAN-285: sección "Resumen semanal" nueva, mismo drill-down agrupado por semana
- [x] Todo verificado en vivo (localhost contra la base real, iglesia Genesis) -- registro de prueba limpiado después
- [x] Rama `feature/kan281-departamento-evangelismo` pusheada, KAN-281/282/283/285/286/333 en "En revisión"
- [x] Sección "Tendencia" (línea de tiempo día/semana/mes) + "Metas de la Red" de barras a texto -- comentado en KAN-285 (faltaba, commit `9500deb` sin ticketear)
- [x] KAN-334 (nuevo, EV-11): banner y navbar del Depto. de Evangelismo de azul a dorado institucional -- verificado en vivo
- [x] KAN-290: bug real corregido -- "meta propia" se bloqueaba sin chequear si quien mira ya es rol superior de la CdP. No se pudo reproducir el caso puntual (Pastora Jacqueline) con datos reales de producción
- [ ] Falta: aprobación del owner para mergear toda la rama (KAN-281 a 334) a `master` + deploy
- [ ] Falta: confirmar con la Pastora Jacqueline si KAN-290 resolvió su caso real, o precisar en qué pantalla se bloqueó
