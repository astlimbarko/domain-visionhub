# 14 — Departamento de Afirmación — requirements.md

> **Fase 1 (análisis + especificación).** Este documento describe QUÉ se va a
> construir. No implica que nada esté implementado. Ver `database-impact.md` para
> el inventario exacto de lo que hoy existe vs. lo que se propone.

## 1. Objetivo

Habilitar el **Departamento de Afirmación** dentro de VisionHub: el dominio de
Departamentos (Evangelismo, Afirmación, Discipulado, Envío) es distinto del
dominio operativo de Casas de Paz, pero comparte `iglesia`, `persona`, `usuario`,
`red`, `casa_de_paz`, cargos y membresías.

En esta primera entrega solo se construye **Afirmación**. Su usuario operativo es
el **Líder de Afirmación**, que registra personas como miembros de la iglesia
(típicamente al bautizarse) y las asocia a la Casa de Paz que les corresponde,
mediante dos vías: registro interno manual y registro público por URL.

## 2. Alcance incluido

1. **Modelo de asignación departamental** que permita designar a una persona como
   Líder de Afirmación de una iglesia (persona + departamento `AFIRMACION` + cargo
   `LIDER_DEPARTAMENTO` + iglesia), con historial, vigencia, auditoría y soft delete.
2. **Registro interno manual** (§4.1): el Líder de Afirmación, autenticado, da de
   alta una persona reutilizando el formulario de membresía existente, eligiendo al
   **Líder de Casa de Paz** de esa persona; el sistema resuelve la CdP activa de ese
   líder y crea la membresía.
3. **Registro público por URL** (§4.2): reutiliza el flujo público ya existente
   (`casa_paz_url` + `fn_registrar_persona_via_url`); la novedad es que el Líder de
   Afirmación pueda **administrar** qué URLs están activas.
4. **Panel de administración de URLs** (§5): listar/filtrar URLs de líderes de CdP
   activos de la iglesia, ver la jerarquía Líder de Red → Red → CdP → Líder de CdP →
   URL, copiar, activar/desactivar individual y masivamente.
5. **Acceso y navegación** del Líder de Afirmación en el frontend, como capacidad
   ortogonal al RolUI actual (respeta multi-sombrero).

## 3. Fuera de alcance

- Los departamentos Evangelismo, Discipulado y Envío. Solo Afirmación.
- El **panel del Supervisor para designar** al Líder de Afirmación. En esta etapa la
  designación se hace **directamente en la base de datos** (una fila en la tabla
  propuesta `departamento_cargo`). El modelo debe quedar listo para que el Supervisor
  lo haga desde su panel en el futuro, pero ese panel no se construye ahora.
- Cambiar al Pastor o al Super Admin en operadores de este módulo (prohibido).
- Rediseñar el formulario de membresía; se reutiliza/compone el existente.
- Métricas/dashboards de Afirmación.

## 4. Actores

| Actor | En Afirmación |
|---|---|
| **Líder de Afirmación** | Único operador. Registra personas (interno y público) y administra URLs de su iglesia. Se designa por `departamento_cargo` (cargo `LIDER_DEPARTAMENTO`, depto `AFIRMACION`). |
| **Supervisor de la Visión en Acción** | Designa al Líder de Afirmación (a futuro, desde panel; hoy por DB). Sigue siendo operativo (`fn_es_operativo_en`). Conserva su capacidad ya existente de administrar URLs. |
| **Pastor** | NO participa. No es operativo (`43_pastor_no_operativo.sql`). Solo consulta. |
| **Super Admin** | NO opera este módulo (rol técnico). |
| **Persona pública (anónima)** | Abre una URL activa y se registra sin iniciar sesión. Ya soportado. |

## 5. Reglas de negocio

1. **RB-1** Aislamiento por iglesia: el Líder de Afirmación solo ve/actúa sobre su(s)
   iglesia(s) (`fn_mis_iglesias()`), nunca datos de otra iglesia.
2. **RB-2** El acceso a Afirmación se deriva de una **asignación departamental vigente**
   (fila en `departamento_cargo` con cargo `LIDER_DEPARTAMENTO`, departamento
   `AFIRMACION`, `fecha_fin IS NULL`, `fecha_eliminacion IS NULL`), **no** de un rol
   rígido en `rol_sistema_enum`.
3. **RB-3** Una persona puede tener varios cargos/sombreros a la vez (p. ej. Líder de
   CdP y además Líder de Afirmación). El acceso a Afirmación es ortogonal al RolUI.
4. **RB-4** El panel de URLs administra **solo** URLs de **líderes activos de Casa de
   Paz**. Nunca URLs de líderes de Red, sublíderes ni miembros comunes.
5. **RB-5** La relación persona↔CdP en el registro interno se resuelve por
   **identificadores estables** (id del `casa_de_paz_cargo` del líder), nunca por el
   nombre mostrado al operador.
6. **RB-6** Toda escritura mantiene auditoría (`creado_por`/`actualizado_por`) y soft
   delete; nada se borra físicamente (triggers `fn_bloquear_delete`).
7. **RB-7** Mínimo privilegio: el Líder de Afirmación obtiene exactamente los permisos
   de este módulo (registrar personas de su iglesia + administrar URLs de su iglesia),
   ni más ni menos.
8. **RB-8** El registro público nunca confía en `iglesia_id`/`persona_id`/`casa_de_paz_id`
   enviados por el navegador: el contexto se resuelve server-side desde el slug.

## 6. Flujos

### 6.1 Registro interno manual (§4.1)

1. El Líder de Afirmación inicia sesión y abre la página de Afirmación → "Registrar
   persona".
2. Completa los mismos campos que ya pide el formulario de membresía existente
   (`FormularioMembresiaPublico`: identidad, sexo, fecha nac., CI, correo, estado civil,
   ocupación, grado de instrucción; obligatoriedad según configuración de la iglesia).
3. **Selecciona al Líder de Casa de Paz** de la persona, buscándolo por nombre
   (patrón `BuscadorPersona`). Internamente se guarda el `casa_de_paz_cargo_id` de ese
   liderazgo vigente.
4. El sistema resuelve la **CdP activa** de ese líder a partir del cargo elegido.
5. Al confirmar, en una sola transacción se crea `persona` (+ `persona_detalle` si hay
   datos censales) + `persona_llegada` (motivo `INVITACION_PERSONAL`) + `casa_de_paz_membresia`
   (principal) en esa CdP.
6. Se muestra confirmación con nombre completo y CdP.

### 6.2 Registro público por URL (§4.2 — ya existente, se reutiliza)

1. El Líder de Afirmación **activa** la URL de un Líder de CdP desde el panel.
2. El líder comparte el enlace `/registro/:slug`.
3. Una persona lo abre sin autenticarse; `fn_resolver_url_registro(slug)` decide si
   admite registro y devuelve nombre del líder y de la CdP (contexto fijo, no editable).
4. Completa el formulario y confirma; `fn_registrar_persona_via_url(slug, datos)` crea
   atómicamente persona + llegada + membresía en la CdP de esa URL.

## 7. Administración de URLs (§5)

Acciones sobre las URLs de líderes de CdP **activos** de la iglesia actual:

- Listar con jerarquía **Líder de Red → Red → Casa de Paz → Líder de CdP → URL** + estado.
- Buscar/filtrar (por líder, red, CdP, estado).
- Copiar la URL al portapapeles.
- Activar / desactivar **una** URL.
- Selección múltiple → activar / desactivar el conjunto seleccionado.
- **Activar todas** las URLs de líderes de CdP activos con un clic; desactivar en grupo.
- Comportamiento de acciones masivas: confirmación previa, **idempotencia** (activar una
  URL ya activa no falla ni la duplica), **resultados parciales** (informar cuántas se
  cambiaron y cuáles no, sin abortar todo por un error puntual), y manejo de concurrencia
  (dos operadores tocando la misma lista).

## 8. Casos límite

- **CL-1** Líder de CdP sin URL (la CdP no tenía líder al momento de crearse la URL, o la
  URL fue soft-deleted): no aparece para administrar; se indica el motivo.
- **CL-2** CdP sin líder vigente: en registro interno, si el operador intenta un líder cuyo
  cargo terminó, se rechaza con mensaje claro (no se crea membresía huérfana).
- **CL-3** Líder con **más de una** CdP activa: definir cómo se resuelve la CdP (ver
  open-questions Q-1). Por defecto se exige elegir el `casa_de_paz_cargo` concreto, que ya
  identifica una sola CdP.
- **CL-4** Datos inconsistentes (cargo vigente pero CdP inactiva): se rechaza el alta.
- **CL-5** Persona duplicada: CI único ya lo bloquea a nivel DB (`uq_persona_ci`); además el
  registro interno debería avisar por nombre/CI antes de crear (ver open-questions Q-2).
- **CL-6** URL en estado `SUSPENDIDO`: el panel de Afirmación no la reactiva salvo decisión
  explícita (ver open-questions Q-3).
- **CL-7** Rate limit del registro público (20 registros / 10 min por URL) ya existe; se
  mantiene.
- **CL-8** Acción masiva con una fila que ya no cumple condición (líder desactivado entre el
  render y el submit): se omite esa fila y se reporta, sin abortar el resto.

## 9. Criterios de aceptación (verificables)

- **CA-1** Insertando manualmente una fila en `departamento_cargo` (cargo
  `LIDER_DEPARTAMENTO`, depto `AFIRMACION`) para una persona con cuenta, esa persona ve el
  ítem "Afirmación" en el nav y puede entrar; sin esa fila, no lo ve ni puede entrar por URL directa.
- **CA-2** El Líder de Afirmación registra una persona eligiendo un Líder de CdP y la persona
  queda como `casa_de_paz_membresia` principal de la CdP correcta, con `persona_llegada`
  motivo `INVITACION_PERSONAL` y auditoría con su `usuario_id`.
- **CA-3** Un usuario **sin** la asignación de Afirmación recibe error al llamar el RPC de
  registro interno o al intentar actualizar una `casa_paz_url` (RLS/So­lo lectura).
- **CA-4** El Líder de Afirmación puede activar/desactivar una URL de un líder de CdP de su
  iglesia; NO puede tocar URLs de otra iglesia (aislamiento).
- **CA-5** "Activar todas" deja todas las URLs de líderes de CdP activos en `ACTIVO`; correrlo
  dos veces seguidas no cambia nada la segunda vez (idempotencia) y no produce error.
- **CA-6** El registro público sigue funcionando idéntico (sin regresión): enlace activo →
  formulario → alta; enlace inexistente/inactivo → "no disponible".
- **CA-7** Pastor y Super Admin no ven el módulo Afirmación como operadores.
- **CA-8** Todas las tablas nuevas tienen RLS activo, auditoría y bloqueo de delete físico;
  la auditoría de integridad del harness sigue en cero filas.
