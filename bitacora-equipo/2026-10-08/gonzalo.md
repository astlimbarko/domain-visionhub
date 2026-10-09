# Gonzalo — 2026-10-08

Rama de trabajo: `feat/afirmacion-eventos-modal-actividades` (sale de master). NO mergeada ni desplegada todavía.

## Panel de Eventos de Afirmación — modal + detalle completo
- [x] Modal "Crear evento" rehecho: sin combobox de tipo → Nombre + Descripción + checkbox "Es un solo día" + 3 actividades (Altar / RSIL / Bautismo+Membresía). Las actividades FILTRAN en qué puertas aparece el evento.
- [x] Botón "Crear evento" movido debajo del Hero, alineado izquierda, azul sólido (#0071E3) de alto contraste (sobrescribe el global sin tocarlo). Texto explicativo del "para qué" en la pantalla de Eventos.
- [x] Fix botones invisibles del Hero del detalle (eran blanco sobre blanco).
- [x] Detalle rediseñado: stats grandes (Personas + Colaboradores), lista de colaboradores (nombre+red), tarjetas-botón por bloque con conteo, vista de personas por bloque (tabla enumerada: fecha/hora, nombre, edad, tel, invitó, red, líder CdP, iglesia), lápiz por persona (ficha editable) + lápiz "Editar evento".
- [x] Columna "Iglesia" + resumen "de dónde es quién" (madre + satélites se manejan como una, pero se distingue el origen).
- [x] Export PDF/XLS formato "planilla" del owner: N°, Nombre, Edad, Celular, Quién lo trajo, Red, Iglesia; título "Evento — fecha" + "Hoja de <bloque>"; ordenado alfabético.
- [x] Backend (migraciones aplicadas a prod, solo funciones nuevas/aditivas): es_afirmacion ya estaba; tipo_evento 'AFIRMACION' por defecto + evento.afirmacion_actividades; fn_afirmacion_crear_evento/listar_eventos/evento_detalle (por actividades), fn_afirmacion_editar_evento, fn_afirmacion_evento_colaboradores, fn_afirmacion_evento_personas (text[] + iglesia_origen, dedup por persona).

## Evento real "Bautizo Global" (3-oct) creado y depurado (operación de datos en prod)
- [x] Creado en 4 Anillo (id evento `0c398a4b-0b0e-4577-87c8-7232a1dc0d10`) + asignados retroactivamente los registros del 2026-10-03 (4 Anillo + satélite Montero). Reversible.
- [x] Limpieza: 29 registros duplicados (misma persona+proceso) soft-eliminados. IDs guardados en `basura_no_leer/limpieza-duplicados-bautizo-global-2026-10-08.json` para restaurar.
- [x] Números limpios: RSIL 127, Bautismo 92, Membresía 41 → 162 personas distintas, 9 colaboradores.
- [x] Generados 3 XLS de informe (RSIL/Bautismo/Membresía) en basura_no_leer + mensaje para el encargado explicando diferencias con la planilla manual anterior.

## Otros
- [x] Quitado el botón "Mi Evangelismo" del menú lateral (owner: pasa a ser ROL completo que maneja Daniel; funcionalidad de fondo intacta). Commiteado en master (1177ed8).
- [ ] Pendiente: mergear `feat/afirmacion-eventos-modal-actividades` a master + /avances + build + ZIP a cPanel (sigue solo en localhost).
- [ ] Pendiente: dedup profundo de ~5 personas cargadas como 2 fichas distintas (más delicado).
- [ ] Pendiente (aparte): KAN-500 (guardar persona existente Bautismo/Membresía).
- [ ] Jira: falta registrar ticket del Panel de Eventos (MCP no se tocó en esta sesión por tokens).
