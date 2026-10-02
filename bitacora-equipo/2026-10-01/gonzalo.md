# Gonzalo — 2026-10-01

- [x] Alineé harness/24: botón "Llenar membresía" diferido a la integración (PR #144, mergeado)
- [x] Puse a salvo el trabajo de Bautismo de OpenCode (estaba sin commitear) en `feat/bautismo-opencode`
- [x] Verifiqué Bautismo en vivo (Pastor/Genesis): registrar, pestaña Datos, menú — OK
- [x] Delegué RSIL a OpenCode (apilado sobre Bautismo); lo revisé y verifiqué en vivo — OK
- [x] Delegué KAN-469 (cierre optimista del modal de anuncios) a OpenCode en worktree aparte
- [x] Membresía desde 0: RPC `fn_guardar_membresia_nuevos` (guardado final v1 núcleo) aplicada a prod + botón conectado
- [x] Limpié el form de Membresía según decisiones del owner (quité bautismo/categoría evangelismo/horario/familia)
- [ ] Falta (próxima sesión): dirección normalizada, combobox CdP por Red+satélites para "¿a cuál?", persistir cómo llegó/discipulado, precarga de persona existente, verificar en vivo
- [ ] Falta: integrar las 4 ramas a master + entradas de /avances antes de mergear
- [ ] Pendiente: revisar reporte de OpenCode de KAN-469

## Sesión 2 (mismo día)

- [x] Pusheé a remoto las 3 ramas de ayer (Bautismo/RSIL/Membresía estaban solo local) — nada en riesgo
- [x] KAN-469 lo hice yo directo (no OpenCode): cierre optimista del modal de anuncios, rama `fix/kan469-modal-anuncios-optimista` pusheada, Jira En revisión
- [x] Membresía: persistí dirección (sistema normalizado, `direccion.calle`) y cómo llegó (`persona_llegada.comentarios`) — migración aplicada a prod
- [x] Backend de CdP buscable: `fn_listar_cdp_asistencia` (CdP de la iglesia + satélites, por Red) + discipulado por nivel en la RPC — aplicado a prod
- [x] Decisiones del owner: unificar "¿a cuál asiste?" con la asignación de CdP (picker buscable reemplaza "elegir de la lista"); discipulado = dropdown de cursos reales
- [ ] Falta frontend Membresía (backend ya listo): types discipuladoNivel, dropdown de cursos, picker buscable de CdP, verificar en vivo
- [ ] Falta: probar KAN-469 en vivo; integrar las 4 ramas a master + /avances antes de mergear

## Sesión 3 (mismo día, cuenta nueva)

- [x] Terminé el frontend de Membresía (discipulado dropdown + picker buscable de CdP), verificado end-to-end
- [x] **Integré las 4 ramas a master** (PR #145): Bautismo + RSIL + Membresía desde 0 + KAN-469. Las 3 tarjetas del portal quedaron funcionales. Botón "Registrar y llenar membresía" en Bautismo + /avances
- [x] **KAN-490 — Asignación de CdP flexible** (harness/23 A+B): selector unificado (invitador sistema/texto libre + auto-sugerir CdP con override + buscador por nombre/líder/Red/satélites + "sin asignar") + guardado REAL de CdP en las 4 puertas (antes Altar/Bautismo/RSIL la descartaban). PR #146 mergeado. Verificado end-to-end
- [x] **Precarga de persona existente** en Membresía (harness/21 Req 1): abrir precargada (desde Bautismo o buscándola), actualiza sin duplicar. PR #148 mergeado. Verificado end-to-end. Con esto harness/21 queda COMPLETO
- [x] Limpié comentarios desactualizados en Afirmación (PR #147)
- [ ] Pendiente owner: recordar crear harness del "panel de recepción en la CdP" (apilar por antigüedad, trabajo del Líder de CdP) — idea a madurar
- [ ] Pendiente: probar KAN-469 en vivo (cierre instantáneo); búsqueda de CdP por zona/dirección (requiere dar dirección a las CdP). DEPLOY manual pendiente (CI/CD roto) — todo master sin desplegar
