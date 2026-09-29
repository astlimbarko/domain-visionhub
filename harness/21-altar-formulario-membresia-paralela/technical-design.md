# Diseño técnico — Ampliar el formulario de Altar a "membresía paralela"

Investigación real contra el código y el esquema de producción
(2026-09-29). Sin implementación -- base para que Matías lo termine.

## Punto de partida: qué existe hoy

- **`frontend/src/components/personas/DatosBasicosPersonaFields.tsx`** --
  el formulario de alta liviano que usa Altar hoy. Campos actuales:
  primer/segundo nombre, primer/segundo apellido, teléfono con prefijo de
  país, sexo (M/F), fecha de nacimiento, dirección. Es genérico a propósito
  (no sabe que es Altar).
- **`frontend/src/pages/AfirmacionAltar.tsx`** -- pestaña "Nuevo" monta
  ese componente + botón Guardar; `handleCrearYContinuar()` llama a
  `crearPersona` / `agregarTelefono` / `agregarDireccion` y luego pasa al
  paso "Confirmar Altar" (que ya pide la fecha).
- El registro del Altar en sí (`fn_afirmacion_registrar_proceso`) inserta
  en `persona_proceso_afirmacion` -- NO toca datos de membresía. El
  formulario ampliado tiene que escribir además en la ficha de la persona
  (ver Hallazgo 3).

## Hallazgo 1: es una extensión de DatosBasicosPersonaFields, no un form nuevo

El formulario ampliado agrega campos de membresía liviana (estado civil,
ocupación, bautismo, categoría de evangelismo, tipo de decisión, horario
de contacto) sobre los que ya tiene `DatosBasicosPersonaFields`. Dos
caminos posibles (decisión de implementación de Matías):

- **A)** Extender `DatosBasicosPersonaFields` con props opcionales
  (`variante="altar-membresia"`) que muestren los campos extra -- mantiene
  un solo componente reusable.
- **B)** Un componente nuevo `AltarMembresiaFields` que **componga**
  `DatosBasicosPersonaFields` adentro y le sume las secciones de membresía
  -- evita inflar el componente base que también usarán RSIL/Fiesta.

Recomendación: **B**, porque RSIL y Fiesta de Bienvenida
(`harness/20-`) van a reusar `DatosBasicosPersonaFields` tal cual (sin
membresía) -- no conviene acoplarles los campos de Altar.

## Hallazgo 2: el formato Título ya existe, pero se aplica tarde

`frontend/src/utils/normalizarNombre.ts` (KAN-264) ya convierte a "Primera
mayúscula, resto minúscula" respetando partículas ("de la Cruz"). Pero en
`DatosBasicosPersonaFields.tsx` se aplica **`onBlur`** (líneas 72, 83, 94,
105), no en vivo. El owner pidió que el formato se vea **mientras se
escribe**, sin importar Bloq Mayús/Shift.

Cambio: aplicar `normalizarNombre` en `onChange` (o un handler que
formatee cada tecla) en vez de `onBlur`. Cuidado con el cursor: formatear
en cada `onChange` puede saltar el cursor al final -- probar y, si molesta,
usar un enfoque que respete `selectionStart`. `normalizarNombre` es puro,
sirve igual para onChange.

## Hallazgo 3: dónde se guarda cada dato de membresía (a la ficha real)

Decisión del owner: los datos de membresía van a la **ficha de la
persona**, no atados al Altar. Destinos reales existentes:

- `estado_civil`, `ocupacion`, `grado_instruccion`, `nacimiento_ciudad`
  → **`persona_detalle`** (ya existe, ya lo escribe
  `fn_guardar_membresia_extendida` / `fn_editar_membresia_extendida`).
- Bautismo → **`persona_detalle`**: `bautizado` (bool),
  `bautizado_en_nuestra_iglesia` (bool), `bautismo_anio/mes/dia`,
  `bautismo_precision_fecha` (confirmado en
  `fn_obtener_persona_editar_afirmacion`).
- Teléfono → tablas `telefono` / `telefono_asignacion` (ya lo hace
  `agregarTelefono` / `fn_guardar_telefono_membresia`).
- Dirección → tablas de dirección de persona (ya lo hace
  `agregarDireccion`).

**Falta backend real**: hoy el flujo de Altar (`handleCrearYContinuar` en
`AfirmacionAltar.tsx`) NO llama a `fn_guardar_membresia_extendida`. Hay que
o bien llamarlo desde el flujo de Altar con el subconjunto de campos de la
membresía paralela, o crear una RPC nueva
`fn_altar_registrar_persona_membresia(p_datos jsonb, ...)` que haga en una
transacción: crear/actualizar persona + persona_detalle + teléfono +
dirección + estado SSVA (Hallazgo 4) + registrar el proceso Altar. Evaluar
reusar `fn_guardar_membresia_extendida` filtrando solo los campos livianos.

> **Ojo permiso (importante):** cualquier RPC nueva de Afirmación debe
> incluir `fn_es_super_admin()` en el gate de permiso desde el día uno --
> hoy mismo (2026-09-29) se corrigieron 2 funciones de Afirmación que no lo
> tenían y rompían para Super Admin. No repetir ese descuido.

## Hallazgo 4: tipo de decisión → estado SSVA (persona_estado + fn_transicionar_estado)

El estado SSVA vive en **`persona_estado`** (`harness/05-estados-ssva/`),
con estados SIM/NC/CRE/RE, una fila vigente por persona
(`uq_persona_estado_vigente`), y `fn_transicionar_estado(...)` con
`motivo` + `es_automatico` para distinguir transición del sistema vs.
manual.

Mapeo pedido por el owner:
- Persona nueva + Salvación → transicionar a **NC** (automático,
  `es_automatico = true`, motivo tipo "captado en Altar").
- Persona existente + Salvación/Reconciliación → transicionar a **RE**.
- "Visita / simpatizante" → **SIM** (manual).

O sea, el "tipo de decisión" no se elige libremente: NC vs RE se deriva de
si la persona ya existía. La única elección manual real es marcar "Visita/
simpatizante". Ver open-questions #4 para cómo mostrarlo en la UI.

## Hallazgo 5: "¿Es bautizado?" -- falta un campo para la denominación

`persona_detalle` tiene `bautizado` y `bautizado_en_nuestra_iglesia`
(booleanos) -- alcanza para "Centro de Vida (sí/no)". Pero el formulario
distingue además **Iglesia Católica** vs **Iglesia Evangélica** y pide
**cuál iglesia** cuando el bautismo fue externo. No hay un campo para esa
denominación/nombre de iglesia externa. Opciones (open-questions #5):
- Columna nueva en `persona_detalle`, ej. `bautismo_denominacion VARCHAR`
  y/o `bautismo_iglesia_nombre TEXT`.
- O un enum `bautismo_origen_enum` ('CATOLICA','EVANGELICA','CENTRO_VIDA').

Semántica a confirmar: "Centro de Vida" = cualquiera de nuestras iglesias
Centro de Vida del mundo (no solo la iglesia actual) -- eso NO es
exactamente `bautizado_en_nuestra_iglesia` (que hoy implica ESTA iglesia).
Revisar antes de reusar ese booleano.

## Hallazgo 6: categoría de evangelismo -- catálogo tipo_evangelismo

El catálogo `tipo_evangelismo` en producción tiene hoy exactamente:
`UNO_A_UNO` ("1+1"), `ELITE` ("Elite"), `SEMILLA` ("Semilla"). El
formulario muestra **1+1 / CDP / Elite** -- "CDP" no está en el catálogo y
"Semilla" no está en el formulario.

Decisión del owner: **CDP es un valor nuevo** = "persona que nunca vino a
la iglesia pero sí a las Casas de Paz". Sobre "Semilla": *"solo son números
y Daniel lo está investigando en Evangelismo cómo irá escrito -- sería
bueno preguntarle a Daniel si hay dudas con Semillas."* → **coordinar con
Daniel** antes de tocar el catálogo (Daniel está trabajando la épica de
Evangelista, `harness/19-`). Ver open-questions #6.

## Hallazgo 7: mapeo campo por campo del formulario de papel

| Campo (form) | Naturaleza | Destino en el sistema |
|---|---|---|
| FECHA | manual | Fecha del registro de Altar (ya existe en el paso "Confirmar Altar") |
| CATEGORÍA DEL SERVICIO | manual (futuro catálogo) | Por ahora NO se modela; solo fecha. Documentar catálogo futuro (Hallazgo 6 de requisitos, Req 7) |
| NOMBRES Y APELLIDOS | manual | 4 campos separados + `normalizarNombre` EN VIVO (Hallazgo 2) |
| SEXO | manual | `persona.sexo` (M/F). "Sin especificar" no existe hoy → open-questions #8 |
| EDAD | inferible | `persona.fecha_nacimiento` + mecanismo edad-aproximada de CdP (Hallazgo 8) |
| ESTADO CIVIL | membresía | `persona_detalle.estado_civil` |
| DIRECCIÓN | membresía | tablas de dirección de persona (ya existe `agregarDireccion`) |
| OCUPACIÓN | membresía | `persona_detalle.ocupacion` |
| NÚMERO DE CELULAR | manual/membresía | teléfono (ya existe `agregarTelefono`) |
| HORARIO DE CONTACTO | manual | **Sin campo hoy** → open-questions #9 |
| TIPO DE DECISIÓN | auto + manual | Estado SSVA (Hallazgo 4): NC/RE automático, SIM (Visita) manual |
| ES BAUTIZADO? | membresía | `persona_detalle.bautizado` + `bautizado_en_nuestra_iglesia` + campo nuevo de denominación (Hallazgo 5) |
| ASISTE A CASA DE PAZ? (cuál líder) | manual | **Sin destino claro** → open-questions #10 (¿vincular a CdP real o texto?) |
| CÓMO LLEGÓ A LA IGLESIA? | manual | `persona_llegada` / `invitado_por_id` o texto → open-questions #11 |
| CATEGORÍA (1+1/CDP/Elite) | manual | `tipo_evangelismo` (CDP = valor nuevo, Hallazgo 6) |

## Hallazgo 8: mecanismo de fecha-de-nacimiento-o-edad ya existe (Casas de Paz)

Reusar el patrón de:
- `frontend/src/components/reporte/ModalFechaNacimientoFaltante.tsx` y
  `frontend/src/components/reporte/FichaRapidaAsistente.tsx`
  (`onGuardarEdadAproximada`, `edad_aprox`, `clasificarEdad` en
  `frontend/src/utils/edad.ts`).
- La regla "si no hay fecha, guardo edad aproximada pero sigo pidiendo la
  fecha después" ya está implementada ahí -- no reinventarla, reusar el
  mismo flujo/campo.

## Resumen de esfuerzo

- **Frontend**: componente de membresía liviana (compone
  `DatosBasicosPersonaFields`), formato Título en vivo, precarga de persona
  existente con verificación, mapeo de tipo de decisión → SSVA en la UI.
- **Backend**: RPC de alta que persista persona + `persona_detalle` +
  teléfono + dirección + estado SSVA + registro de Altar en una
  transacción (con `fn_es_super_admin()` en el gate); posibles columnas
  nuevas (denominación de bautismo, horario de contacto) según
  open-questions; valor `CDP` en `tipo_evangelismo` coordinado con Daniel.
