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

## Sesión 4 — bloque de 9 tickets (KAN-5, 16, 27, 29, 30, 32, 35, 38, 40)

Traje descripción + comentarios completos de los 9 con Jira antes de tocar
nada. Varios ya tenían contexto previo del commit `0935324` (2026-08-06),
escrito ANTES del merge grande de Estructura Organizacional -- volví a
investigar cada uno contra el código real de hoy en vez de asumir que
seguían igual de bloqueados.

- [x] **KAN-5** (Ministerio en el formulario de personas): implementado.
  En vez de un campo nuevo `ministerio_id` en `persona` (que hubiera
  duplicado la fuente de verdad), reusé el modelo de participación ya
  existente (`ministerio_persona`) -- ahora se puede asignar un
  Ministerio al crear una persona (`CrearPersonaDialog.tsx`) y
  agregar/quitar desde su ficha (`FichaMinisterios.tsx`, antes de
  solo-lectura pasa a editable). Migración nueva para exponer el id de
  participación (necesario para poder quitar sin afectar el catálogo).
  Jira: "En revisión", assignee Gonzalo.
- [x] **KAN-16**: re-auditado contra el código real -- los 7 criterios de
  aceptación ya estaban cubiertos por el trabajo del 2026-08-06 (checkbox
  "Asiste a esta CDP", migración 107 ya aplicada y verificada). El
  pendiente de "visitante de otra CdP" es una ampliación de alcance, no
  un criterio del ticket. Se queda "En revisión" (sin cambios de código).
- [x] **KAN-27/29/30** (rol Soporte de Red / restringir finanzas a
  Supervisor de Red): investigué a fondo el modelo de roles real.
  Encontré que "Supervisor de Red" (cargo `SUBLIDER_RED`) YA existe pero
  comparte el 100% de los permisos de Líder de Red por una decisión
  explícita del owner (`91_fn_es_lider_de_red_incluye_sublider.sql`,
  2026-08-02: "paridad completa, ya que es de apoyo") -- incluye ver
  montos (`fn_dashboard_lider_red.ofrendas_mes/ingresos`). Restringir
  finanzas (KAN-29/30) revierte esa decisión reciente; crear un rol
  "Soporte" realmente acotado (KAN-27) implica sumar un valor a
  `rol_sistema_enum` o ramificar por `cargo_codigo` en ~17
  funciones/políticas RLS. No improvisé ninguna de las tres -- las 3
  quedaron documentadas en Jira con el hallazgo concreto, "En curso",
  pendientes de que el owner confirme el alcance real de permisos.
- [x] **KAN-32** (Cambiar de Red): no existe hoy. Confirmé que es una
  feature real y no chica (una persona pertenece a una CdP, no a una Red
  directamente; mover implica reasignar membresía, advertir cargos no
  mantenibles, preservar histórico/auditoría). Documentado en Jira sin
  implementar, "En curso".
- [x] **KAN-35** (Supervisor de la Visión ve CdP eliminadas): ya estaba
  resuelto como parte de KAN-34 (Histórico Anual) -- confirmé que
  `fn_historico_cdp_eliminadas` escopa solo por iglesia (no depende de
  que la Red/líder sigan activos) y que el tab ya es accesible para el
  Supervisor. Jira: "En revisión", sin cambios de código.
- [x] **KAN-38** ("Seleccionar Todo"): implementado en dos selectores
  múltiples reales -- el buscador de personas de la toma de asistencia
  (`BuscadorPersonaMultiple.tsx`) y el filtro multi-sede del Calendario
  General (`CalendarioMultiIglesia.tsx`), con estado indeterminado y
  contador, actuando solo sobre lo filtrado/visible. No toqué cada
  selector múltiple de la app -- el patrón queda reusable para el resto.
  Jira: "En revisión", assignee Gonzalo.
- [x] **KAN-40** (Pastor ve calendario consolidado): re-confirmé la misma
  conclusión de la sesión del 2026-08-06 -- `RUTAS_PASTOR` sigue sin
  Calendario a propósito (decisión de alcance del owner). El filtro
  multi-sede ya está construido (`CalendarioMultiIglesia.tsx`) y ahora
  además tiene "Seleccionar Todo" (KAN-38) -- si el owner confirma que el
  Pastor debe tener Calendario, conectarlo es inmediato. Sigue "En curso".
- [x] Commit local (sin push): `00611b0` (KAN-5 + KAN-38). Migración
  nueva `supabase/migrations/20260808260000_fn_persona_ficha_ministerio_participante_id.sql`,
  pendiente de aplicar contra Supabase real.
- [x] `tsc -b` limpio para todos mis archivos tocados -- hay un error
  preexistente en `useEstructuraOrganizacional.ts` (import sin usar) que
  viene de otra sesión trabajando en paralelo en el mismo repo, no es mío
  y no lo toqué.
- [x] Nota: sesión compartida con al menos otra sesión en paralelo
  (cluster de Afirmación/Membresía, `PanelCasasDePazAfirmacion.tsx` y
  otros archivos de `estructura-organizacional`/`afirmacion` aparecen
  modificados sin ser míos) -- tuve cuidado de solo `git add` mis propios
  archivos al commitear. También encontré y resolví una colisión de
  nombre de migración (dos archivos con el mismo timestamp
  `20260808240000`) renombrando la mía a `20260808260000`.
- [ ] Falta: aplicar la migración de KAN-5 contra Supabase real y probar
  en vivo (crear persona con Ministerio, agregar/quitar desde la ficha);
  probar "Seleccionar Todo" en vivo antes de pasar KAN-5/KAN-38 a
  "Finalizada"; que el owner defina el alcance de permisos de
  KAN-27/29/30 y decida si prioriza KAN-32 como feature aparte.
