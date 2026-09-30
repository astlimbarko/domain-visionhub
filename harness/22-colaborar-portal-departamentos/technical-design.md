# Diseño técnico — Portal intermedio de Colaborar

Investigación contra el código real (2026-09-29). El portal es trabajo de
Gonzalo; las pantallas de proceso las hace Matías. Sin implementación
todavía.

## Estado actual

- **`frontend/src/pages/Colaborar.tsx`** (ruta `ROUTES.COLABORAR`): pantalla
  propia SIN `AppShell`/sidebar (barra oscura propia, se autoprotege con
  `isAuthenticated`). Hoy: `FormularioCodigo` (canje) → si hay sesión
  activa, salta DIRECTO a un `<Tabs>` con "Cargar persona"
  (`RegistrarPersonaAfirmacion`) + "Mi historial". **No hay portal
  intermedio.** Este `<Tabs>` directo es lo que el Req 1 reemplaza.
- **`frontend/src/pages/AfirmacionColaboradores.tsx`**: panel del Líder de
  Afirmación para generar/gestionar códigos (`GenerarCodigoCard`, lista de
  activos, historial). No hace falta tocarlo para el portal (el código
  sigue habilitando todo Afirmación).
- **Esquema** (`20260921100000_kan405_colaboradores_temporales.sql`):
  `colaborador_codigo.departamento_codigo VARCHAR DEFAULT 'AFIRMACION'` y
  `colaborador_sesion` con `departamento_codigo`. La granularidad ya es por
  **departamento**, no por tarea -- y como el owner descartó la
  granularidad por tarea (Req 3), **no hace falta ningún cambio de
  esquema** para el portal. `fn_es_colaborador_activo_en(iglesia,
  departamento)` ya alcanza.

## Hallazgo 1: el nivel 1 (departamentos) puede reusar lo que ya existe

Hay una tabla `departamento` (Evangelismo/Afirmación/Discipulado/Envío) y,
en el front, `DEPARTAMENTO_META` (`frontend/src/utils/departamentos.ts`)
con verbo + color por departamento, y `DEPARTAMENTO_FUNCIONAL` para marcar
cuáles tienen gestión real (hoy solo Afirmación muestra funcionalidad, el
resto "Próximamente"). El portal SHALL reusar `DEPARTAMENTO_META` para la
tarjeta de nivel 1, no inventar otro mapa. El diseño multi-departamento
sale casi gratis: mostrar una tarjeta por departamento que el código
habilite (hoy `departamento_codigo` de la sesión = 'AFIRMACION').

## Hallazgo 2: el nivel 2 (colaboraciones) es una lista fija de 4 por ahora

Las 4 colaboraciones (Altar/Bautismo/RSIL/Membresía) son un catálogo
chico. Propuesta: definirlas en el front como una constante
(`COLABORACIONES_AFIRMACION`) con `{ codigo, label, icono, ruta,
disponible }` -- `disponible: true` solo para Altar hoy; el resto
`false` → tarjeta "Próximamente". Cuando Matías termine cada pantalla, se
pasa a `true` y se apunta su `ruta`. No hace falta tabla de base para esto
por ahora (mismo criterio que `DEPARTAMENTO_META`).

## Hallazgo 3: cómo abrir la pantalla de proceso dentro de Colaborar

Colaborar vive fuera de `AppShell` (sin sidebar). La pantalla de Altar
(`AfirmacionAltar.tsx`) hoy se usa dentro de `AppShell` en
`/afirmacion-altar`. Dos caminos (decisión de implementación):

- **A)** Reusar el componente `AfirmacionAltar` embebido dentro del shell
  de Colaborar (render directo del componente, no navegación de ruta) --
  requiere que el componente no dependa de nada del `AppShell`. Hay que
  revisar que `AfirmacionAltar` funcione montado fuera de su ruta (usa
  `useAuthStore`, `useEsLiderAfirmacion` -- para un colaborador raso,
  `esLiderAfirmacion=false`, `puedeVerTodos=false`, así que la pestaña
  Datos ya cae en "solo lo mío", correcto).
- **B)** Navegar a la ruta real (`/afirmacion-altar`) con un flag de
  contexto "colaborador" que oculte el sidebar. Más invasivo.

Recomendación: **A** (embeber el componente en el shell de Colaborar), para
mantener el portal como una capa de acceso y no duplicar routing. El botón
"Volver al portal" (Req 4) es estado local del portal (qué colaboración
está abierta), no navegación de router.

## Hallazgo 4: "solo lo mío" ya está resuelto en Altar

`fn_afirmacion_historial_proceso` ya fuerza al colaborador raso (no
operativo/pastor/líder de Afirmación) a ver solo sus propios registros,
ignorando cualquier filtro que pase. Es decir, el Req 5 ya está cubierto
para Altar sin trabajo extra -- las pantallas nuevas de Matías
(Bautismo/RSIL/Membresía) deben seguir ese mismo patrón (ya documentado en
harness/20).

## Hallazgo 5: la colaboración "Membresía" usa la membresía paralela

La colaboración "Membresía" NO es el formulario actual
(`RegistrarPersonaAfirmacion` = membresía por link, para miembros previos a
la app -- NO se toca). Es una **membresía paralela** liviana (sin
ministerio/cargo/liderazgo), el mismo concepto reusable que define
`harness/21-altar-formulario-membresia-paralela/`. O sea: el componente de
membresía paralela que arma Matías para Altar se reusa como la pantalla de
la colaboración "Membresía". Bautismo es una pantalla aparte (registrar
bautismo, patrón tipo Altar/RSIL) que en la práctica se hace junto con la
membresía pero es una colaboración distinta.

## Resumen de esfuerzo (solo el portal, trabajo de Gonzalo)

- **Frontend**: reescribir el cuerpo de `Colaborar.tsx` para que, con
  sesión activa, muestre el portal de 2 niveles (tarjeta departamento →
  tarjetas de colaboración) en vez del `<Tabs>` directo; estado local para
  navegar portal ↔ colaboración; embeber `AfirmacionAltar` para la tarjeta
  Altar; "Próximamente" para las otras 3 hasta que existan; botón "Volver
  al portal". Reusar `DEPARTAMENTO_META` y el sistema de diseño
  (`frontend-style`).
- **Backend**: ninguno para el portal (la granularidad por departamento ya
  existe; sin granularidad por tarea; "solo lo mío" ya resuelto).
