# Requisitos — Procesos de Afirmación (RSIL/Fiesta/Bautismo) + Colaborar por tarjetas

Épica compuesta por 4 tickets de Jira (KAN-482 a 485), todos ya creados por
el owner con criterios de aceptación completos -- este documento los
resume en formato EARS y los conecta con lo que YA existe en el código
(KAN-481 Altar, ya implementado y en producción). No se implementó código
todavía -- solo investigación (2026-09-29).

## Glosario rápido

- **Proceso de Afirmación**: cualquiera de los 4 pasos que Afirmación
  registra sobre una persona -- Altar, Bautismo/Membresía, Retiro de
  Sanidad Interior y Liberación (RSIL), Fiesta de Bienvenida. Una persona
  puede pasar por cualquiera en cualquier orden, sin bloqueos artificiales.
- **Tarea** (KAN-485): sinónimo operativo de "proceso" cuando se habla
  desde el punto de vista de un Colaborador -- qué puede hacer con su
  código, no qué le falta a la persona.
- **Colaborador**: cuenta con código temporal (KAN-405), sin rol
  estructural necesario en esa iglesia. Hoy el código autoriza a nivel de
  **departamento** (`AFIRMACION`) -- KAN-485 pide bajar la granularidad a
  **tarea** dentro de ese departamento.

## Requisito 1 — Retiro de Sanidad Interior y Liberación (KAN-483)

**THE SYSTEM SHALL** ofrecer una pantalla "RSIL" con buscador inteligente
de personas + botón "+" para alta rápida, siguiendo el mismo patrón visual
y funcional que Altar (KAN-481).

- WHEN el usuario selecciona una persona existente o recién creada, THE
  SYSTEM SHALL permitir registrar la fecha del retiro.
- WHERE una persona ya registró un RSIL antes, THE SYSTEM SHALL permitir
  registrar una fecha adicional (historial de N ocurrencias), nunca
  sobrescribir la anterior.
- THE SYSTEM SHALL derivar el estado acumulado ("realizó RSIL: sí/no")
  de la existencia de al menos un registro, nunca de una columna booleana
  aparte -- una vez true, nunca vuelve a false automáticamente.
- THE SYSTEM SHALL NOT bloquear el registro de RSIL porque la persona no
  tenga registrado Altar u otro proceso.
- WHERE el registro lo hace un Colaborador temporal, THE SYSTEM SHALL
  conservar trazabilidad (colaborador, código, fecha/hora), igual que ya
  hace Altar.

## Requisito 2 — Fiesta de Bienvenida (KAN-484)

Mismos criterios que el Requisito 1, aplicados al proceso "Fiesta de
Bienvenida" -- mismo patrón, mismo componente base, solo cambia el rótulo
y el código de proceso.

## Requisito 3 — Bautismo/Membresía: mejorar registro, listado y edición (KAN-482)

**THE SYSTEM SHALL** reutilizar el formulario de Membresía ya existente
(`RegistrarPersonaAfirmacion.tsx`) para el proceso de Bautismo -- IF NOT
THE SYSTEM SHALL NOT crear un formulario ni una tabla de persona
alternativa.

- WHEN se completa el registro, THE SYSTEM SHALL guardar la fecha de
  bautismo (campo hoy inexistente en el formulario -- ver Hallazgo 3 en
  technical-design.md).
- THE SYSTEM SHALL agregar una segunda pestaña "Personas registradas" con
  tarjetas (no tabla) de las personas que el usuario fue cargando.
- WHEN el usuario hace clic en una tarjeta, THE SYSTEM SHALL abrir el
  detalle de esa persona con una acción "Editar" que actualiza el
  registro existente -- nunca crea una persona ni una membresía nueva.
- THE SYSTEM SHALL revisar (no eliminar a ciegas) los campos del
  formulario actual que asumen "persona nueva que llega a la iglesia"
  (cargos/responsabilidades) y decidir cuáles aplican a alguien recién
  bautizado.
- WHERE el registro lo hace un Colaborador temporal, THE SYSTEM SHALL
  aplicar las mismas reglas de alcance/trazabilidad que el resto de
  Afirmación (ver Requisito 4).

## Requisito 4 — Colaborar: pantalla intermedia por tarjetas (KAN-485)

**THE SYSTEM SHALL** insertar una pantalla intermedia entre "código
validado" y "formulario de tarea", con una jerarquía de navegación
`Colaborar → Afirmación → tarea específica` (nunca los 4 formularios
mezclados de entrada).

- WHEN el Colaborador canjea un código válido, THE SYSTEM SHALL mostrar
  una tarjeta "Afirmación" (única área hoy soportada por
  `colaborador_codigo`).
- WHEN el Colaborador hace clic en "Afirmación", THE SYSTEM SHALL mostrar
  tarjetas por cada tarea autorizada: Altar, Bautismo/Membresía, RSIL,
  Fiesta de Bienvenida.
- THE SYSTEM SHALL NOT asumir que un código autoriza las 4 tareas por
  igual -- IF el código no autoriza una tarea, THEN THE SYSTEM SHALL NOT
  mostrar esa tarjeta ni permitir acceder a ella (ver Hallazgo 5,
  requiere columna/tabla nueva -- hoy `colaborador_codigo` solo tiene
  granularidad de departamento).
- THE SYSTEM SHALL reutilizar las pantallas reales ya construidas (Altar
  hoy; RSIL/Fiesta/Bautismo cuando existan) -- Colaborar es una capa de
  acceso, nunca duplica formularios.
- THE SYSTEM SHALL rechazar en el backend (RPC/RLS) cualquier intento de
  usar una tarea no autorizada, aunque el frontend la oculte -- la
  restricción real nunca puede depender solo de esconder una tarjeta.
- THE SYSTEM SHALL mantener el resto del comportamiento ya construido de
  Colaborar (código con vigencia temporal, pausar/reanudar/finalizar
  desde el panel del líder, corte automático al vencer, datos que
  sobreviven al vencimiento del código).

## Patrón compartido de ver/editar persona (definido en harness 21)

RSIL, Fiesta de Bienvenida y Bautismo/Membresía SHALL seguir el mismo
patrón de ver/editar persona que se define para Altar en
`harness/21-altar-formulario-membresia-paralela/` (Requisito 8): al hacer
clic en una persona se abre el formulario del proceso **precargado con
campos bloqueados**, y "Editar" los desbloquea en el lugar -- NO la ficha
paginada actual (`FichaPersonaSheet`) ni el modal de advertencia. Lo mismo
para la pestaña de listado (tarjetas/tabla con hover, Requisito 9 de
harness 21). No se re-especifica acá para no duplicar -- ver harness 21.

## Fuera de alcance de este paquete

- Un 5to/6to proceso de Afirmación no mencionado en estos 4 tickets.
- Cambios al mecanismo de generación de código en sí (duración, formato)
  -- solo se agrega granularidad de tarea sobre lo que ya existe.
