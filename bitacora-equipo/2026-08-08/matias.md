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

## Sesión 5 — KAN-87, KAN-111, KAN-88

Traje descripción + comentarios completos de los 3 con Jira antes de tocar
nada.

- [x] **KAN-87**: la propia descripción del ticket dice textualmente "Para
  que lo implemente el equipo, no es trabajo de esta sesión" -- no lo
  implementé, respeté esa nota. Investigué igual la relación con KAN-111 y
  dejé comentado en Jira que queda resuelto como subconjunto de KAN-111, sin
  cambio de estado (sigue "Tareas por hacer").
- [x] **KAN-111** (días de retención configurables, Red y CdP):
  implementado. Nuevos criterios `DIAS_RETENCION_RED`/`DIAS_RETENCION_CDP`
  en el motor de configuración ya existente (`configuracion_definicion` +
  `fn_criterio`, mismo patrón que Control de Reportes), configurables desde
  el Panel del Supervisor sin tocar frontend genérico. Encontré que Red ya
  tenía el período de gracia pero fijo en el código (`interval '1 year'`) y
  que Casa de Paz **no tenía ninguno** -- al eliminarse desaparecía de
  inmediato (política RLS genérica `fecha_eliminacion IS NULL`). Agregué
  política de gracia nueva para `casa_de_paz` (mismo patrón que `red`) +
  `fn_estructura_reactivar_casa_de_paz` (no existía forma de deshacer
  `fn_eliminar_cdp`) + wiring de frontend (banner "fue eliminada" + botón
  "Reactivar" en `PanelCasaDePazEstructura.tsx`, tarjeta agrisada en el
  lienzo). Saqué el corte de gracia hardcodeado en JS
  (`estructura.service.ts`) que quedaba redundante con la RLS ahora
  configurable.
  - Fuera de alcance a propósito: la ventana de "borrado definitivo" con
    cron + deshacer de 60s que Red ya tiene (KAN-85/52) no se replicó para
    CdP -- documentado en el comentario de Jira como pendiente real.
  - Migración `supabase/migrations/20260808240000_estructura_retencion_configurable.sql`
    (nueva, pendiente de aplicar contra Supabase real).
  - Jira: comentado, pasado a "En revisión", assignee Gonzalo.
- [x] **KAN-88** (logo en correos de acceso@somoscdv.com): implementado.
  `logo_64x64.png` que menciona el ticket no existía en el repo -- generé
  `frontend/public/logo-correo.png` (128×128, para verse nítido a 64×64 en
  pantallas retina, con `System.Drawing` de PowerShell ya que no había
  Python/ImageMagick disponibles) a partir del logo real
  (`frontend/public/logo.png`). Agregué el header con el logo a los 3
  puntos que arman HTML de correo en el repo: `supabase/templates/invite.html`
  (usado por `invitar-usuario`/`invitar-lider`/`crear-iglesia` vía
  `inviteUserByEmail`) y las Edge Functions `solicitar-otp` y
  `notificar-asignacion-cargo` (HTML propio por Brevo SMTP). Mismo logo para
  ambas iglesias de prueba, como indicó el owner en el comentario del
  ticket.
  - Nota: las otras 4 plantillas de Supabase Auth (recovery, magic link,
    etc.) no están versionadas en este repo -- se aplicaron directo en el
    dashboard en una sesión anterior (bitácora 2026-07-30/gonzalo.md);
    agregarles el logo ahí queda fuera del alcance de esta sesión.
  - Jira: comentado, pasado a "En revisión" (ya tenía assignee Gonzalo).
- [x] `tsc -b` y `vite build` del frontend limpios después de KAN-111
  (KAN-88 no toca frontend TS, solo Edge Functions Deno + un asset).
- [x] Commits locales (sin push): `5288d7e` (KAN-111), `052537f` (KAN-88),
  ambos en `feature/supervisor-vision-accion`.
- [x] Nota: encontré en el checkout entradas de otras sesiones en paralelo
  ya committeadas (Sesión 4 de este mismo archivo, hasta `0edd646`) --
  hice `git add` solo de mis propios archivos, sin colisión de timestamp de
  migración (`20260808240000` ya estaba libre para mí cuando empecé).
- [ ] Falta: aplicar la migración de KAN-111 contra Supabase real y probar
  en vivo (eliminar/reactivar una Casa de Paz, cambiar los días de
  retención desde el Panel del Supervisor y confirmar que el corte se
  respeta) antes de pasar a "Finalizada"; confirmar que el logo se ve bien
  en un correo real de Brevo (algunos clientes de correo bloquean imágenes
  por default) antes de pasar KAN-88 a "Finalizada"; decidir con el equipo
  si vale la pena replicar el borrado definitivo con cron para CdP
  (gap documentado en KAN-111).

## Sesión 6 — KAN-50 (Descargar PDF en los dashboards), último ticket grande del día

Traje la descripción completa con Jira antes de tocar nada. Alcance amplio
("todos los dashboards") -- prioricé un componente reusable en vez de una
solución ad-hoc por pantalla, y cubrí los dashboards reales con mayor uso en
el tiempo que quedaba.

- [x] Evalué `html-to-image` (ya instalado, usado en KAN-100 para el PNG del
  lienzo) vs. sumar `jspdf`/`jspdf-autotable`. Elegí combinar ambas: reusar
  `html-to-image` para capturar el contenedor tal cual se ve en pantalla (ya
  filtrado por rol/permisos, porque el fetch de datos ya viene escopeado por
  RLS -- no hace falta mecanismo de permisos nuevo) y empaquetar esa imagen
  en un PDF real con `jspdf` (nueva dependencia, `frontend/package.json`).
  Un PDF por-texto con `jspdf-autotable` hubiera exigido mapear a mano cada
  dashboard (KPIs, gráficos de recharts, tablas) a filas/columnas -- no daba
  el tiempo para hacerlo bien en todos.
- [x] Creé `frontend/src/utils/exportarPdf.ts` (`descargarElementoComoPdf`,
  captura con `pixelRatio: 2` para nitidez pero dimensiona la página del PDF
  al tamaño real en pantalla del contenedor, para que no salga gigante) y
  `frontend/src/components/shared/DescargarPdfButton.tsx` (botón reusable
  con estado de carga, recibe una `ref` al contenedor a exportar). El propio
  botón se auto-excluye de la captura vía `data-pdf-excluir`, igual que
  cualquier nodo con `display:none`/`visibility:hidden`.
- [x] Aplicado a: los 4 Dashboard por rol (`DashboardPastor`,
  `DashboardSupervisor`, `DashboardLiderRed`, `DashboardLiderCdp`),
  `Finanzas.tsx` (vista de CdP) + `FinanzasSupervisorVista.tsx`,
  `ControlReportesVista.tsx` (compartido por Control de Reportes del Líder
  de Red y el Historial de Reportes del Supervisor) + `HistorialReportes.tsx`
  (vista de CdP), `Evangelismo.tsx` (vista de CdP) y `Calendario.tsx` (vista
  de CdP).
- [x] Fuera de alcance a propósito, documentado en el comentario de Jira:
  `Reportes.tsx` (es el formulario de carga del reporte semanal, no un
  dashboard con datos para exportar -- no tiene sentido "descargar" un
  formulario vacío); las vistas de Evangelismo/Calendario específicas de
  Líder de Red y Supervisor (`EvangelismoRed`, `EvangelismoSupervisorVista`,
  `CalendarioRed`, `CalendarioMultiIglesia`); pantallas de gestión que no son
  dashboards de indicadores (Personas, CasasDePaz, Administración, etc.).
  El componente queda listo para sumarlas rápido si se prioriza -- no es
  "todos" literal, pero sí la cobertura real más alta que daba el tiempo.
- [x] Build (`tsc -b && vite build`) y `oxlint` limpios (solo warnings
  preexistentes de otros archivos, ninguno mío).
- [x] Commit local (sin push): `0c09daa`.
- [x] Jira: KAN-50 comentado con el detalle de cobertura, pasado a "En
  revisión", assignee Gonzalo.
- [ ] Falta: probar la descarga en vivo (desktop y móvil real, con datos
  reales de Supabase) antes de pasar a "Finalizada" -- no pude correr la app
  contra el backend real desde acá.

## Sesión 7 — cierre de dos gaps abiertos: KAN-115 y KAN-96

- [x] **KAN-115** (gap del guard `RequiereCapacidad` en /afirmacion,
  /jovenes, /matrimonios): investigué a fondo cómo funciona hoy
  (`RequiereCapacidad.tsx`, `App.tsx`, `useEsLiderAfirmacion`/
  `useRolesGlobales.ts`). El guard en sí es correcto (`Navigate` si
  `permitido=false`), pero lo importante es que **no es la única barrera**:
  las tres RPC que realmente traen los datos (`fn_jovenes_iglesia`,
  `fn_matrimonios_iglesia`, `fn_listar_lideres_cdp_afirmacion` y el resto
  del módulo Afirmación) son `SECURITY DEFINER` y validan server-side, con
  `fn_es_lider_jovenes_en`/`fn_es_encargado_matrimonios_en`/
  `fn_es_lider_afirmacion_en` (más `fn_es_operativo_en` para Pastor/
  Supervisor) contra `auth.uid()` -- no confían en nada que mande el
  cliente. Alguien que fuerce la navegación (localStorage stale, etc.)
  entra a un shell de página vacío pero cualquier RPC le tira
  `SIN_ACCESO`/`AFIRMACION_SIN_PERMISO`: no hay forma de ver datos ajenos.
  Conclusión: el "gap" era una preocupación teórica sin bug real. No toqué
  código. Comentado en Jira, se queda "En revisión" (sin cambio de estado).
- [x] **KAN-96** (limpieza `estructura_nodo_posicion`): al preparar la
  migración de DROP encontré que el ticket original (y el pedido de esta
  sesión) asumían que la tabla entera estaba muerta -- **no es así**. Confirmé
  en `estructura.service.ts` que la tabla se sigue LEYENDO activamente
  (`select nodo_clave, posicion_x, posicion_y ...` para `layout.posiciones`,
  consumido por el lienzo para respetar posiciones históricas). Coincide con
  el título real del ticket ("quitar guardado", no "quitar tabla") y con mi
  propio comentario anterior en Jira (id 10094). Lo único 100% confirmado
  muerto es el RPC de escritura `fn_estructura_guardar_posiciones` y su
  contraparte de frontend (`useGuardarPosicionesEstructura`/
  `guardarPosicionesEstructura`) -- ambos viven en
  `frontend/src/features/estructura-organizacional/`, carpeta que esta
  sesión tenía prohibido tocar (otro agente trabajando ahí en paralelo,
  KAN-78/KAN-63), así que el frontend queda sin cambios.
  - Migración nueva `supabase/migrations/20260808270000_estructura_eliminar_guardado_posiciones.sql`
    -- **solo** `drop function fn_estructura_guardar_posiciones(uuid, jsonb, bigint)`,
    NO toca la tabla. Pendiente de aplicar contra Supabase real, no
    ejecutado ningún cambio de BD.
  - Jira: comentado con el detalle completo (por qué no se dropea la
    tabla, por qué no se tocó el frontend), pasado a "En revisión".
- [x] Sin cambios de código frontend en esta sesión (solo el archivo SQL
  nuevo) -- no corresponde `npm run build`.
- [x] Commit local (sin push).

## Sesión 6 — KAN-78 y KAN-63 (los dos pendientes que quedaron "en curso" de la Sesión 2)

Contexto: KAN-78 y KAN-63 habían quedado documentados sin implementar porque
en su momento el alcance no estaba confirmado. Se confirmó con el owner que
sí tienen alcance claro -- implementados en esta sesión.

- [x] **KAN-78** (vista del lienzo por rol -- Líder/Supervisor de Red):
  guard de `EstructuraOrganizacional.tsx` ahora admite `LIDER_RED` (antes
  solo `SUPER_ADMIN`/`SUPERVISOR`, bloqueaba la página entera). Ven el
  lienzo completo; `useMisRoles` + una función `puedeEditarRed` nueva
  acotan qué clicks abren edición real (solo su propia Red y las CdP
  dentro de ella) vs. el panel genérico de solo lectura (mismo criterio
  que ya usa el lienzo para Pastor cuando lo ve el Supervisor -- confirmé
  que esa parte de Supervisor ya estaba bien, sin cambios). "Nueva Red" y
  la protección OTP global quedan ocultas para ese rol; dentro de su
  propia Red, "Eliminar Red" y "designar por correo a alguien sin cuenta"
  también (exceden "mi propia Red").
  - Hallazgo real no pedido explícitamente pero necesario: el backend
    (`private.fn_estructura_puede_administrar`) solo autorizaba a
    `SUPER_ADMIN`/`SUPERVISOR` en las RPC del constructor de estructura --
    sin extenderlo, mostrar la Red como "editable" en el frontend hubiera
    sido engañoso (cada mutación real habría fallado con `SIN_PERMISO`).
    Migración nueva agrega `private.fn_estructura_puede_administrar_red`
    (reusa `fn_es_lider_de_red`, el mismo helper que ya usa
    `fn_asignar_cargo_cdp` para reconocer a Líder de Red sobre las CdP de
    su Red) y la aplica a `actualizar_red`, `asignar_cargo_red`,
    `quitar_cargo_red`, `crear_cdp` y el aviso por correo de designación.
    Fuera de ese alcance a propósito: crear/eliminar/reactivar Red, OTP
    global, e invitar por correo a alguien sin cuenta (siguen exclusivas
    de Supervisor/Super Admin).
  - Verifiqué que el resto de acciones dentro de una CdP (asignar/quitar
    líder, sublíder, anfitrión; reactivar una CdP eliminada) ya pasan por
    RPC/RLS que reconocían a Líder de Red desde antes (`fn_asignar_cargo_cdp`,
    `fn_estructura_reactivar_casa_de_paz`) -- no hizo falta tocarlas.
  - Migración `supabase/migrations/20260808280000_estructura_lider_red_administra_su_red.sql`
    (renombrada de `20260808270000` por colisión con la migración de otra
    sesión en paralelo -- KAN-96), pendiente de aplicar contra Supabase real.
  - Nota aparte, no es una regresión de este ticket: no existe ningún
    acceso desde el navbar a Estructura Organizacional para ningún rol
    operativo (decisión previa del owner, 2026-08-04 -- solo se abre desde
    Administración, que es Super Admin-only). Ya era así para Supervisor
    antes de este cambio; Líder de Red queda en la misma situación
    (acceso por URL directa).
  - Jira: comentado, pasado a "En revisión", assignee Gonzalo.
- [x] **KAN-63** (pendiente puntual): los botones "Cerrar panel" (X) de
  los 5 paneles laterales de Estructura Organizacional medían 36px de
  área táctil, bajo el mínimo de 44×44 (REQ-MOB-3). Mismo truco de
  pseudo-elemento ya usado en los botones de zoom/centrar del lienzo
  (`before:absolute before:-inset-1`), sin cambiar el tamaño visible.
  Jira: comentado, se queda "En curso" (lo único que falta de todo el
  ticket es la prueba en dispositivo físico real, que no puedo hacer
  desde acá).
- [x] Archivos tocados: `EstructuraOrganizacional.tsx`, `layout.ts`,
  `PanelRedEstructura.tsx`, `PanelCasaDePazEstructura.tsx`,
  `PanelDepartamentoEstructura.tsx`, `PanelDetalleEstructura.tsx`,
  `PanelPrincipalEstructura.tsx` (todos en
  `frontend/src/features/estructura-organizacional/` y
  `frontend/src/pages/`), migración SQL nueva.
- [x] `tsc -b` y `npm run build` limpios.
- [x] Commits locales (sin push): `29934c3` (KAN-78 + KAN-63) y `af32ad6`
  (renombre de la migración por la colisión).
- [ ] Falta: aplicar la migración `20260808280000` contra Supabase real y
  probar en vivo con una cuenta real de Líder/Supervisor de Red (entrar al
  lienzo por URL directa, confirmar que solo puede editar su propia Red y
  que el resto queda en solo lectura) antes de pasar KAN-78 a "Finalizada";
  prueba en dispositivo físico real para KAN-63.
