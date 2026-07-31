# 15 — Gestión administrativa (Super-Admin · Pastor · Supervisor) — requirements.md

> **Fase 1 (análisis + especificación).** Este documento describe QUÉ se va a
> construir. No implica que nada esté implementado. Ver `database-impact.md`
> para el inventario exacto de lo que hoy existe vs. lo que se propone, y
> `open-questions.md` para las decisiones ya cerradas con el owner.

## 1. Objetivo

Completar la **capa administrativa** de VisionHub para los tres roles que
administran la plataforma y la operación de cada iglesia, sin tocar la operación
diaria de las Casas de Paz (que ya existe):

- **Super-Admin** — administra la plataforma: iglesias, Pastores y Supervisores.
- **Pastor** — máxima autoridad de su iglesia: administra a su Supervisor y la
  jerarquía de iglesias hijas/satélite.
- **Supervisor de la Visión en Acción** — brazo operativo del Pastor: administra
  Líderes de Red, el nuevo **Supervisor de Red**, y los **Departamentos**.

La sesión de análisis (2026-07-30) detectó que la base (permisos, RLS, guards,
sistema de diseño, patrón de invitación dual) es sólida, pero falta
principalmente **UI de gestión** y tres piezas de infraestructura: un rol nuevo,
el tipo de iglesia satélite, y un mecanismo de confirmación por **código de un
solo uso enviado por correo (OTP)** que reemplaza al PIN estático actual.

## 2. Concepto oficial de "Gestionar"

A partir de esta etapa, **Gestionar** es el verbo oficial. Una pantalla de
gestión debe permitir, sobre una entidad, todas estas operaciones:

- agregar
- modificar / cambiar
- suspender
- reactivar
- eliminar (**soft delete** — nunca borrado físico)

**REQ-G-1** — THE sistema SHALL exponer estas operaciones de forma uniforme en
toda pantalla de gestión de las entidades administradas (iglesias, usuarios de
rol, líderes de departamento, líderes de red, supervisores de red).

**REQ-G-2** — WHEN se "elimina" cualquier entidad, THE sistema SHALL marcar
`fecha_eliminacion`/`eliminado_por` (soft delete) y conservar el historial de
forma permanente. THE sistema SHALL NUNCA ejecutar un `DELETE` físico (ya
garantizado por los triggers `fn_bloquear_delete` en todas las tablas).

**REQ-G-3** — WHERE una entidad está "eliminada", THE sistema SHALL dejar de
mostrarla en la operación diaria y de contarla en indicadores, pero SHALL
conservarla consultable en el historial.

## 3. Gestión de cuentas: alta con doble vía (uniforme para roles admin)

Todos los roles administrativos SHALL compartir el mismo comportamiento para
incorporar una persona a un cargo. Siempre existen dos alternativas:

**REQ-C-1 (Opción 1 — buscar existente)** — THE sistema SHALL permitir buscar una
persona ya existente en la base de datos y asignarle el cargo directamente.

**REQ-C-2 (Opción 2 — invitar por correo)** — WHEN la persona aún no existe, THE
sistema SHALL permitir enviar una invitación por correo electrónico que crea la
cuenta y dispara el flujo de completar-cuenta ya existente.

**REQ-C-3** — Este comportamiento de doble vía SHALL ser el mismo patrón ya
implementado en el flujo de líderes de CdP/Red (`BuscadorPersona` + Edge Function
`invitar-lider`); NO se debe duplicar. Ver `technical-design.md §7`.

## 4. Alcance por rol

### 4.1 Super-Admin

Rol técnico. Administra la plataforma, **no** la operación diaria de ninguna
iglesia (ya acotado en `40_acotar_super_admin.sql`). Toda acción sensible exige
confirmación por **OTP por correo** (§7).

**REQ-SA-1** — THE Super-Admin SHALL poder **gestionar iglesias**: crear (ya
existe), modificar (nombre/sufijo, ciudad, correo, moneda por defecto),
suspender/reactivar (`activo`), eliminar (soft) y gestionar la jerarquía
madre/hija.

**REQ-SA-2** — THE Super-Admin SHALL poder **gestionar usuarios de rol**
Super-Admin, Pastor y Supervisor de la Visión en Acción: invitar (ya existe con
doble vía §3), modificar el cargo/iglesia, suspender/reactivar y remover (soft
delete de `usuario_rol`).

**REQ-SA-3** — THE Super-Admin SHALL NO poder asignarse a sí mismo un rol
operativo ni recibir cargos de liderazgo (ya bloqueado en
`fn_validar_asignacion_rol`).

**REQ-SA-4** — WHEN el Super-Admin gestiona iglesias/usuarios, THE sistema SHALL
mantener el patrón visual del panel actual (`Administracion.tsx`,
`DashboardUI`), agregando las acciones faltantes sin rediseñar la página.

### 4.2 Pastor

Máxima autoridad **operativa** de su iglesia, pero NO operativo en el sentido de
`fn_es_operativo_en` (no crea Redes/CdP ni asigna líderes de CdP — eso es del
Supervisor). Delega la operación en su Supervisor.

**REQ-PA-1** — THE Pastor SHALL poder **gestionar a su Supervisor de la Visión
en Acción** (designar con doble vía §3, cambiar, suspender/reactivar, remover).
El backend ya lo permite (`fn_validar_asignacion_rol`, rama PASTOR); falta la UI.

**REQ-PA-2** — THE Pastor SHALL poder **gestionar iglesias hijas y satélite** de
su iglesia: crear, convertir hija↔satélite, suspender/reactivar, eliminar
(soft). Ver §5 (satélite) y §7 (OTP).

**REQ-PA-3** — THE Pastor SHALL NO poder: eliminarse a sí mismo, modificar su
propio cargo de Pastor, ni ser removido por su Supervisor.

**REQ-PA-4** — THE Pastor SHALL conservar su acceso de **solo lectura** a los
dashboards y reportes globales que ya tiene (`43_pastor_no_operativo.sql`).

### 4.3 Supervisor de la Visión en Acción

Principal delegado operativo del Pastor. Único rol `operativo` hoy.

**REQ-SU-1** — THE Supervisor SHALL poder **gestionar Líderes de Red** (ya
existe vía Casas de Paz) y el nuevo **Supervisor de Red de la Visión en Acción**
(§6).

**REQ-SU-2** — THE sistema SHALL exponer una entrada independiente en el menú
lateral izquierdo llamada **"Departamentos"**, desde la cual el Supervisor
gestiona **exclusivamente los líderes de los departamentos** (§8). Esta
funcionalidad SHALL NO mezclarse con la gestión de usuarios generales ni con el
Panel del Supervisor existente.

**REQ-SU-3** — THE Supervisor SHALL NO poder: eliminarse a sí mismo, modificar
su propio cargo, eliminar al Pastor, ni crear iglesias hijas o satélite (esto
último es potestad del Pastor y del Super-Admin). La mayoría ya está garantizada
en backend (`fn_validar_asignacion_rol`, PIN/OTP, `fn_crear_iglesia`).

## 5. Iglesia satélite (modelo completo, no destructivo)

Hoy la tabla `iglesia` solo tiene `iglesia_padre_id` (jerarquía madre/hija); no
existe distinción hija/satélite. Decisión del owner: **modelar el tipo completo,
sin destruir lo existente**.

**REQ-IS-1** — THE sistema SHALL agregar a `iglesia` una columna `tipo`
(`HIJA` | `SATELITE`) con `DEFAULT 'HIJA' NOT NULL`, de modo que todas las filas
actuales queden como `HIJA` sin migración de datos y sin cambiar la RLS ni los
dashboards que hoy se basan en `iglesia_padre_id`/`fn_mis_iglesias()`.

**REQ-IS-2** — WHILE hija y satélite sean funcionalmente idénticas (etapa
actual), THE diferencia SHALL ser conceptual/visual (etiqueta, ícono, color en
la UI). El comportamiento diferenciado futuro se apoyará sobre `tipo` sin
reescribir lo existente.

**REQ-IS-3** — THE sistema SHALL permitir **convertir** una iglesia de hija a
satélite y viceversa (cambio del valor `tipo`), con auditoría y confirmación OTP.

**REQ-IS-4** — THE creación/gestión de iglesias hijas y satélite SHALL estar
permitida al **Super-Admin y al Pastor** de la iglesia madre (ampliación del
permiso actual, hoy solo Super-Admin).

## 6. Rol nuevo: Supervisor de Red de la Visión en Acción

**REQ-SR-1** — THE sistema SHALL agregar el valor `SUPERVISOR_RED_VISION_ACCION`
al enum `rol_sistema_enum`, con su lógica de permisos, RLS, navegación y
gestión, análoga a los roles existentes.

**REQ-SR-2** — THE Supervisor de Red SHALL ser gestionado por el Supervisor de
la Visión en Acción (con doble vía §3).

**REQ-SR-3** — El alcance funcional preciso del Supervisor de Red (qué ve, qué
puede hacer) SHALL definirse en `technical-design.md §6`; en la duda, se acota a
supervisión de una o más Redes, sin capacidades del Supervisor de la Visión en
Acción. Ver `open-questions.md OQ-SR`.

## 7. Confirmación por OTP por correo (reemplaza al PIN estático)

Hoy las acciones sensibles del Super-Admin exigen un **PIN estático** de 6
dígitos (`usuario_pin`, hash bcrypt; `fn_exigir_pin(p_pin)`), pedido en el
frontend. El owner lo considera mala práctica.

**REQ-OTP-1** — THE sistema SHALL reemplazar el PIN estático por un **código de
un solo uso (OTP) de 6 dígitos, generado al momento de la acción y enviado por
correo** al usuario que la ejecuta, usando el servidor SMTP ya configurado
(Brevo, `acceso@somoscdv.com`).

**REQ-OTP-2** — THE OTP SHALL tener expiración corta (ver `open-questions.md
OQ-OTP-TTL`, propuesto 10 min), ser de un solo uso, almacenarse **hasheado**, y
quedar auditado (solicitado/usado).

**REQ-OTP-3** — THE cambio SHALL reutilizar el "plumbing" existente: las
funciones sensibles ya reciben un parámetro `p_pin`; `fn_exigir_pin` SHALL pasar
a verificar el OTP contra el nuevo almacén, con el mínimo cambio de firma
posible. Ver `technical-design.md §9`.

**REQ-OTP-4** — THE correo del OTP SHALL respetar la identidad de correspondencia
del proyecto: 100% español, registro formal ("presione"/"use este código"),
identidad "Centro de Vida 4 Anillo", **nunca** "VisionHub" (ver
`harness/EMAILS-AUTH.md`). No es una plantilla nativa de Supabase Auth: la envía
una Edge Function propia, HTML propio.

**REQ-OTP-5** — WHERE aplica hoy el PIN (crear iglesia, fusiones,
config, moneda, toggle de departamento, y las nuevas acciones de gestión), THE
OTP SHALL aplicar de la misma forma, sin dejar ninguna acción sensible sin
confirmación.

## 8. Departamentos (gestión y colores)

**REQ-DEP-1** — THE Supervisor SHALL gestionar, desde "Departamentos" (§REQ-SU-2),
al **Líder de cada departamento** (doble vía §3), sobre la tabla ya existente
`departamento_cargo` (cargo `LIDER_DEPARTAMENTO`), con historial/soft delete.

**REQ-DEP-2** — THE sistema SHALL mostrar los cuatro departamentos oficiales con
sus nombres **en verbos** y color institucional:

| Código interno (BD) | Nombre UI (verbo) | Color |
|---|---|---|
| `EVANGELISMO` | Evangelizar | 🟡 Amarillo |
| `AFIRMACION` | Afirmar | 🔵 Azul |
| `DISCIPULADO` | Discipular | 🔴 Rojo |
| `ENVIO` | Enviar | ⚪ Gris |

**REQ-DEP-3** — THE color institucional SHALL persistirse (nueva columna `color`
en `departamento`, sembrada por iglesia) y usarse consistentemente en toda la UI
que muestre departamentos.

## 9. Requisitos transversales de interfaz

**REQ-UI-1 (pie de soporte)** — THE menú lateral izquierdo SHALL incluir, en su
parte inferior, un bloque de **soporte institucional** discreto y profesional
que invite a reportar errores ("¿Encontraste un problema o un comportamiento
inesperado? Ayúdanos a mejorar la plataforma") y abra un correo a
**`soporte@somoscdv.com`** con un texto base (asunto + cuerpo prellenado) que
facilite describir el problema. Debe existir tanto en el sidebar desktop como en
el pie del drawer móvil (`AppShell.tsx`).

**REQ-UI-2 (hover azul estándar)** — THE comportamiento de "hover azul" de los
campos de formulario (hoy `CAMPO_ESTILO` en `CamposMembresiaFields.tsx`, token
`--ring`) SHALL convertirse en el estándar de todos los formularios nuevos, y
SHALL documentarse en el sistema de diseño
(`frontend/.claude/skills/frontend-style/SKILL.md`). No se modifica el trabajo
ya hecho por Matías; se extrae/expone y se documenta.

**REQ-UI-3 (design system)** — WHERE se creen nuevos patrones visuales (colores
de departamento, pie de soporte, hover azul), THE sistema de diseño existente
SHALL ser el lugar donde se registren, reutilizando `DashboardUI`,
`TarjetaHeader`, `KpiMosaico`, `ui/*` y el resto de piezas ya consolidadas.

## 10. Fuera de alcance

- Los roles operativos de Casa de Paz/Red ya existentes (Líder de Red, Líder y
  Sublíder de CdP): no se rediseñan; solo se referencian como patrón reutilizable.
- Comportamiento **diferenciado** hija vs. satélite más allá de lo visual (etapa
  futura; el modelo queda listo).
- Los departamentos distintos de la designación de su líder (métricas, tableros,
  operación interna de Evangelizar/Discipular/Enviar).
- App móvil nativa.

## 11. Reglas de negocio (resumen)

- **RB-1** Aislamiento por iglesia: cada rol solo ve/actúa sobre sus iglesias
  (`fn_mis_iglesias()`), salvo el Super-Admin en su alcance técnico permitido.
- **RB-2** Toda "eliminación" es soft delete; el historial es permanente.
- **RB-3** Toda acción sensible se confirma con OTP por correo (§7).
- **RB-4** Nadie puede auto-eliminarse ni auto-modificar su propio cargo.
- **RB-5** Jerarquía de asignación (ya en `fn_validar_asignacion_rol`):
  Super-Admin → Pastor; Pastor/Super-Admin → Supervisor V.A.; Supervisor V.A. →
  Líderes de Red / Supervisor de Red / Líderes de CdP.
