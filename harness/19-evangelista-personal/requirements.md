# Requisitos — Evangelista personal + inicio de UI v2

Épica Jira: KAN-426. Historias: KAN-427 a KAN-434.

## Introducción

Hoy VisionHub ya tiene un módulo de **Evangelismo de Casa de Paz** (ver
[06-evangelismo-cdp](../06-evangelismo-cdp/requirements.md)) y un
**Departamento de Evangelismo** (Líder de Departamento, dashboard,
metas). Esta épica agrega un concepto nuevo, distinto de los dos
anteriores: el **rol Evangelista personal** -- cualquier miembro de la
iglesia (con o sin otro cargo) que quiere registrar y hacer seguimiento
de las personas que él mismo evangeliza, con un dashboard propio.

Esta épica también inicia **UI v2**: una segunda línea visual de
VisionHub (colores cálidos/degradados, tarjetas redondeadas, iconografía
propia), pensada para convivir con la UI actual mientras se migra módulo
por módulo, no para reemplazarla de golpe.

## Glosario -- ⚠️ distinción obligatoria, no mezclar

- **Rol Evangelista (esta épica)**: capacidad operativa que se le puede
  dar a cualquier persona de la iglesia -- accede al módulo nuevo,
  registra personas evangelizadas por él, hace seguimiento, ve sus
  propias métricas. Mandato general ("todo miembro puede evangelizar"),
  no es un título de honor ni requiere designación de una autoridad
  superior.
- **Efesio "Evangelista"** (ya existe, `persona_censo_membresia.efesio_tipo
  = 'EVANGELISTA'`, ver `20260821050000_afirmacion_censo_cargos_membresia.sql`):
  uno de los 5 dones ministeriales (Apóstol/Profeta/Pastor/Evangelista/
  Maestro, Efesios 4:11) -- es un **título de alto rango**, designado por
  el Apóstol (Edgar, Cochabamba), registrado en el censo de membresía
  como dato descriptivo. **No implica ningún acceso al sistema.**
- **Departamento de Evangelismo** (ya existe, KAN-281 a 343): Líder de
  Departamento con dashboard de supervisión/consolidación de todas las
  Casas de Paz de la iglesia. Rol de supervisión, no de registro
  individual.
- **Evangelismo de Casa de Paz** (ya existe, 06-evangelismo-cdp): registro
  de evangelizados hecho por el Líder/Sublíder de una CdP puntual, ligado
  a esa CdP.

Estos 4 conceptos deben convivir sin fusionarse -- ni en permisos, ni en
datos, ni en el nombre interno de tablas/enums (aunque el nombre visible
para el usuario final sea parecido o idéntico).

## Requisitos

### Requisito 1: Rol Evangelista (KAN-427)

Como miembro de la iglesia habilitado como Evangelista, quiero poder
entrar al sistema con permisos propios, para registrar y hacer
seguimiento de mis propias personas evangelizadas sin depender de un
cargo estructural (Líder de CdP, etc.).

#### Criterios de aceptación

1. Existe una forma de marcar a una persona como Evangelista, distinta y
   sin relación con el efesio "Evangelista" del censo.
2. Una persona puede ser Evangelista Y tener cualquier otro rol
   estructural al mismo tiempo (Líder de CdP, Sublíder, miembro sin
   cargo, etc.) -- no son excluyentes.
2.1. **Confirmado con el owner (2026-09-29)**: un miembro común siempre
   necesita pertenecer a una Casa de Paz para ser Evangelista -- su
   evangelismo se cuenta bajo esa CdP/Red. La única excepción es un
   Efesio de alto rango (ver Requisito 9), que puede no tener CdP propia.
3. Por defecto, un Evangelista solo ve/edita sus propios registros de
   evangelismo y seguimientos -- nunca los de otro Evangelista.
4. El acceso a Departamento de Evangelismo no le da automáticamente el
   rol Evangelista, ni viceversa.

### Requisito 2: Alta del rol a un miembro (KAN-434)

Como Líder de CdP, Sublíder de CdP, Líder/Supervisor de Red, operativo
(Pastor/Supervisor) o Departamento de Evangelismo, quiero poder habilitar
a un miembro como Evangelista, para que pueda empezar a registrar sus
propios evangelizados.

**Confirmado con el owner (2026-09-29): quién puede otorgar el rol NO es
un solo cargo -- son varios en simultáneo** (todos los de arriba).
Además, el owner adelantó que va a existir **un panel especial aparte,
dedicado a dar de alta personas para este rol** ("Evangelismo") -- ese
panel todavía no está especificado en detalle ("lo vamos a especificar
bien esto no ahora"), pero hay que saber que existe y que probablemente
termine siendo el punto de entrada principal para este alta, más que
cada rol haciéndolo desde su propio menú. No diseñar ese panel todavía,
solo dejar la puerta abierta en el modelo de permisos (`fn_puede_otorgar_
evangelista(iglesia_id)` o similar, no un único chequeo de rol).

#### Criterios de aceptación

1. No se duplica la Persona ni se crea una segunda membresía solo para
   habilitar el rol.
2. Si la persona ya tiene cuenta de usuario, el rol se agrega a esa
   cuenta existente.
3. Si la persona no tiene cuenta de usuario, queda documentado qué pasa
   (ver preguntas abiertas).
4. El rol se puede revocar.
5. Cualquiera de los roles confirmados arriba puede otorgarlo -- el
   chequeo de permiso no puede estar hardcodeado a uno solo.
6. **Excepción de CdP para Efesios** (ver Requisito 9): un Efesio de alto
   rango puede evangelizar a título personal SIN necesitar pertenecer él
   mismo a una Casa de Paz -- confirmar si este mismo flujo de alta
   aplica igual para un Efesio, o si un Efesio ya trae el permiso de
   evangelizar por su propio título, sin pasar por este alta.

### Requisito 3: Base visual UI v2 (KAN-428)

Como equipo de desarrollo, quiero una base de componentes/tokens
reutilizable para UI v2, para que el módulo Evangelista no quede como una
pantalla aislada y otros módulos puedan migrar después sin rehacer todo.

#### Criterios de aceptación

1. Existe una estructura explícita (carpeta/paquete de componentes,
   tokens de color/tipografía/espaciado) documentada para UI v2.
2. La UI v1 actual sigue funcionando sin cambios mientras UI v2 se
   introduce módulo por módulo.
3. Componentes funcionales ya existentes (selector de teléfono con
   bandera, validaciones, etc.) se reutilizan, no se reescriben.

### Requisito 4: Dashboard personal del Evangelista (KAN-429)

Como Evangelista, quiero ver un panel con mi racha de días, mis métricas
del mes y accesos directos a "Nuevo" e "Historial", para entender mi
actividad de un vistazo.

#### Criterios de aceptación

1. Encabezado con banner propio, mi nombre, contador de racha (días
   consecutivos con al menos un registro) y su ícono de fuego.
2. Racha calculada con la zona horaria/fecha que ya usa el resto de
   VisionHub (no UTC crudo).
3. Dos acciones principales: "Nuevo" (registrar persona) e "Historial".
4. Indicadores: Registrados, En seguimiento, Nuevos convertidos. **Nuevo
   convertido, confirmado con el owner (2026-09-29): es cuando el estado
   SSVA de la persona pasa a `NC` (Nuevo Convertido) -- ocurre cuando
   acepta a Cristo en la iglesia o en la Casa de Paz.** Antes de ese
   momento, el registro es solo "registro de evangelismo" (o alguna otra
   clasificación a definir más adelante, no es NC todavía). Falta
   confirmar el período de estos 3 indicadores (día/semana/mes/período
   elegido, ver preguntas abiertas).
5. Gráfico mensual "Personas evangelizadas" por día, con selector de mes,
   eje diario unitario (1,2,3...), scroll horizontal táctil si no entran
   todos los días.

### Requisito 5: Registro de nueva persona (KAN-430)

Como Evangelista, quiero un formulario simple para registrar a alguien
que acabo de evangelizar, con guardado automático de borrador, para no
perder los datos si me interrumpen a mitad de la carga.

#### Criterios de aceptación

1. Campos: primer/segundo nombre, primer/segundo apellido, teléfono
   (selector de país reutilizado), sexo, fecha de nacimiento, dirección
   -- mismo set y mismos componentes que `DatosBasicosPersonaFields`
   (creado en KAN-481, Altar de Afirmación).
2. Obligatorios (a confirmar): primer nombre, primer apellido, sexo.
3. Soporta edad aproximada cuando no se conoce la fecha de nacimiento
   exacta (reusar el patrón ya existente en VisionHub, no inventar uno
   nuevo).
4. **Tipo de evangelismo** (agregado por el owner, 2026-09-29, faltaba en
   el boceto): selector con las opciones del catálogo `tipo_evangelismo`
   ya existente -- `UNO_A_UNO` ("1+1"), `ELITE` ("Elite"), `SEMILLA`. No
   crear un catálogo nuevo.
5. El formulario guarda un borrador progresivo (al salir de un campo o
   cambio relevante), con indicador discreto de estado. El borrador NO
   cuenta como persona evangelizada ni afecta métricas/racha.
6. Solo "Guardar" valida obligatorios, finaliza el registro real y lo
   contabiliza.
7. Reintentos no crean duplicados.

### Requisito 6: Historial de personas evangelizadas (KAN-431)

Como Evangelista, quiero ver la lista de personas que registré, con su
estado de seguimiento, para saber a quién le falta contactar.

#### Criterios de aceptación

1. Por defecto muestra los últimos 30 días, paginado, con acceso claro a
   "registros anteriores a 30 días".
2. Buscador por persona (nombre/apellido/teléfono, según lo que ya
   soporte el buscador reutilizado).
3. Cada tarjeta: nombre completo, fecha/hora relativa (Hoy/Ayer/fecha),
   estado de seguimiento, cantidad de contactos, acción principal.
4. Sin contactos → estado "Sin contactar", acción "Contactar ahora".
   Con uno o más contactos → estado de seguimiento, acción "Ver
   seguimiento". El color de la tarjeta se deriva del estado real (¿la
   persona necesita acción o no?), no se copian literalmente los colores
   del mockup por estado.
5. Soporta N contactos por persona, no un máximo fijo de 2.

### Requisito 7: Flujo de contacto y seguimiento (KAN-432)

Como Evangelista, quiero registrar cada contacto que hago con una
persona evangelizada (WhatsApp, llamada, visita), para llevar un
historial de seguimiento real.

#### Criterios de aceptación

1. Una persona evangelizada puede tener N contactos.
2. Cada contacto registra: fecha/hora, medio (WhatsApp/llamada/visita),
   resumen/notas, quién lo hizo.
3. Historial cronológico visible por persona.
4. Abrir WhatsApp/llamada desde la app NO crea un seguimiento
   automáticamente -- el Evangelista debe confirmar/registrar el
   resultado.
5. No existe todavía mockup definitivo de esta pantalla -- el diseño se
   define en la fase de technical design, con UI v2.

### Requisito 8: Integración en roles existentes (KAN-433)

Como Sublíder/Líder de CdP, Líder/Supervisor de Red o Pastor que también
evangeliza personalmente, quiero que mi panel personal de Evangelismo
aparezca primero al entrar a "Evangelismo", sin perder el acceso al
módulo de Evangelismo de mi CdP/Red.

#### Criterios de aceptación

1. El nuevo panel personal es el acceso prioritario para los roles que
   apliquen.
2. El módulo actual de Evangelismo de CdP no se elimina, queda accesible
   como acción secundaria.
3. Los 3 conceptos (personal / CdP-Red / Departamento) mantienen rutas y
   permisos separados.
4. **Confirmado con el owner (2026-09-29)**: cualquier rol puede
   evangelizar a título personal, y se toma en cuenta la Casa de Paz de
   la que esa persona es miembro (un Líder de Red, Supervisor o Pastor
   normal siempre tiene una CdP de la que es miembro, incluso siendo
   líder arriba en la jerarquía). La única excepción real son los Efesios
   sin CdP propia -- ver Requisito 9.

### Requisito 9: Evangelismo personal de un Efesio sin Casa de Paz (nuevo, 2026-09-29)

Como Efesio de alto rango (designado por el Apóstol, ver Glosario) que
todavía no pertenece a ninguna Casa de Paz como miembro, quiero poder
evangelizar y hacer seguimiento igual que un Evangelista con CdP, para
que mi responsabilidad de evangelizar no dependa de tener membresía en
una CdP.

**Contexto real, explicado por el owner (2026-09-29)**: hay Efesios con
Casa de Paz y Red (como cualquier miembro), y hay Efesios que, por tener
un cargo de alto rango, no pertenecen a una CdP como tal. Estos últimos
sí evangelizan y hacen seguimiento de personas, pero esas personas
evangelizadas no tienen todavía una CdP asignada -- eso lo asignará más
adelante el Departamento de Afirmación (proceso que **todavía no
existe** en VisionHub, es trabajo futuro fuera de esta épica).

#### Criterios de aceptación

1. Un Efesio sin CdP puede registrar personas evangelizadas igual que
   cualquier Evangelista (mismo formulario, mismo flujo de seguimiento).
2. Las personas evangelizadas por un Efesio sin CdP quedan identificables
   como tales -- sin forzar una CdP/Red que todavía no tienen.
3. Las estadísticas de evangelismo, que hoy se agrupan por Red y luego
   por Casa de Paz, necesitan una **categoría nueva**: "Evangelizado por
   Efesios" (nombre exacto a definir), para este grupo de personas sin
   CdP asignada todavía.
4. Cuando exista el futuro proceso de asignación de CdP por Afirmación,
   estas personas deben poder pasar de esa categoría a su Red/CdP real
   sin perder el historial de que fueron evangelizadas por ese Efesio
   (fuera de alcance implementar ese proceso ahora, pero el modelo de
   datos de este requisito no debe bloquearlo después).
