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
