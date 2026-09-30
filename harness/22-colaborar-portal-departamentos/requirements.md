# Requisitos — Portal intermedio de Colaborar (Departamento → Colaboraciones)

Rediseño del flujo de **Colaborar** (KAN-485): al canjear un código, la
persona ya no cae directo en un formulario -- pasa por un **portal
intermedio de 2 niveles** (Departamento → Colaboración) hecho con tarjetas.
Escrito 2026-09-29 con decisiones del owner (Gonzalo). **Este harness es el
trabajo de Gonzalo (el portal).** Las pantallas de cada proceso
(Altar/Bautismo/RSIL/Membresía) son trabajo de Matías (ver
`harness/20-afirmacion-procesos-y-colaborar/` y
`harness/21-altar-formulario-membresia-paralela/`). El portal solo enruta a
esas pantallas, no las construye.

## Flujo objetivo

1. El **Líder de Afirmación** genera un código (ya existe,
   `AfirmacionColaboradores.tsx`).
2. Una persona **de cualquier rol** pone ese código y queda como
   **colaborador** automáticamente (ya existe, `Colaborar.tsx`).
3. Lo primero que ve es un **portal intermedio**: una tarjeta grande
   **"Afirmación"**, con las colaboraciones que tiene listadas más chico
   adentro de la tarjeta.
4. Hace clic en la tarjeta "Afirmación" → se ven las **colaboraciones** como
   tarjetas: **Altar, Bautismo, Retiro de Sanidad Interior (RSIL),
   Membresía**.
5. Hace clic en una colaboración → recién ahí ve el **contenido** de esa
   colaboración (su pantalla de proceso), con un botón para **volver al
   portal** y elegir otra.

## Glosario

- **Colaboración**: cada tarea de Afirmación que un colaborador puede
  hacer. Hoy son 4: Altar, Bautismo, RSIL, Membresía.
- **Membresía por link** (existente, NO se toca): el formulario de
  membresía actual (`RegistrarPersonaAfirmacion`), para miembros previos a
  la app / registro por link.
- **Membresía paralela** (nueva, colaboración "Membresía"): membresía
  liviana para gente nueva -- NO pregunta ministerio, cargo ni liderazgo
  (se asume que todos son nuevos). Es un concepto reusable, el mismo que
  usa el formulario de Altar en `harness/21`.
- **Departamento**: agrupador de nivel 1 del portal. Hoy solo Afirmación;
  el diseño anticipa que a futuro habrá otros (Evangelismo, etc.).

## Requisito 1 — El portal reemplaza el salto directo al formulario

WHEN una persona canjea un código válido y entra a Colaborar, THE SYSTEM
SHALL mostrar el portal intermedio de tarjetas -- NO el formulario único
actual ("Cargar persona"/"Mi historial") que salta de una. Ese flujo
directo se reemplaza por el portal.

## Requisito 2 — Nivel 1: tarjeta de Departamento

THE SYSTEM SHALL mostrar en el primer nivel una tarjeta por cada
**departamento** que el código habilite. Hoy solo **Afirmación**.

- WHERE hoy solo existe Afirmación, THE SYSTEM SHALL mostrar igual la
  tarjeta de departamento (nivel de 2 pasos), NO saltearla -- decisión del
  owner: el diseño anticipa que a futuro habrá más departamentos que
  también darán colaboraciones (ver open-questions #1 sobre el caso de un
  solo departamento).
- La tarjeta de Afirmación SHALL mostrar, más chico adentro, la lista de
  colaboraciones que contiene.

## Requisito 3 — Nivel 2: tarjetas de colaboración

WHEN el colaborador entra a la tarjeta "Afirmación", THE SYSTEM SHALL
mostrar las 4 colaboraciones como tarjetas: **Altar, Bautismo, RSIL,
Membresía**.

- THE SYSTEM SHALL habilitar **todas** las colaboraciones para cualquier
  código de Afirmación -- decisión del owner: el código NO tiene
  granularidad por tarea (todo colaborador de Afirmación ve las 4). Esto
  simplifica lo que KAN-485 planteaba originalmente (granularidad por
  tarea) -- se descarta esa granularidad por ahora.
- Bautismo y RSIL SHALL ser tarjetas **separadas e independientes** (aunque
  a veces se hagan el mismo día/momento, son cosas distintas). Bautismo y
  Membresía también son separadas, pero en la práctica van juntas (antes de
  bautizar se hace la membresía).

## Requisito 4 — Cada colaboración abre su pantalla de proceso

WHEN el colaborador hace clic en una colaboración, THE SYSTEM SHALL abrir
la **pantalla de proceso** correspondiente, reutilizando la pantalla que ya
existe (o que construye Matías), dentro del contexto de Colaborar (sin
sidebar).

- **Altar** ya existe (`/afirmacion-altar`, pantalla Buscar/Nuevo/Datos) --
  se reutiliza tal cual.
- **Bautismo, RSIL, Membresía** todavía no están construidas (las hace
  Matías). WHERE una pantalla de proceso aún no existe, THE SYSTEM SHALL
  mostrar la tarjeta como **"Próximamente"** / deshabilitada, sin romper el
  portal (mismo criterio que `DEPARTAMENTO_FUNCIONAL` en el resto de la
  app). Ver open-questions #2.
- THE SYSTEM SHALL ofrecer un botón **"Volver al portal"** desde cualquier
  colaboración, para que el colaborador elija otra sin cerrar sesión
  (decisión del owner).

## Requisito 5 — El colaborador ve solo lo suyo + trazabilidad

- WHERE la pantalla de proceso tiene un listado/historial (ej. la pestaña
  "Datos" de Altar), THE SYSTEM SHALL mostrar al colaborador **solo lo que
  él mismo registró** (Altar ya lo hace hoy -- el RPC fuerza al colaborador
  raso a ver solo sus registros).
- THE SYSTEM SHALL conservar la trazabilidad de cada registro (persona,
  colaborador, fecha/hora) con los mecanismos que ya existen
  (`creado_por`/`fecha_creacion` + `colaborador_sesion`). Ver
  open-questions #3 sobre si además hace falta guardar el código puntual
  usado.

## Requisito 6 — Vigencia y acceso

- THE SYSTEM SHALL permitir que **cualquier rol** con un código válido use
  el portal (ya funciona así).
- THE SYSTEM SHALL respetar la vigencia temporal del código en todo el
  portal: al vencer o revocarse, se pierde el acceso (ya existe); los datos
  registrados NO se borran y quedan disponibles para los roles autorizados.

## Fuera de alcance de este harness

- Las pantallas de proceso en sí (Altar existe; Bautismo/RSIL/Membresía las
  hace Matías, `harness/20` y `21`).
- Granularidad por tarea en el código (descartada por ahora -- ver Req 3).
- Fiesta de Bienvenida: queda **fuera** de las colaboraciones de Colaborar
  por ahora (decisión del owner, 2026-09-29).
- Departamentos distintos de Afirmación: el diseño los anticipa, pero no se
  construyen acá.
