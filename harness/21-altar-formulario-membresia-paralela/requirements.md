# Requisitos — Membresía desde 0 (paralela) + formulario rico de Altar

> **RE-SCOPEADO 2026-09-29.** Este harness antes se llamaba "ampliar el
> formulario de Altar". Tras aclarar el modelo con el owner, quedó
> separado en dos partes con dueños distintos:
> - **Formulario rico de Altar** (`form_altar.png`): lo construye **Matías**
>   como parte del registro de personas de Altar (Altar/RSIL son
>   "solo registrar personas", copy-page). Son los campos de las secciones
>   de abajo.
> - **Membresía desde 0 (paralela)** — el MODELO de membresía nueva,
>   distinta de la de "link": es trabajo de **Gonzalo (Chalo)**. Define que
>   existen DOS formularios de membresía separados y cómo se diferencian.
>
> No se implementa nada acá -- es solo spec. Reparto general en
> `basura_no_leer/planificacion.jpeg`. Formulario rico de referencia:
> https://docs.google.com/forms/d/e/1FAIpQLSdTC5p1A85j4Xn8pzLj4k-pUgZM_v52C6oQZhkXLCc-_12LWA/viewform

## Concepto central: DOS membresías separadas (link vs desde 0)

Decisión del owner (2026-09-29): existen **dos formularios de membresía
distintos**, que coexisten -- no uno que se amplía:

1. **Membresía por link** (ya existe, `RegistrarPersonaAfirmacion.tsx`, NO
   se toca): para miembros previos a la app / registro por link. Pregunta
   todo (ministerio, cargo, liderazgo, censo, etc.).
2. **Membresía desde 0** (nueva, trabajo de Chalo): para gente nueva que
   se capta/bautiza. Es un formulario **separado y más liviano** -- NO
   pregunta ministerio, cargo, liderazgo ni nada que marque a la persona
   como "ya de la iglesia" (se asume que todos son nuevos). Verbatim del
   owner: *"son dos formularios distintos... la de bautismo no pregunta
   ministerio/cargo/liderazgo"*.

- **THE SYSTEM SHALL** mantener las dos membresías como formularios
  separados -- IF NOT THE SYSTEM SHALL NOT fusionarlas ni reemplazar la de
  link con la desde-0.
- **THE SYSTEM SHALL** distinguir el **origen** de cada membresía (link vs
  desde-0) para poder diferenciarlas después (ver open-questions -- si es
  un campo de origen, tablas separadas, etc.).
- **THE SYSTEM SHALL NOT** incluir en la membresía desde-0 los campos que
  marcan a alguien como "ya de la iglesia": ministerio, rol/cargo, censo,
  discipulados avanzados.
- **THE SYSTEM SHALL** guardar los datos capturados (estado civil,
  ocupación, dirección, bautismo) **en la ficha real de la persona**
  (`persona_detalle` y afines), disponibles para toda la app.

## Requisito 0 — Bautismo enlaza a "llenar membresía" (nuevo, 2026-09-29)

Bautismo es un proceso de **solo registrar** (como Altar/RSIL: buscar/
agregar persona + marcar bautismo con fecha; trabajo de Matías/copy-page).
Pedido del owner: WHEN se registra el bautismo de una persona, THE SYSTEM
SHALL ofrecer un **botón que lleve a llenar la membresía** (desde-0) de esa
persona una vez bautizada -- Bautismo y Membresía son cosas distintas pero
van juntas (todo el que se bautiza hace su membresía). El botón es el
puente entre el registro de bautismo (Matías) y el formulario de membresía
desde-0 (Chalo).

## Inventario: qué pide la Membresía desde 0 vs qué se quita

Comparación contra el formulario de membresía por link real hoy
(`RegistrarPersonaAfirmacion.tsx` = `CamposMembresiaFields` +
`CamposMembresiaExtendidaFields`). Escrito a pedido del owner
(2026-09-29) "para estar seguros".

### Campos que SÍ pide la Membresía desde 0

Datos de una persona recién captada. La regla no es "sacar todo lo de la
iglesia", sino **preguntar liviano** (sí/no + texto) en vez de la estructura
pesada de la membresía por link (actualizado con el owner 2026-09-29).

Datos personales (coinciden con `form_altar.png`):

- **Nombres**: primer nombre *, segundo nombre, primer apellido *, segundo
  apellido -- 4 campos separados, formato Título en vivo (ver Requisito 2).
- **Sexo** * (M / F; ver open-questions #8 sobre "Sin especificar").
- **Fecha de nacimiento** (con el mecanismo edad-o-fecha de CdP, Requisito 3).
- **Estado civil** (Soltero/Casado/Viudo/Divorciado/Concubinato).
- **Dirección** (texto).
- **Ocupación**.
- **Celular** (prefijo país + número).
- **Horario de contacto** (campo nuevo, ver open-questions #9).
- **CI** y **Correo** (opcionales).
- **Grado de instrucción** (opcional).
- **Familia**: **cónyuge e hijos** (el owner confirmó que la familia SÍ
  entra en la desde-0).

Datos de proceso / evangelismo:

- **Tipo de decisión** → estado SSVA automático (Requisito 4).
- **¿Es bautizado?** (Católica / Evangélica + cuál iglesia / Centro de
  Vida) (Requisito 5).
- **¿Asiste a alguna Casa de Paz? (cuál líder)** (ver open-questions #10).
- **¿Cómo llegó a la iglesia?** (ver open-questions #11).
- **Categoría de evangelismo** (1+1 / CDP / Elite) (Requisito 6).

Preguntas LIVIANAS sobre vínculo con la iglesia (nuevo, 2026-09-29 -- versión
simple, NO la estructura pesada de la membresía por link):

- **¿Ya asistes a la iglesia?** (sí / no).
- **¿Has trabajado en algún ministerio?** (sí / no) → WHERE responde sí,
  THE SYSTEM SHALL pedir **cuál** (texto libre). NO es la asignación
  estructurada de ministerios de la membresía por link, solo un dato
  informativo.
- **Discipulado**: puede haber gente que **ya está en discipulado y recién
  se va a bautizar** -- THE SYSTEM SHALL capturarlo de forma liviana
  (ej. "¿Estás en discipulado?" sí/no, o un texto simple). Wording exacto
  en open-questions #17. NO es la lista estructurada de discipulados con
  tipos/fechas de la membresía por link.

### Campos que se QUITAN (están en la membresía por link, NO van en la desde 0)

Solo lo que es estructura interna pesada / censo / liderazgo formal:

- **Cargo / Rango / Posición en la iglesia / Efesio / Otros cargos**
  (`SeccionCargoRangoMembresia`) -- QUITADO (liderazgo/censo formal).
- **Seminario / Universidad Rey Jesús**
  (`SeccionSeminarioUniversidadMembresia`) -- QUITADO (formación interna).
- **Mentor** (parte de `SeccionMentorBautismoMembresia`) -- QUITADO. De esa
  sección se **conserva solo el bautismo**.
- **Ministerios estructurados** (`SeccionMinisteriosMembresia`, asignación
  por ID) -- QUITADO: se reemplaza por la pregunta liviana "¿Has trabajado
  en algún ministerio? cuál" de arriba.
- **Discipulados estructurados** (`SeccionDiscipuladosMembresia`, lista con
  tipos/fechas) -- QUITADO: se reemplaza por la pregunta liviana de
  discipulado de arriba.

## Requisito 1 — Persona existente: precargar y verificar

WHEN el usuario encuentra a la persona en el buscador (pestaña "Buscar")
THE SYSTEM SHALL abrir el formulario **precargado con todos los datos que
ya existen** en el sistema, mostrarlos para verificación, y solo tras la
confirmación del usuario registrar el Altar (decisión del owner: *"precargar
los datos que tenemos, mostrar todos los datos para verificar si está todo
bien, una vez confirmado se procede"*).

- WHERE un dato ya existe en la ficha, THE SYSTEM SHALL mostrarlo lleno y
  permitir corregirlo (no re-preguntar en blanco).
- WHERE un dato falta, THE SYSTEM SHALL permitir completarlo en el momento.

## Requisito 2 — Nombres: 4 campos + formato Título en vivo

THE SYSTEM SHALL mantener los 4 campos separados (primer/segundo nombre,
primer/segundo apellido), NO un solo campo "Nombres y apellidos".

- THE SYSTEM SHALL forzar el formato **Título** (primera letra mayúscula,
  resto minúscula: "Ximena", "Gonzalo") **mientras se escribe**, sin
  importar si el Bloq Mayús está activo, desactivado o si se aprieta Shift
  -- el dato siempre se muestra y se guarda en ese formato (decisión del
  owner, verbatim). Hoy `normalizarNombre` ya hace esa transformación pero
  se aplica solo `onBlur` -- hay que aplicarla **en vivo** (ver Hallazgo 2).

## Requisito 3 — Edad: fecha de nacimiento con el mecanismo de Casas de Paz

THE SYSTEM SHALL pedir **fecha de nacimiento** (no "edad" como número), y
reusar el mecanismo que ya usa Casas de Paz: si no se consigue la fecha, se
puede cargar una edad aproximada, pero el sistema **seguirá pidiendo la
fecha de nacimiento** las próximas veces que la persona pase por algún
punto del sistema, hasta tenerla (decisión del owner: caso especial, el
99.9% dará su fecha). No se necesita clasificar menor/mayor acá -- todos
son iguales para Altar.

## Requisito 4 — Tipo de decisión → estado SSVA (automático + manual)

El formulario pide "TIPO DE DECISIÓN" (Salvación / Reconciliación /
Visita). THE SYSTEM SHALL resolverlo así (decisión del owner):

- IF la persona NO existe en el sistema THEN el estado es **NC** (Nuevo
  Convertido) -- automático.
- IF la persona YA existe THEN el estado es **RE** (Reconciliado) --
  automático.
- "Visita / simpatizante" (SIM) es la **única** opción que se marca a mano.

O sea: Salvación y Reconciliación NO son un botón que el usuario elige,
son consecuencia automática de si la persona ya estaba o no. Solo
"Visita/simpatizante" es una elección manual. Ver open-questions #4 sobre
cómo presentar esto en la UI sin confundir.

## Requisito 5 — ¿Es bautizado? (dato de membresía pre-bautismo)

THE SYSTEM SHALL preguntar el estado de bautismo con las opciones del
formulario: **Iglesia Católica**, **Iglesia Evangélica** (y cuál iglesia),
y si fue en **Centro de Vida** (cualquiera de nuestras iglesias Centro de
Vida en el mundo). Guardar en los campos de bautismo de la ficha (ver
Hallazgo 5 -- falta un campo para "denominación/cuál iglesia").

## Requisito 6 — Categoría de evangelismo (1+1 / CDP / Elite)

THE SYSTEM SHALL ofrecer la categoría de evangelismo del formulario: 1+1,
CDP, Elite. El valor **CDP es nuevo** y significa "persona que nunca vino a
la iglesia pero sí a las Casas de Paz" (hay mucha gente así, dice el
owner). Ver open-questions #6 -- hay que confirmar la lista final contra el
catálogo `tipo_evangelismo` existente (hoy: 1+1/Elite/Semilla) y coordinar
con Daniel el tema "Semilla".

## Requisito 7 — Categoría del servicio: por ahora solo fecha

El formulario de papel tiene "CATEGORÍA DEL SERVICIO" con 12 opciones
(Domingo Mañana/Noche, Casa de Oración, Jóvenes, Discipulados, Mega Casa de
Paz, Matrimonios, Fiesta de Bienvenida, etc.). Decisión del owner: es un
**sub-tipo dentro de Altar**, pero **por ahora se implementa solo la
fecha** (como hoy). THE SYSTEM SHALL dejar documentado/preparado que a
futuro habrá un catálogo de tipos de servicio (tradicionales fijos + otros
eventuales) -- ver Hallazgo 6 y open-questions #7. El programador decide si
ya lo modela como catálogo o lo deja como solo-fecha en esta iteración.

## Requisito 8 — El mismo formulario sirve para ver y editar (bloqueado → "Editar" desbloquea)

Pedido del owner (2026-09-29): *"el formulario de edición de personas en
Altar está feo, no debería verse así. Debe hacerse clic y ver directamente
el form pero con campos bloqueados, y al hacer clic en el botón Editar los
campos se activan para poder modificar."*

- WHEN el usuario hace clic en una persona (en la pestaña "Datos" o al
  seleccionarla en "Buscar"), THE SYSTEM SHALL mostrar **este mismo
  formulario ampliado** precargado con los datos de la persona, con **todos
  los campos bloqueados** (solo lectura, prolijo, no la ficha paginada
  actual de 9 páginas).
- WHEN el usuario presiona "Editar", THE SYSTEM SHALL desbloquear los
  campos en el lugar para permitir modificarlos y guardar.
- THE SYSTEM SHALL NOT usar el flujo actual (abrir `FichaPersonaSheet`
  paginado + modal de advertencia "vas a editar datos reales") en el
  contexto de Altar -- ese flujo se reemplaza por el patrón bloqueado →
  Editar descrito acá. (Ver open-questions #12: si esto reemplaza la ficha
  global o es solo para el contexto Afirmación.)
- **Patrón compartido**: RSIL, Fiesta de Bienvenida y Bautismo/Membresía
  (`harness/20-afirmacion-procesos-y-colaborar/`) SHALL seguir este mismo
  patrón de ver/editar. La spec de esos otros procesos no se escribe acá,
  pero el patrón se define acá y ellos lo reusan.

## Requisito 9 — Pestaña "Datos" más prolija, con hover

Pedido del owner (2026-09-29): *"en Datos debe verse más bonito, no tiene
hover y es necesario."*

- THE SYSTEM SHALL mejorar la presentación visual de la pestaña "Datos"
  (tabla/tarjetas de registros) siguiendo el sistema de diseño del
  proyecto (skill `frontend-style`).
- THE SYSTEM SHALL dar **feedback de hover** en las filas/tarjetas
  clicables (hoy falta), dejando claro que se puede hacer clic para
  ver/editar la persona.

## Requisito 10 — Quitar el botón "Ocultar de búsquedas" del detalle de persona

Pedido del owner (2026-09-29): el botón **"Ocultar de búsquedas"** que hoy
aparece en el detalle de persona es peligroso y no debe estar ahí a mano.

- THE SYSTEM SHALL quitar el botón "Ocultar de búsquedas" del detalle/
  edición de persona (hoy vive en el componente de ficha compartido --
  `FichaPersonaSheet`, ver technical-design.md).
- THE SYSTEM SHALL mover esa capacidad a un **panel de configuración** de
  los roles **Supervisor de la Visión en Acción** y **Pastor**, como un
  único toggle.
- WHERE ese toggle está activo (que SHALL ser el valor **por defecto**),
  THE SYSTEM SHALL ocultar del **front** a los cargos de Efesios (para lo
  que fue creado originalmente) pero **nunca del sistema/base de datos** --
  el dato sigue existiendo y accesible internamente, solo no se muestra en
  las búsquedas del front.
- Esta capacidad NO SHALL quedar como una acción por-persona suelta en el
  detalle -- es una decisión de nivel de supervisión/pastoral, no una
  acción de captura de datos.

> **Nota de seguridad**: este cambio tiene ticket de Jira propio
> (**KAN-489**) para no perderlo -- es lo único de este harness con
> implicancia de seguridad, el resto es UI/UX. El resto del harness está en
> **KAN-488**.

## Campos restantes del formulario (mapeo)

Ver la tabla completa campo-por-campo en `technical-design.md` (Hallazgo
7), incluidos los que todavía no tienen destino claro en la base
(HORARIO DE CONTACTO, ASISTE A CASA DE PAZ / cuál líder, CÓMO LLEGÓ A LA
IGLESIA) -- esos están en open-questions porque requieren decisión.

## Fuera de alcance

- No se modifica el formulario de membresía actual
  (`RegistrarPersonaAfirmacion.tsx`) -- este convive con él.
- No se implementa el catálogo de tipos de servicio (Requisito 7) salvo
  que el programador lo decida -- por defecto queda solo la fecha.
- RSIL / Fiesta de Bienvenida / Bautismo-Membresía son otro paquete
  (`harness/20-afirmacion-procesos-y-colaborar/`).
