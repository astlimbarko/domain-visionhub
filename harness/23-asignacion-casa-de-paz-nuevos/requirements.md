# Requisitos — Asignación de Casa de Paz para nuevos sin afinidad

Idea nueva del owner (2026-09-30), NO estaba prevista, sin ticket todavía.
**Esto es SOLO spec por ahora** -- la asignación en sí (menú del líder +
notificaciones) NO se implementa aún. Lo único que SÍ se implementa ya (en
la Membresía desde 0, harness/21) es la **opción "Asignar"** en el formulario
de captación (ver Requisito 1). El resto queda documentado acá para después.

## Contexto

Todos los que llenan la membresía / se registran en los procesos de
captación (Altar, Bautismo, RSIL, Membresía desde 0) **normalmente YA tienen
Casa de Paz**: por defecto es la CdP de la persona que los invitó, o la de
alguien con quien tienen afinidad. Ese es el ~99.9% de los casos.

Pero existe un ~0.1%: alguien **nuevo que no fue invitado por nadie
existente y no tiene afinidad con nadie**. Hoy no había forma de manejar ese
caso -- quedaba sin CdP y sin proceso para resolverlo.

## Requisito 1 — Casa de Paz en TODAS las puertas de entrada (confirmado 2026-10-01)

WHEN se añade una persona nueva en cualquier "puerta de entrada" (añadir
nueva persona de **Altar, Bautismo, RSIL y Membresía desde 0**), THE SYSTEM
SHALL capturar su Casa de Paz con **3 modos**: por invitador/afinidad (se
elige la persona que lo invitó, se deriva su CdP), elegir de la **lista**
manualmente, o **ninguna → derivar a designación** (queda sin CdP, pendiente
del Requisito 2). Decisión del owner (2026-10-01): aplica a las 4 puertas,
no solo a la Membresía.

- Componente reusable ya en master: **`SelectorCasaDePaz`**
  (`frontend/src/components/afirmacion/SelectorCasaDePaz.tsx`) -- lo usan
  todas las puertas de entrada, no duplicar la lógica.
- WHERE se elige "ninguna/asignar", THE SYSTEM SHALL guardar la persona sin
  CdP y dejarla en la cola de pendientes de asignación (Requisito 2).
- **Pendiente (lógica de guardado compartida, aún no existe)**: aplicar la
  CdP capturada al guardar (INVITADOR → CdP del invitador; LISTA → esa CdP;
  ASIGNAR → sin CdP). Hoy ni la Membresía ni Altar tienen ese guardado -- es
  trabajo común a definir, va junto con el guardado final de harness/21.

- WHERE la persona SÍ tiene invitador/afinidad, THE SYSTEM SHALL tomar por
  defecto la CdP de esa persona (flujo normal).
- WHERE se elige "Asignar", THE SYSTEM SHALL guardar la persona sin CdP y
  dejarla en la cola de pendientes de asignación.

## Requisito 1b — Selector enriquecido + guardado real (decisiones owner 2026-10-01 s3)

Refina el Requisito 1 con el flujo concreto a implementar AHORA (partes A+B;
el panel del líder = Requisito 2 queda para después). Ruta de trabajo:

1. **Backend**: `fn_listar_cdp_asistencia` suma el **líder** de cada CdP, para
   poder buscar por líder (además de nombre de CdP y Red; ya trae satélites).
2. **Selector unificado**: fusionar `SelectorCasaDePaz` (Altar/Bautismo/RSIL) y
   `SelectorCdpBuscable` (Membresía) en UN componente, con:
   - **Invitador**: buscar en el sistema **o** escribir un **nombre libre**
     (`persona_llegada.invitado_por_txt` para el caso libre; `invitado_por_id`
     para el real).
   - IF el invitador existe en el sistema y tiene CdP → **auto-sugerir su CdP**,
     con opción de **cambiarla** (override flexible — el invitado puede ir a otra).
   - IF el invitador es nombre libre → ofrecer **elegir CdP a mano O dejar en
     "Asignar"** (las dos opciones).
   - **Elegir CdP**: buscador por **nombre de CdP + líder + Red** (+ satélites).
     Buscar por **zona/dirección** queda FUERA por ahora: las CdP no tienen
     dirección/zona cargada (requiere trabajo previo). Anotado para después.
   - **Asignar**: fallback cuando no hay datos → sin CdP, va a designación.
3. **Guardado real (parte B)**: la CdP capturada se **guarda de verdad** al dar
   de alta en Altar/Bautismo/RSIL (hoy se DESCARTA — TODO harness/23). Reusar la
   lógica de `fn_guardar_membresia_nuevos` (INVITADOR deriva CdP del invitador;
   LISTA → esa CdP, incl. satélite; ASIGNAR → sin CdP). Guardar `invitado_por`
   (id o txt).
4. Reemplazar el `SelectorCasaDePaz` viejo por el unificado en las 4 puertas.

Resuelve open-questions #2 (invitador: sistema + texto libre) y #4 (aplica a las
4 puertas ya). El panel de designación (Req 2/3) y zona-por-dirección siguen pendientes.

## IDEA A MADURAR — Panel de recepción en la Casa de Paz (owner 2026-10-01 s3, NO implementar aún)

> Semilla del owner, **sin harness propio todavía**. Crear la documentación
> completa de este panel más adelante (el owner pidió que se lo recuerde).
>
> Las personas que caen en "Asignar" (sin CdP) necesitan un **lugar donde se
> reciben**: un panel/opción **a nivel de cada Casa de Paz** donde van
> **apilándose por antigüedad** (orden de llegada) a medida que llegan más, y
> el **Líder de la Casa de Paz** trabaja ahí (los recibe/gestiona). Por ahora
> la idea es mínima: asignar ese panel a las CdP y que aparezca el nombre de
> cada persona, apilándose. Falta madurar el flujo completo (cómo se asigna a
> una CdP concreta, quién decide, notificaciones) -> ahí se cruza con los
> Requisitos 2 y 3 de abajo. NO se implementa nada todavía.

## Requisito 2 — Menú de Asignación del Líder de Afirmación (harness, NO ahora)

THE SYSTEM SHALL ofrecer al **Líder del Departamento de Afirmación** un menú
"Asignación" donde ve la lista de personas nuevas **pendientes de asignación**
(las marcadas "Asignar"), mostrando solo **nombre y datos básicos**.

- THE SYSTEM SHALL permitir al líder **asignar** cada persona pendiente a la
  Casa de Paz de ese líder (o a la que corresponda), desde ese mismo menú.
- Al asignar, la persona pasa a tener CdP y sale de la cola de pendientes.

## Requisito 3 — Aviso al líder de nuevos recibidos (harness, NO ahora)

THE SYSTEM SHALL avisar al Líder de Afirmación cuando hay nuevos pendientes
de asignación -- notificación + acceso al menú de Asignación. (Mecanismo de
notificación ya existe en el proyecto, ver `fn_crear_notificacion`.)

## Alcance / orden de trabajo

- **Ahora (dentro de harness/21, Membresía desde 0)**: solo la opción
  "Asignar" del formulario (Requisito 1) -- guardar la persona sin CdP
  cuando no hay afinidad.
- **Después (este harness, sin ticket aún)**: el menú de Asignación del
  líder (Requisito 2) y el aviso (Requisito 3).

## Preguntas abiertas

1. ¿Cómo se marca "pendiente de asignación" en la base? (flag en persona,
   ausencia de fila en `casa_de_paz_membresia`, o una tabla/cola propia).
2. En el formulario, ¿cómo se captura el invitador/afinidad? (buscador de
   persona que deriva su CdP, vs elegir CdP directamente). Hoy `form_altar.png`
   lo tenía como texto libre ("cuál líder" / "quién lo invitó").
3. ¿La cola de pendientes es por iglesia? ¿Un pendiente puede ser asignado
   por cualquier líder de Afirmación de esa iglesia o solo uno?
4. ¿Aplica retroactivo a Altar/RSIL/Bautismo o solo a Membresía desde 0 por
   ahora?
