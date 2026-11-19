# Instrucciones del proyecto — VisionHub

Este archivo lo lee automáticamente **cualquier** sesión de Codex que
trabaje en este repositorio, sin importar quién la abra ni desde qué
máquina. Existe para que el comportamiento del editor sea el mismo para
las 3 personas que trabajan acá, y para que nadie (ni Codex) "se salga" o
invente convenciones nuevas sin que quede documentado.

## Equipo

Este proyecto lo trabajan 3 programadores:

- **Gonzalo** — owner del proyecto.
- **Matías**
- **Daniel**

**Regla obligatoria: si no es obvio quién está usando Codex en la
sesión actual, hay que preguntar el nombre antes de escribir cualquier
entrada de bitácora.** No asumir, no adivinar, no inventar. "Obvio" quiere
decir que la persona ya se identificó en la conversación (por nombre, o
porque el contexto lo deja claro sin ambigüedad) — si hay la más mínima
duda, preguntar.

---

## Bitácora diaria del equipo (`bitacora-equipo/`)

### Qué es y para qué sirve

Un registro versionado en git (se sube al repo, lo ven los 3) de qué hizo
cada persona, día por día, trabajando **con Codex**. Es distinto de
la memoria personal de Codex (que vive en la máquina de cada uno y no se
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
  alguien trabajó con Codex en este proyecto.
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
  sirve).
- Marcar `[x]` lo que se completó, `[ ]` lo que quedó pendiente o a medias
  — así la próxima persona (o la próxima sesión de la misma persona) ve de
  un vistazo qué falta sin tener que leer todo el chat.
- Si en el mismo día la persona abre varias sesiones, se sigue agregando al
  mismo archivo del día (no crear `gonzalo-2.md`).

### Regla de cierre de sesión (la más importante)

**Antes de terminar cualquier sesión de Codex en este proyecto, el
archivo de bitácora de quien esté trabajando tiene que quedar actualizado
con lo que realmente se hizo.** El objetivo es que si esa persona (o
cualquiera del equipo) retoma con `Codex --continue`, el archivo del día
ya refleja el estado real — nunca debe quedar desactualizado esperando que
alguien se acuerde de escribirlo después.

### Comportamiento actual (actualizado 2026-08-01)

**Matías ya está trabajando activamente en el proyecto con Codex**
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

## Otras convenciones del proyecto

Ver también `harness/README.md` (specs técnicas del sistema) y
`harness/DEPLOY.md` / `harness/EMAILS-AUTH.md` (despliegue y correos).
Nunca commitear directo en `master` — trabajar en ramas de feature.

## Front 2 — instrucciones de continuidad (2026-11-15)

Antes de modificar el frontend en `codex/front-2`, leer `harness/FRONT-2.md`, especialmente «Acuerdo de migración para el equipo y Codex». Es la guía compartida aprobada por Gonzalo.

- Migrar las funciones existentes con nueva apariencia AdminLTE + MUI, conservando lógica, datos, permisos y validaciones reales.
- Prioridad: móvil, luego tablet y finalmente PC. Matías termina Líder de Casa de Paz; después se avanza por Líder de Red y los demás roles, por etapas.
- Móvil/tablet: CSS propio y aislado; no introducir variables CSS globales ni cambiar estilos globales para forzar el diseño. El Inicio móvil actual usa Shadow DOM; tablet aún conserva la vista anterior.
- No modificar backend, base de datos ni configuración de Supabase. Pruebas automatizadas con red interceptada.
- Solo trabajo local y push a esta rama. No desplegar ni fusionar a master. La futura ruta /v2/ debe coexistir con V1.
## Registro obligatorio en Jira — regla permanente del equipo

Instrucción de Gonzalo del 2026-11-19: todo trabajo de VisionHub con Codex debe quedar registrado en Jira, además de la bitácora diaria de este archivo. Aplica a Gonzalo, Matías y Daniel y a las futuras sesiones que lean estas instrucciones.

- Sitio: https://visionhubsc.atlassian.net. Proyecto: VisionHubSC — Tareas. Clave: KAN. Cloud ID: a30f078b-f6cd-45ac-aa46-35fb9d9dadfb.
- Antes de comenzar una tarea, buscar el ticket existente y reutilizarlo para evitar duplicados; crear uno si no existe. Investigación, documentación, decisiones, cambios de código, pruebas y bloqueos también se registran cuando forman parte del trabajo.
- Actualizar el ticket a medida que se avanza y antes de terminar la sesión: resultado real, validaciones ejecutadas, limitaciones, pendientes y enlaces a ramas/commits/PR. Mantener el estado fiel al avance; no cerrar algo parcial ni confundir push con deploy.
- Registrar solo trabajo comprobado. En cargas retrospectivas indicar fecha de registro y período/evidencia conocidos; no inventar fechas, horas, pruebas, responsables ni avances de otras personas. No cargar worklogs de tiempo sin datos reales.
- Respetar asignaciones expresas de Gonzalo. No modificar tickets ajenos o ampliar el alcance sin motivo; enlazar lo relacionado. No incluir contraseñas, tokens ni secretos.
- Jira complementa la bitácora versionada, no la reemplaza. Identificar a la persona antes de escribir su bitácora, como se exige arriba.
- Si Jira no está disponible, conservar el registro en la bitácora con la sincronización pendiente e informar al usuario; al recuperar acceso, sincronizar sin duplicar. No afirmar que se registró algo si falló la escritura.
- Front 2 se sigue en la épica KAN-511: KAN-512 (base entregada), KAN-513 (Matías, terminar Líder de Casa de Paz), KAN-514 (roles siguientes) y KAN-515 (esta regla/documentación). Antes de crear otros tickets, revisar los existentes y su estado actual.

Esta regla no autoriza despliegues, cambios en Supabase ni merges a master. Mantener las restricciones y autorizaciones vigentes de cada tarea.
