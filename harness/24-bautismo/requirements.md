# Requisitos — Bautismo (proceso de Afirmación)

Harness corto. Bautismo es un **proceso de captación tipo "puerta de
entrada"** (como Altar/RSIL y las entradas de datos de Evangelismo):
registrar que una persona se bautizó. **Es casi un clon de Altar** (KAN-481)
+ un botón para llenar la membresía después. **Lo hace Gonzalo** (Matías no
puede ahora). Escrito 2026-10-01 con decisiones del owner.

## Concepto

- Altar, Bautismo y RSIL comparten el mismo patrón: el **99%** de la gente
  que pasa por estos procesos **ya está en el sistema** -> el núcleo es un
  **buscador** de persona. El **~1%** que no está es el motivo por el que
  hay un botón **"añadir persona"** (alta rápida).
- "Puerta de entrada" / "entrada de datos" es el nombre genérico de todos
  los lugares donde se registran/ingresan personas (casi todo nace en
  Evangelismo). Bautismo es una más.

## Requisito 1 — Pantalla única, sin scroll, PC y móvil

THE SYSTEM SHALL ofrecer una pantalla de Bautismo con el mismo layout de
Altar (pestañas Buscar / Nuevo / Datos), reusando `AfirmacionAltar.tsx`
como plantilla.

- WHERE sea PC o móvil, THE SYSTEM SHALL mostrar todo **en una sola
  pantalla sin necesidad de scroll** (objetivo de diseño, Req 8).

## Requisito 2 — Registrar el bautismo (fecha, historial)

WHEN el usuario selecciona una persona (existente o recién creada), THE
SYSTEM SHALL permitir registrar el bautismo con su **fecha**.

- THE SYSTEM SHALL permitir **más de un registro** (historial de fechas,
  mismo criterio que Altar) -- el estado acumulado ("bautizado: sí") se
  deriva de la existencia de al menos un registro, nunca vuelve a "no".
- THE SYSTEM SHALL NOT cambiar el **estado SSVA** de la persona al
  bautizar (decisión del owner: el SSVA es NC si aceptó a Cristo, y el
  bautismo no lo altera).

## Requisito 3 — Añadir persona (el ~1%)

WHERE la persona no está en el sistema, THE SYSTEM SHALL permitir darla de
alta con el **mismo formulario liviano de Altar** (`DatosBasicosPersonaFields`)
y continuar con el registro del bautismo.

## Requisito 4 — Pestaña "Datos" (igual que Altar)

THE SYSTEM SHALL ofrecer una pestaña "Datos" con los bautismos registrados:
el **colaborador ve solo lo que él registró** (forzado por el RPC); el
Líder de Afirmación / operativo / Pastor ven todo, con columna "Colaborador"
y filtro. Clic en una fila abre la ficha de la persona (como Altar).

## Requisito 5 — Botón "llenar membresía" (opcional, tras bautizar)

WHEN se registra un bautismo, THE SYSTEM SHALL mostrar un botón **"Llenar
membresía"** que abre la **Membresía (Nuevos)** (harness/21) de esa persona,
**precargada** con sus datos.

- Es **opcional**: se puede hacer en el momento o más tarde (decisión del
  owner). No bloquea el registro del bautismo.
- Como la persona del 99% **ya existe**, la Membresía (Nuevos) debe poder
  abrirse para una **persona existente** (precargar/verificar), no solo
  crear desde cero -- ver open-questions #1.

## Requisito 6 — Backend: nuevo proceso BAUTISMO

THE SYSTEM SHALL agregar `BAUTISMO` al enum `proceso_afirmacion_codigo_enum`
(hoy: ALTAR, RSIL, FIESTA_BIENVENIDA). Con eso, las funciones genéricas de
Afirmación (`fn_afirmacion_registrar_proceso`, `..._estado_proceso`,
`..._historial_proceso`) ya soportan Bautismo sin más cambios de esquema.

## Requisito 7 — Enchufar en el portal de Colaborar

THE SYSTEM SHALL conectar la tarjeta **"Bautismo"** del portal de Colaborar
(hoy "Próximamente", harness/22) a esta pantalla, reusándola embebida con
`iglesiaId` + "Volver al portal" (igual que Altar).

## Requisito 8 — Diseño unificado (objetivo, rediseño aparte)

El owner quiere un **molde visual único** para Altar/Bautismo/RSIL: una
sola pantalla sin scroll en PC y móvil, con **colores suaves** que
diferencien cada proceso. **A Altar no le gusta cómo luce hoy** -> Altar
queda **en revisión** para rediseñarse con ese molde, y una vez definido
sirve para los tres. El rediseño es trabajo aparte (no parte de este
harness), pero Bautismo debe nacer ya pensado para ese molde común.

## Fuera de alcance

- El rediseño visual unificado en sí (Req 8) -- es un trabajo aparte.
- RSIL y Fiesta de Bienvenida (siguen en harness/20).
- El guardado final de la Membresía (Nuevos) -- dependencia de harness/21,
  el botón del Req 5 lo necesita pero no se construye acá.
