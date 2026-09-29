# Diseño técnico — Evangelista personal + UI v2

Investigación real hecha contra el esquema de producción antes de
proponer nada (2026-09-29). No se implementó código todavía -- este
documento es la base para que el owner confirme antes de programar.

## Hallazgo 1: modelo de roles existente -- dónde encaja "Evangelista"

`rol_sistema_enum` (roles estructurales, uno vigente por persona+iglesia):
`SUPER_ADMIN, PASTOR, SUPERVISOR_VISION_ACCION, LIDER_RED, LIDER_CDP,
SUBLIDER_CDP`. Todos ligados a una posición en la jerarquía (una persona,
un puesto).

Aparte existe el patrón de **capacidad ortogonal** ya usado 2 veces:
- `fn_es_lider_afirmacion_en` / `fn_es_lider_evangelismo_en` (Líder de
  Departamento, vía `departamento_cargo` + `departamento_codigo`).
- `fn_es_colaborador_activo_en` (KAN-405, colaborador temporal por
  código, vía `colaborador_sesion`, con vigencia por tiempo).

"Evangelista" no encaja en ninguno de los dos: no es un cargo estructural
(cualquier miembro puede serlo, no reemplaza su rol actual) y no es
temporal como un colaborador. **Es una tercera clase de capacidad
ortogonal, permanente, otorgable a cualquier Persona sin importar su rol
estructural.** Propuesta: tabla nueva `persona_evangelista` (o similar),
`persona_id` + `iglesia_id` + `activo` + auditoría, con
`fn_es_evangelista_en(p_iglesia_id)` como helper `SECURITY DEFINER`,
mismo patrón de RLS que ya usa el resto del proyecto (sin policies de
escritura directa, todo por RPC).

**Nombre interno**: NO reusar el código `EVANGELISTA` que ya existe en
`cargo.codigo` (usado como valor de `efesio_tipo` en
`persona_censo_membresia`, dato censal, nada que ver con acceso al
sistema -- ver aclaración del owner, 2026-09-29). Sugerido:
`persona_evangelista` como nombre de tabla, evita cualquier colisión de
grep/lectura futura con el efesio.

## Hallazgo 2: la tabla `evangelismo` ya existe y ya soporta este caso

Columnas reales (`information_schema.columns`, producción):

```
id, iglesia_id, persona_id, casa_de_paz_id (NULLABLE), escala, fecha,
domicilio, evangelizado_por_id (NULLABLE), observaciones, tipo_evangelismo_id
(NULLABLE), es_reconciliacion, + auditoría estándar
```

`casa_de_paz_id` ya es NULLABLE -- confirmado con el owner (2026-09-29):
un Evangelista-miembro puede guardar en esta misma tabla, sin forzar una
CdP. Propuesta: **reusar `evangelismo` para el registro de KAN-430**, no
crear una tabla paralela -- insertar con `casa_de_paz_id = NULL` cuando
el registro es "personal" (no asociado a una CdP puntual), y
`evangelizado_por_id`/`creado_por` identifican al Evangelista. Evita
duplicar catálogo, evita divergencia futura entre "evangelizados de CdP"
y "evangelizados personales" cuando en el fondo son el mismo concepto de
negocio.

Falta confirmar (ver preguntas abiertas): si además hay que distinguir
"vino de un Evangelista personal" vs. "vino de una CdP" para las
estadísticas existentes de Afirmación/Departamento de Evangelismo, que
hoy ya filtran por `tipo_evangelismo_id` (ver
`fn_afirmacion_estadisticas_personas`, excluye `SEMILLA`).

## Hallazgo 3: `tipo_evangelismo` ya trae exactamente lo pedido

```
UNO_A_UNO -> "1+1"
ELITE     -> "Elite"
SEMILLA   -> "Semilla"
```

El campo "tipo de evangelismo" que pidió el owner (2026-09-29, faltaba
en el boceto `2.jpeg`) se resuelve con un `<Select>` sobre este catálogo
ya existente -- mismo patrón que ya usa el resto del proyecto para
catálogos chicos (`useEstados`, etc.), sin tabla nueva.

## Hallazgo 4: no existe tabla de seguimiento/contacto

Búsqueda en `information_schema.tables` por `%seguimiento%`/`%contacto%`:
0 resultados. KAN-432 requiere una tabla nueva real, ej.
`evangelismo_seguimiento` (`evangelismo_id`, `fecha_hora`, `medio`
enum WHATSAPP/LLAMADA/VISITA, `notas`, `registrado_por`, auditoría). N
filas por `evangelismo_id`, sin límite -- el "1 de 2 contactos" del
mockup es solo el ejemplo, no una regla (confirmado en KAN-431/432).

## Hallazgo 5: formulario de alta -- reuso directo confirmado

El boceto `2.jpeg` (Nueva persona) tiene el **mismo set de campos exacto**
que `DatosBasicosPersonaFields.tsx` (creado hoy, 2026-09-27/29, para
KAN-481 Altar de Afirmación): primer/segundo nombre, primer/segundo
apellido, teléfono con selector de país, sexo, fecha de nacimiento,
dirección. KAN-430 reusa ese componente tal cual -- no se reescribe
nada, solo se le agrega el `<Select>` de tipo de evangelismo (Hallazgo 3)
como campo extra específico de este formulario.

## Hallazgo 6: borrador/autoguardado -- precedente ya existente

VisionHub ya tiene un patrón de borrador progresivo en el formulario de
Reportes de CdP (ver KAN-443, `visionhub-kan443-borrador-vacio-falso-restaurado`
en memoria -- guard `hayContenidoReal` para no disparar el autoguardado
con solo la fecha precargada). KAN-430 debe seguir ese mismo patrón
(debounce al salir de campo, indicador discreto "Guardando.../Guardado"),
adaptado para que el borrador nunca cuente como persona evangelizada
real hasta que se presione "Guardar".

## Hallazgo 7: racha -- mismo criterio de fecha que ya usa el proyecto

`calendario-fechas.ts` ya centraliza el manejo de fechas ISO sin UTC
crudo (`aISO`, `desdeISO`, ver `fechaCumpleEnPeriodo` agregada hoy mismo
para KAN-474). La racha de KAN-429 debe calcularse con esas mismas
utilidades -- días consecutivos con al menos un `evangelismo` insertado
por ese Evangelista, usando fecha calendario (no timestamp UTC), mismo
principio que ya evitó un bug real de zona horaria en otros módulos.

## Hallazgo 8: UI v2 -- alcance de "base reutilizable"

KAN-428 pide una base de tokens/componentes reutilizable, sin romper la
UI v1 actual. Dado que este proyecto ya tiene un sistema de diseño
consolidado (ver `frontend-style` skill: `KpiMosaico`, `TarjetaHeader`,
paleta AZUL/VERDE/AMBAR/MORADO/TEAL, radios `rounded-xl/2xl/3xl`), la
UI v2 de Evangelismo (degradados cálidos naranja/rojo, banner con SVG,
racha con fuego) es una **paleta y unos componentes nuevos que conviven
con el sistema existente**, no un reemplazo -- análogo a cómo Afirmación
ya tiene su propio degradado celeste sin romper el resto de la app
(mismo criterio aplicado hoy en la pantalla de Altar, KAN-481).
Propuesta de ubicación: `frontend/src/components/evangelista/` (paralelo
a `frontend/src/components/afirmacion/`), con sus propios tokens locales
en vez de tocar `index.css` global.
