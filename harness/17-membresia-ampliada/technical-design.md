# 17 — Membresía ampliada — technical-design.md

> Fase 1. **[EXISTE]** verificado en código/esquema reales (rutas citadas).
> **[PROPUESTO]** no existe todavía.

## 1. Estado actual encontrado

### 1.1 Backend

- **[EXISTE]** `persona`, `persona_detalle` (censal), `persona_llegada`,
  `relacion_familiar` + `referencia_familiar` (cónyuge/familia genérico,
  `harness/02-persona-parentela`), `ministerio_persona` (ya soporta
  selección múltiple de ministerios).
- **[EXISTE]** `casa_paz_url`, `fn_resolver_url_registro`,
  `fn_registrar_persona_via_url` (`19_registro_publico.sql`) — alta
  pública atómica, sin sesión, contexto por slug.
- **[EXISTE]** `invitacion_lider` + `fn_mi_invitacion_pendiente` +
  `fn_completar_membresia` (`42_invitacion_lideres.sql`) — Membresía
  obligatoria SOLO para quien llegó por invitación de rol de Casas de
  Paz/Red. Al completar, en la misma transacción asigna el cargo
  (`red_cargo`/`casa_de_paz_cargo`).
- **[EXISTE]** `invitacion_departamento` (`71_invitar_lider_departamento.sql`)
  — variante para Líder de Departamento, mismo patrón.
- **[EXISTE]** `MEMBRESIA_CI_OBLIGATORIO` / `MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO`
  / `MEMBRESIA_OCUPACION_OBLIGATORIO` / `MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO`
  (`21_validaciones_membresia.sql`, `fn_config_formulario`) — obligatoriedad
  configurable por iglesia, ya reutilizada por los 3 flujos actuales.
- **[NO EXISTE]** ningún catálogo de tipos de discipulado, ninguna tabla
  `persona_discipulado`/`persona_seminario`/`persona_universidad_rey_jesus`/
  `persona_mentor`, ningún enum de precisión de fecha
  (`EXACTA|APROXIMADA|SOLO_MES_ANIO|SOLO_ANIO`).
- **[NO EXISTE]** ningún mecanismo de "borrador" (persona parcialmente
  creada, guardada entre páginas del formulario) — hoy los 3 flujos crean
  la Persona completa en una sola llamada atómica al final.
- **[NO EXISTE]** ninguna función que detecte "Membresía incompleta" para
  un usuario autenticado que NO llegó por invitación. `fn_mi_invitacion_pendiente`
  solo mira `invitacion_lider`/`invitacion_departamento`.

### 1.2 Frontend

- **[EXISTE]** `CamposMembresiaFields` (`components/shared/`) — campos
  censales base, compartido por los 3 flujos actuales.
- **[EXISTE]** `FormularioMembresiaPublico.tsx` (registro público),
  `MembresiaObligatoria.tsx` (invitación), `RegistrarPersonaAfirmacion.tsx`
  (interno Afirmación) — los 3 son formularios de una sola página.
- **[NO EXISTE]** ningún componente de asistente/wizard paginado en el
  proyecto (ni acá ni en otro módulo) para copiar el patrón.
- **[NO EXISTE]** ninguna detección general de "rol sin Membresía" en
  `PrivateLayout.tsx` — hoy solo mira `membresiaPendiente` (que viene de
  `obtenerMiInvitacionPendiente`, acotado a invitaciones).

## 2. Piezas nuevas [PROPUESTO] — KAN-123 (campos)

### 2.1 Enum de precisión de fecha (reutilizable)

```sql
CREATE TYPE precision_fecha_enum AS ENUM ('EXACTA', 'APROXIMADA', 'SOLO_MES_ANIO', 'SOLO_ANIO');
```

Aplica a Discipulados, Seminario, Universidad del Rey Jesús y Bautismo
(mismo patrón fecha + precisión en los 4). Ver open-questions Q-4 sobre
si "solo año"/"solo mes y año" deben forzar día=01 en la columna `DATE` o
si conviene separar `anio`/`mes`/`dia` nullable en vez de un `DATE` único
(la regla dice "no obligar a inventar un día" — un `DATE` con día
inventado sería inconsistente con eso).

### 2.2 Catálogo de discipulados

```sql
CREATE TABLE tipo_discipulado (
  id UUID PK, iglesia_id UUID NULL REFERENCES iglesia(id),  -- ver Q-1: ¿global o por iglesia?
  codigo VARCHAR, nombre VARCHAR, orden SMALLINT, activo BOOLEAN,
  + auditoría/soft-delete estándar
)
```

Sembrado con los 6 valores del ticket (Fundamentos de Vida de Reino,
Carácter de Cristo 1/2, Discipulado de la Familia, Líderes de Casas de
Paz, Discipulado Integral DAI). Pertenece conceptualmente al futuro
Departamento de Discipulado (fuera de alcance construirlo ahora, solo el
catálogo, tal como pide el ticket).

```sql
CREATE TABLE persona_discipulado (
  id UUID PK, persona_id UUID FK, tipo_discipulado_id UUID FK,
  fecha_finalizacion DATE NULL, precision_fecha precision_fecha_enum NULL,
  + auditoría/soft-delete
)
```
Varios por persona (0..N), sin unicidad forzada (el ticket no dice si se
puede repetir el mismo tipo dos veces — asumido que sí, ej. reprobó y
repitió; ver Q-2).

### 2.3 Seminario / Universidad del Rey Jesús

Dos opciones de diseño:

- **(a) Tablas dedicadas** `persona_seminario` (persona_id, fecha,
  precision_fecha) y `persona_universidad_rey_jesus` (idem) — simple,
  explícito, pero dos tablas casi idénticas.
- **(b) Tabla genérica** `persona_evento_formativo` (persona_id, tipo
  enum `SEMINARIO|UNIVERSIDAD_REY_JESUS`, fecha, precision_fecha) — menos
  tablas, pero mezcla dos conceptos distintos bajo un nombre genérico.

Recomendado (a) por simplicidad y porque el ticket los trata como
preguntas independientes con textos distintos ("¿Está o estuvo en el
seminario?" vs "¿Cursó la Universidad del Rey Jesús?"), no como una lista
abierta. Ver Q-3.

### 2.4 Mentor

```sql
CREATE TABLE persona_mentor (
  id UUID PK, persona_id UUID FK,       -- quien tiene mentor
  mentor_persona_id UUID FK NULL,       -- si el mentor es miembro registrado
  mentor_nombre_txt VARCHAR NULL,       -- si no lo es (mismo patrón invitado_por_id/txt de persona_llegada)
  mentor_es_miembro BOOLEAN,
  + auditoría/soft-delete
)
```

**Bloqueado por Q-5**: el ticket dice "Entrega una lista de mentores
disponibles" pero no define qué hace que alguien sea "mentor disponible"
(¿un cargo nuevo? ¿cualquier persona de la iglesia buscada por nombre,
igual que `BuscadorPersona`? ¿un catálogo separado que alguien mantiene a
mano?). Sin esa definición no se puede diseñar el selector ni la tabla
con precisión (¿FK a `persona` con un filtro, o catálogo propio?).

### 2.5 Bautismo

Reutiliza el patrón fecha+precisión; no es tabla nueva completa, se
modela como columnas en `persona_detalle` (extensión 1:1, igual que el
resto de datos censales) o tabla `persona_bautismo` si se prefiere
mantener `persona_detalle` liviana:

```
bautizado BOOLEAN, bautizado_en_nuestra_iglesia BOOLEAN,
fecha_bautismo DATE, precision_fecha_bautismo precision_fecha_enum
```

### 2.6 Cónyuge y Familia — **sin tabla nueva**

`relacion_familiar` ya modela cónyuge/hijo/etc. con inverso automático
(`harness/02-persona-parentela` Requisito 7) y `referencia_familiar` ya
cubre "familiar no registrado, en texto libre" (Requisito 8) — exactamente
lo que pide KAN-123 §6/§7 ("nombre del cónyuge... o selección de persona
existente", "cada familiar puede seleccionar si ya existe o escribirse
manualmente"). El campo "¿es miembro de la iglesia?" por familiar ya se
puede derivar: `relacion_familiar` = miembro registrado,
`referencia_familiar` = no. **No hace falta diseño nuevo de datos aquí**,
solo UI que llame el flujo existente de alta de `Relacion_Familiar`/
`Referencia_Familiar` desde el wizard de Membresía (hoy ese flujo vive en
`persona.service.ts`, fuera del formulario de Membresía — falta
conectarlo). Ver Q-6 (UX: ¿se busca con `BuscadorPersona` dentro del
wizard, o se autocompleta al terminar?).

### 2.7 Ministerios — **sin tabla nueva**

`ministerio_persona` ya existe y ya soporta selección múltiple. Falta
solo UI: multiselect en el wizard que llame el mismo alta que ya usa el
resto del sistema para asignar ministerios.

## 3. Piezas nuevas [PROPUESTO] — KAN-124 (wizard paginado)

### 3.1 Componente genérico

`components/shared/FormularioPaginado.tsx` [PROPUESTO]: wrapper de pasos
con barra de progreso, botones Atrás/Siguiente, validación por página
(Zod schema por paso, no uno gigante), diseñado para envolver cualquier
conjunto de "páginas" (cada página = un componente de campos, ej.
`CamposMembresiaFields` ya existente + los nuevos grupos de KAN-123).

### 3.2 Persistencia de progreso — dos niveles posibles

- **(a) Cliente (localStorage/sessionStorage)**: guarda el `FormValues`
  parcial por slug/usuario mientras no se envía nada al backend. Cubre
  "conservar lo completado si abandona y vuelve" **en el mismo
  navegador**, sin cambios de backend, bajo riesgo. No cubre "guardar al
  avanzar de página" en el sentido de que el dato ya exista en la base
  antes del envío final.
- **(b) Servidor (persona en borrador)**: crear una fila real de
  `persona` (estado `BORRADOR`) en la primera página y hacer `UPDATE`
  incremental en cada página siguiente; recién en la última página se
  marca completa (y para el flujo público, recién ahí se crea la
  `casa_de_paz_membresia`). Cubre el requisito literal de KAN-124
  ("guardar al avanzar, no esperar al final") incluso entre
  dispositivos/sesiones, pero es un cambio de fondo: personas
  parcialmente creadas y nunca terminadas (abandono en página 2 de 5) se
  vuelven un estado nuevo a limpiar/reportar, y en el flujo público
  (anónimo, sin autenticación) habría que decidir cómo se referencia ese
  borrador entre requests (token de borrador, cookie, algo — superficie
  nueva de seguridad a diseñar con cuidado, en un endpoint que hoy es
  `anon` y ya tiene rate limit por abuso).

**Recomendado**: (a) ahora, (b) más adelante si el owner confirma que
quiere personas-borrador reales en la base (ver Q-7). (a) ya cumple la
experiencia de usuario pedida ("no perder lo completado") sin abrir la
superficie nueva de (b).

## 4. KAN-126 — detección general de Membresía incompleta

### 4.1 Qué falta exactamente

`fn_mi_invitacion_pendiente` (usado por `PrivateLayout` vía
`membresiaPendiente`) solo cubre usuarios que pasaron por
`invitacion_lider`/`invitacion_departamento`. Un usuario con rol
otorgado por otro camino (ej. bootstrap directo por SQL, como el primer
Líder de Afirmación real — `harness/14-afirmacion/open-questions.md` Q-5
— o cualquier alta futura que no use el flujo de invitación) puede tener
`usuario_rol`/`departamento_cargo`/`red_cargo`/`casa_de_paz_cargo` sin
tener nunca una fila en `persona`, y hoy nunca se le pide completarla.

### 4.2 Diseño propuesto [PROPUESTO], pendiente de confirmación

```sql
fn_mi_membresia_incompleta() RETURNS JSONB
```
Lógica: si `fn_mi_invitacion_pendiente()` devuelve algo, usar eso (caso ya
resuelto, no se toca). Si no, y el usuario tiene algún cargo operativo
vigente (`usuario_rol` O `red_cargo` O `casa_de_paz_cargo` O
`departamento_cargo`, todos con `fecha_fin IS NULL`) pero **no** tiene fila
en `persona`, devolver un objeto equivalente indicando "Membresía
incompleta, sin invitación asociada" (sin `destino`/`rol` para mostrar,
ya que no vino de una invitación concreta).

Para el botón `Saltar`: un flag nuevo, ej. `membresia_recordar_mas_tarde`
persistido en el cliente (localStorage) o en el servidor
(`usuario_preferencia` si existiera, o una columna en `auth.users.raw_app_meta_data`);
se limpia automáticamente en el próximo login (el ticket pide
"re-solicitar en posteriores ingresos" — el Saltar es solo por esa
sesión, no permanente).

### 4.3 Por qué no se implementó ya

Alto radio de impacto: cambia qué ven **todos** los usuarios existentes
del sistema al loguearse, no solo un módulo nuevo. Antes de tocar
`PrivateLayout.tsx` (que hoy gatea con éxito la app entera) hace falta
confirmar con el owner exactamente qué cuenta como "tiene un rol" (¿Super
Admin, que por diseño no tiene Persona, debe quedar exento explícitamente?
¿cuenta un cargo Tipo B como Líder de Afirmación igual que un
`usuario_rol`?) — ver Q-8.

## 5. Frontend afectado (resumen, cuando se implemente)

- `components/shared/FormularioPaginado.tsx` [PROPUESTO]
- `components/shared/CamposMembresiaFields.tsx` [EXISTE] se extiende o se
  parte en sub-componentes por página (Identidad, Censal, Discipulados,
  Seminario/Universidad, Mentor, Bautismo, Familia, Ministerios)
- `hooks/useMembresiaIncompleta.ts` [PROPUESTO] (reemplaza/envuelve
  `useMiInvitacionPendiente` con el caso general de KAN-126)
- `pages/MembresiaObligatoria.tsx`, `FormularioMembresiaPublico.tsx`,
  `RegistrarPersonaAfirmacion.tsx` — se reescriben para envolver
  `FormularioPaginado` en vez de un único `<form>`.
