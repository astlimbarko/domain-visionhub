# Instrucciones del proyecto — VisionHub

Este archivo lo lee automáticamente **cualquier** sesión de Claude Code que
trabaje en este repositorio, sin importar quién la abra ni desde qué
máquina. Existe para que el comportamiento del editor sea el mismo para
las 3 personas que trabajan acá, y para que nadie (ni Claude) "se salga" o
invente convenciones nuevas sin que quede documentado.

## Idioma

El idioma oficial de este proyecto es **español**. Toda respuesta de Claude
Code en este repositorio (texto de conversación, mensajes de commit,
tickets de Jira, comentarios de código cuando corresponda) va en español,
sin importar el idioma en que esté escrito el mensaje del usuario.

## Equipo

Este proyecto lo trabajan 3 programadores:

- **Gonzalo** — owner del proyecto.
- **Matías**
- **Daniel**

**Regla obligatoria: si no es obvio quién está usando Claude Code en la
sesión actual, hay que preguntar el nombre antes de escribir cualquier
entrada de bitácora.** No asumir, no adivinar, no inventar. "Obvio" quiere
decir que la persona ya se identificó en la conversación (por nombre, o
porque el contexto lo deja claro sin ambigüedad) — si hay la más mínima
duda, preguntar.

---

## Bitácora diaria del equipo (`bitacora-equipo/`)

### Qué es y para qué sirve

Un registro versionado en git (se sube al repo, lo ven los 3) de qué hizo
cada persona, día por día, trabajando **con Claude Code**. Es distinto de
la memoria personal de Claude (que vive en la máquina de cada uno y no se
comparte) — esto es el registro que el equipo necesita para no pisarse
entre sí y saber qué se tocó.

### Estructura de carpetas

```
bitacora-equipo/
  2026-07-30/
    gonzalo.md
    matias.md
  2026-08-03/
    gonzalo.md
```

- La carpeta madre es siempre `bitacora-equipo/` (no renombrar).
- Adentro, **una carpeta por día trabajado**, con fecha en formato
  `YYYY-MM-DD`. **No todos los días hay carpeta** — solo se crea si ese día
  alguien trabajó con Claude Code en este proyecto.
- Adentro de cada carpeta de día, **un archivo por persona que trabajó ese
  día**, nombrado en minúscula con su nombre de pila: `gonzalo.md`,
  `matias.md`, `daniel.md`. No crear el archivo de alguien que no trabajó
  ese día — no rellenar carpetas "por las dudas".

### Cómo se escribe cada archivo

Formato de checklist, actualizado **a medida que se avanza en la sesión**,
no todo junto al final como un resumen escrito de memoria:

```markdown
# Gonzalo — 2026-07-30

- [x] Configuré SMTP con dominio propio (acceso@somoscdv.com)
- [x] Apliqué las 5 plantillas de correo de Supabase en español
- [x] Cerré el registro público (disable_signup)
- [ ] Falta: revisar por qué 2 cuentas de prueba dejaron de loguear
```

- Cada ítem: una tarea real y concreta, no genérica ("mejoras varias" no
  sirve). **Breve** (2026-08-05): una frase corta por ítem, sin repetir el
  motivo completo ni el detalle de verificación — eso vive en el commit o en
  `harness/` si hace falta más contexto.
- Marcar `[x]` lo que se completó, `[ ]` lo que quedó pendiente o a medias
  — así la próxima persona (o la próxima sesión de la misma persona) ve de
  un vistazo qué falta sin tener que leer todo el chat.
- Si en el mismo día la persona abre varias sesiones, se sigue agregando al
  mismo archivo del día (no crear `gonzalo-2.md`).

### Regla de cierre de sesión (la más importante)

**Antes de terminar cualquier sesión de Claude Code en este proyecto, el
archivo de bitácora de quien esté trabajando tiene que quedar actualizado
con lo que realmente se hizo.** El objetivo es que si esa persona (o
cualquiera del equipo) retoma con `claude --continue`, el archivo del día
ya refleja el estado real — nunca debe quedar desactualizado esperando que
alguien se acuerde de escribirlo después.

### Comportamiento actual (actualizado 2026-08-01)

**Matías ya está trabajando activamente en el proyecto con Claude Code**
(confirmado por el owner) — la regla de arriba ya le aplica a él también
desde ahora, no es algo a futuro. Si en una sesión no es obvio que quien
escribe es Matías, preguntarle el nombre antes de escribir en la bitácora,
igual que con cualquiera. **Daniel se incorpora al equipo recién alrededor
del 2026-08-08** (una semana después de esta nota) — hasta esa fecha no
va a haber entradas suyas, es esperado; la regla le empieza a aplicar
desde su primer día real trabajando en el proyecto, no antes. No crear
archivos vacíos `matias.md`/`daniel.md` de antemano — se crean el primer
día real que esa persona trabaje.

---

## Seguimiento en Jira (obligatorio)

Este equipo trabaja con Jira (proyecto `KAN`, sitio `visionhubsc.atlassian.net`).
**Todo cambio de código o de base de datos que se haga en una sesión de
Claude Code tiene que quedar registrado en un ticket de Jira** — no alcanza
con que quede solo en el commit o en la bitácora local.

- Antes de dar un cambio por terminado, buscar si ya existe un ticket que lo
  cubra. Si existe, actualizarlo con lo que se hizo (no crear uno duplicado).
- **Si no existe ticket, crearlo** — no dejar trabajo sin registrar asumiendo
  que "es chico" o que "se anota después".
- **Todo ticket que se cree o cuyo estado se mueva/cambie debe quedar con
  Gonzalo (`astlimbark`, `accountId: 712020:380af14d-4028-4be6-ade6-2e837916b2b1`)
  como reporter y como assignee** — sin importar qué persona del equipo esté
  en la sesión de Claude Code en ese momento. Es una decisión del owner
  (2026-08-03): él es quien centraliza el seguimiento en Jira.
- **Título y descripción siempre breves, directo al grano.** Título: una
  línea que diga qué es. Descripción: 2-4 líneas con qué se hizo/qué pasa y
  por qué — nada de bloques largos, sin fragmentos de código pegados, sin
  listas de "posibles soluciones" extensas. Si hace falta explayarse, esa
  explicación va en el commit o en la conversación, no en el ticket.
- **Excepción al assignee (2026-08-05):** si el ticket documenta algo para
  que otra persona del equipo lo implemente más adelante (no trabajo que se
  hizo en esta sesión), el reporter sigue siendo Gonzalo pero el **assignee
  queda vacío**, no Gonzalo — la regla de arriba aplica solo cuando el
  trabajo/cambio de estado lo decidió/ejecutó él en la sesión actual.
- **Claude tiene el control de mover el estado del ticket a lo largo de todo
  su ciclo** (`Tareas por hacer` → `En curso` → `En revisión` → `Finalizada`),
  no solo comentarlo y dejarlo en "Tareas por hacer" (pedido explícito
  2026-08-05, "tú tienes el control de esto"). Mover a `En curso` al empezar
  a trabajar un ticket, a `En revisión` si el código quedó listo pero falta
  probarlo en vivo, y a `Finalizada` recién cuando quedó verificado en vivo
  (no solo escrito). No dejar tickets con trabajo real completado varados en
  "Tareas por hacer" solo porque se comentaron.
- **Antes de pasar a otro ticket, siempre dejar un comentario en el ticket
  actual con lo que se hizo** (pedido explícito 2026-08-10) — aunque no se
  cierre todavía. No esperar a terminarlo del todo para actualizar Jira; si
  una sesión avanza parcialmente un ticket y sigue a otra cosa, ese avance
  parcial queda comentado ahí mismo antes de moverse.
- **Todo movimiento de estado lleva su propio comentario** (pedido explícito
  2026-08-13), no solo el de "antes de pasar a otro ticket": cada vez que el
  estado avanza (`En curso` → `En revisión` → `Finalizada`), ese cambio
  puntual queda comentado en el momento, aunque la sesión siga trabajando el
  mismo ticket después.
- **El estado nunca avanza sin trabajo real que lo respalde** (pedido
  explícito 2026-08-13). Si en algún momento no se puede seguir avanzando
  (bloqueo, falta de info, etc.), se deja un comentario explicando por qué
  y el ticket se queda en el estado en el que está — nunca se mueve "para
  adelante" sin que ese paso esté de verdad hecho. No existe la combinación
  "comentar y aun así cambiar de estado" si lo comentado es que no se pudo
  avanzar.
- **Autoría real de quien trabajó, aparte del reporter/assignee
  centralizado** (pedido explícito 2026-08-13): como el reporter y el
  assignee siempre quedan en Gonzalo (regla de arriba), si quien de verdad
  trabajó en la sesión fue otra persona del equipo (Matías o Daniel), el
  comentario del ticket debe decirlo explícitamente — así queda registrado
  quién hizo el trabajo real aunque Jira solo muestre a Gonzalo como
  asignado.

## Memoria entre sesiones (obligatorio)

**Antes de dar por terminada cualquier tarea (no solo al cerrar la sesión
entera), actualizar la memoria persistente de Claude** con qué se hizo y
qué queda pendiente inmediato para retomar. Pedido explícito 2026-08-10,
tras varios cortes de sesión (la computadora se apagó a medias más de una
vez) que dejaban avance real sin registrar en ningún lado — ni en git
(commits pendientes sin hacer) ni en memoria, obligando a reconstruir el
estado desde cero. No esperar a que la sesión completa termine para
guardar memoria: cada tarea cerrada es un punto natural para hacerlo, así
un corte a mitad de la siguiente tarea no pierde lo ya avanzado.

## Otras convenciones del proyecto

Ver también `harness/README.md` (specs técnicas del sistema) y
`harness/DEPLOY.md` / `harness/EMAILS-AUTH.md` (despliegue y correos).
Nunca commitear directo en `master` — trabajar en ramas de feature.
