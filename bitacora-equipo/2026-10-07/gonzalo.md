# Gonzalo — 2026-10-07

- [x] Constructor CdP — flujo de Líder/Anfitrión: botón "Añadir"/"Editar"; el modal de cargo exclusivo ocupado muestra solo a la persona + X (sin "persona existente/invitar"); para cambiar hay que quitar primero. AsignarCargoDialog.
- [x] Constructor CdP — "Ver historial de líderes" (fn_cdp_historial_lider). Fix: excluye tenencias de 0 días (ruido del seed, ej. Silvana duplicada en CdP de Ana María que nunca lideró).
- [x] BUG horario de reunión no se mostraba en el panel del Constructor — causa raíz: leía con fn_mi_cdp_perfil (exige ser miembro de la CdP → PERFIL_FUERA_DE_ALCANCE para admin/pastor). Fix: RPC fn_cdp_horario_actual + hook useHorarioCdp. Verificado EN VIVO con Playwright (CdP Ana María: muestra "Viernes · 19:00").
- [x] Migraciones aplicadas a prod: fn_cdp_historial_lider, fn_cdp_horario_actual, /avances constructor.
- [x] master pusheado (17a68b3) + dist `visionhub-dist-2026-10-07.zip` armado (pendiente que lo suba a cPanel).
- [x] /avances cargado (horario visible + flujo de líder con historial).
- [ ] Pendiente TARDE: Panel de Eventos de Afirmación (rama feat/afirmacion-panel-eventos-front, OpenCode WIP 70% + backend 0% mío).
- [ ] Pendiente TARDE: KAN-500 (bug persona existente Bautismo/Membresía), depurar 7 duplicados del Bautizo Global, registrar faltantes en Bautismo, Jira del constructor.
