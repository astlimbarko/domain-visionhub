# Matías — 2026-08-08

- [x] KAN-117 ("No llega el correo al asignar un liderazgo"): investigué a fondo. No era plantilla faltante en Supabase (como se sospechaba en el ticket) — el aviso por correo (REQ-ASG-7/KAN-89) solo estaba conectado para Líder/Supervisor de Red, nunca para Líder/Sublíder de CdP ni Pastor/Supervisor de la Visión en Acción vía "persona ya registrada".
- [x] Fix: 2 funciones SQL nuevas (`fn_estructura_datos_notificacion_cargo_cdp`/`_principal`) + extendí la Edge Function `notificar-asignacion-cargo` + conecté las llamadas en `PanelCasaDePazEstructura.tsx` y `PanelPrincipalEstructura.tsx`, reusando el mismo patrón SMTP (Brevo) ya verificado en vivo para Red.
- [x] Build (`tsc -b && vite build`) limpio. Commit local `79facd6` en `feature/supervisor-vision-accion` (sin push).
- [x] KAN-117 actualizado en Jira: comentado, pasado a "En revisión" (no "Finalizada" — falta probarlo en vivo), assignee Gonzalo.
- [ ] Falta: verificar en vivo el envío real (asignar Líder de CdP y Pastor/Supervisor a alguien ya registrado, confirmar que llega el correo) antes de pasar KAN-117 a Finalizada.
- [x] Nota: en paralelo hubo otra sesión trabajando en el mismo repo que comiteó directo (`14e2e71` KAN-95 banner de color en panel de CdP, `ba6e759` KAN-73/114/116/128 — rol activo en menú de cuenta, menú de Afirmación, orden del selector de Supervisor de Red, sesión móvil de Super Admin). No es trabajo mío, lo dejo anotado para que quede claro de dónde salen esos commits.

## Sesión 2 — re-auditoría de los 8 tickets "bloqueados" (KAN-52)

Contexto: en una sesión anterior (con una rama vieja, sin el lienzo mergeado) comenté 8 tickets de Jira diciendo que estaban bloqueados porque "Estructura Organizacional" era un placeholder. Era incorrecto — después de traer el merge de `origin/master` (121 commits), el lienzo real y completo ya está en esta rama. Re-audité los 8 contra el código real y corregí cada comentario en Jira (sin borrar el anterior, agregando uno nuevo).

- [x] KAN-112 (línea entre Departamentos): ya resuelto de por sí — `layout.ts` nunca genera esa arista. Comentario + "En revisión".
- [x] KAN-96 (limpieza posiciones del lienzo): confirmado código muerto real (`useGuardarPosicionesEstructura` no se llama desde ningún componente, `nodesDraggable={false}`). No toqué la BD real ni el código — documentado con recomendación en el comentario, "En curso".
- [x] KAN-100 (descargar PNG/PDF horizontal): no existía. Implementado: botón "Descargar" (desktop y móvil) con `html-to-image` + `getNodesBounds`/`getViewportForBounds` de React Flow, nuevo archivo `exportarLienzo.ts`. Compila y pasa lint. "En revisión".
- [x] KAN-119 / KAN-63 (responsividad): confirmé que el trabajo real de Gonzalo (bottom sheets, tooltips táctiles, aria-selected, breakpoint por altura) ya está en el código. Encontré y corregí un gap real: los botones de zoom/centrar tenían área táctil de 28-36px (bajo el mínimo de 44×44, REQ-MOB-3) — ampliada con el mismo truco de pseudo-elemento ya usado en los paneles. KAN-119 a "En revisión"; KAN-63 se queda "En curso" (faltan botones "Cerrar panel" en 36px y pruebas en dispositivo físico real, que no puedo hacer desde acá).
- [x] KAN-78 (vista del lienzo por rol): confirmé un gap real — Líder/Supervisor de Red quedan bloqueados de la página entera (el guard solo deja pasar a SUPER_ADMIN/SUPERVISOR). Es una decisión de alcance real (guard de ruta + query scoping), no lo implementé sin confirmarlo. Documentado con precisión, "En curso".
- [x] KAN-62 (pruebas integrales): `tsc -b` y `oxlint` limpios. No pude correr la suite E2E (`frontend/e2e/estructura-red.spec.ts`) — necesita `.auth/storageState.json` con sesión real de Google OAuth que no existe en este entorno y corre contra Supabase real. "En curso".
- [x] KAN-120 (error al asignar Supervisor): re-investigué el flujo completo, no encontré ningún bug de código. Documenté las dos validaciones legítimas que un usuario puede confundir con un bug (`ESTRUCTURA_PERSONA_SIN_CUENTA`, `ESTRUCTURA_PERSONA_YA_TIENE_ROL`). "En revisión".
- [x] Commits locales (sin push): `60881f8` (KAN-100 + touch targets KAN-63/119). El commit de KAN-95 (`14e2e71`) ya estaba hecho por la sesión anterior, solo lo verifiqué.
- [ ] Falta: probar todo en vivo contra la app corriendo (ninguno de los 8 se puede pasar a "Finalizada" sin eso); decidir con Gonzalo el alcance de KAN-78 (Líder/Supervisor de Red) antes de implementarlo.

## Sesión 3 — cluster de Membresía (KAN-123 a KAN-127)

Contexto: 5 tickets sobre el flujo de auto-registro/completar datos de una
persona vía URL de Casa de Paz y sobre permisos de Afirmación. Traje la
descripción completa de los 5 con Jira antes de tocar nada.

- [x] Investigué el flujo real completo antes de asumir qué faltaba:
  registro público (`RegistroPublico.tsx`/`fn_registrar_persona_via_url`),
  Membresía obligatoria por invitación (`MembresiaObligatoria.tsx`/
  `fn_completar_membresia`), registro interno de Afirmación
  (`RegistrarPersonaAfirmacion.tsx`), y el modelo de relaciones familiares
  ya existente (`relacion_familiar`/`referencia_familiar`,
  `harness/02-persona-parentela`).
- [x] **KAN-123/124/125/126** (ampliar campos, paginar, URL de CdP,
  completar al ingresar): son un mismo flujo con dependencia real entre
  sí. Encontré que KAN-123 tiene 5 decisiones de producto sin cerrar que
  cambian el modelo de datos (catálogo de discipulados global/por
  iglesia, repetición de discipulados, diseño de Seminario/Universidad,
  y sobre todo qué define un "mentor disponible") y que KAN-126 tiene el
  mayor radio de impacto del cluster (afecta el login de usuarios ya
  existentes, no solo un flujo nuevo). En vez de implementar a ciegas
  contra un alcance que iba a cambiar, escribí la especificación completa
  en `harness/17-membresia-ampliada/` (requirements, technical-design,
  database-impact, open-questions, implementation-plan) documentando qué
  ya existe y se reutiliza, el diseño propuesto para lo que falta, y las
  8 preguntas concretas que bloquean la implementación. Los 4 tickets
  quedaron en Jira "En curso" con comentario, sin assignee (es
  documentación, no código).
- [x] **KAN-127** (Afirmación debe ver todas las CdP de su iglesia): sí
  tenía alcance claro, lo implementé. Encontré que Afirmación solo veía
  Casas de Paz con líder de CdP vigente (`fn_listar_casa_paz_url_afirmacion`/
  `fn_listar_lideres_cdp_afirmacion`, acotadas a su caso de uso puntual de
  administrar URLs/elegir líder) — las CdP vacantes nunca aparecían en
  ningún lado. Agregué `fn_listar_casas_de_paz_afirmacion` (RPC nuevo,
  solo lectura, mismo guard `fn_es_lider_afirmacion_en OR
  fn_es_operativo_en`, aislado por iglesia) + pestaña nueva "Casas de Paz"
  en el frontend de Afirmación (`PanelCasasDePazAfirmacion.tsx`,
  agrupada por Red, igual que el panel de URLs), ruta
  `/afirmacion-casas-de-paz`.
- [x] Migración `supabase/migrations/20260808250000_fn_listar_casas_de_paz_afirmacion.sql`
  (nueva, pendiente de aplicar contra Supabase real). `tsc -b --force` y
  `vite build` del frontend limpios.
- [x] Jira: KAN-127 comentado y pasado a "En revisión", assignee Gonzalo.
  KAN-123/124/125/126 comentados y pasados a "En curso", sin assignee.
- [ ] Falta: que Gonzalo responda las 8 preguntas de
  `harness/17-membresia-ampliada/open-questions.md` para poder
  implementar el cluster de Membresía; aplicar la migración de KAN-127
  contra Supabase real y probar en vivo con un Líder de Afirmación real
  antes de pasar KAN-127 a "Finalizada".
