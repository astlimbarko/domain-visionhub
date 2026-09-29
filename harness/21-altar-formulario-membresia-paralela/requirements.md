# Requisitos — Ampliar el formulario de Altar a "membresía paralela"

**Harness de MODIFICACIÓN.** No se implementa nada acá -- este paquete
describe cómo hay que ampliar el formulario de alta de persona de Altar
(hoy `DatosBasicosPersonaFields` + pestaña "Nuevo" de `AfirmacionAltar.tsx`,
KAN-481, ya en producción). **Quien lo implementa es Matías.** Escrito
2026-09-29 a partir del formulario en papel/Google que Afirmación usa hoy
(`basura_no_leer/form_altar.png`) y de una ronda de decisiones con el
owner (ver más abajo cada respuesta citada).

> **Para Matías:** este es el harness para modificar el formulario de
> Altar. Antes de tocar código, leé este `requirements.md`, el
> `technical-design.md` (rutas de archivo reales + mecanismos a reusar) y
> el `open-questions.md` (decisiones que el owner delegó explícitamente en
> vos, "que el programador decida/pregunte"). Formulario de referencia
> vivo: https://docs.google.com/forms/d/e/1FAIpQLSdTC5p1A85j4Xn8pzLj4k-pUgZM_v52C6oQZhkXLCc-_12LWA/viewform

## Concepto central: es una "membresía paralela / v2", no un simple form de alta

Decisión del owner (2026-09-29, verbatim): *"ya tenemos formulario de
membresía pero eso existe solo para los que están ya en la iglesia antes
del sistema... ahora estamos ideando una segunda versión que debe
coexistir con la anterior, pero esta es solo para los nuevos de altar y
acá no preguntamos ya muchas cosas que tiene nuestra membresía actual como
ministerio o rol en la iglesia, o cosas que hagan notar como si la persona
ya sea de la iglesia. Por lo tanto es un formulario de membresía pero
paralelo."*

- **THE SYSTEM SHALL** tratar este formulario ampliado como una segunda
  versión de membresía (liviana, para gente nueva captada en Altar) que
  **coexiste** con el formulario de membresía actual
  (`RegistrarPersonaAfirmacion.tsx`) -- no lo reemplaza.
- **THE SYSTEM SHALL NOT** incluir en este formulario los campos que
  marcan a alguien como "ya de la iglesia": ministerio, rol/cargo, censo,
  discipulados avanzados, etc. Solo los datos de una persona recién
  captada.
- **THE SYSTEM SHALL** guardar los datos de membresía capturados
  (estado civil, ocupación, dirección, bautismo) **en la ficha real de la
  persona** (`persona_detalle` y afines), no atados solo al registro
  puntual de Altar -- así quedan disponibles para toda la app (decisión
  del owner).

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
