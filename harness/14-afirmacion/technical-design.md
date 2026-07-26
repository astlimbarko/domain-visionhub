# 14 — Departamento de Afirmación — technical-design.md

> Fase 1. Todo lo marcado **[PROPUESTO]** aún no existe; todo lo marcado
> **[EXISTE]** se verificó en el esquema/código reales (rutas citadas abajo).

## 1. Estado actual encontrado

### 1.1 Base de datos (`harness/11-esquema-bd/sql/`)

- **[EXISTE]** `departamento` (`08_estructura.sql:327`): catálogo por iglesia
  (`iglesia_id, codigo, nombre, activo`, + auditoría/soft-delete). Sembrado con
  `EVANGELISMO, AFIRMACION, DISCIPULADO, ENVIO` (`seeds/seed_04_por_iglesia.sql:27`).
  **No tiene** tabla puente hacia persona/cargo.
- **[EXISTE]** `cargo` con código `LIDER_DEPARTAMENTO` (Tipo `B`, nivel `IGLESIA`,
  orden 19 — `seeds/seed_01_catalogos_globales.sql:35`).
- **[EXISTE]** `persona_cargo` (`08_estructura.sql:79`): cargo a nivel persona, pero
  **sin** `departamento_id`, así que no puede expresar "líder de tal departamento".
- **[EXISTE]** `casa_de_paz`, `casa_de_paz_cargo`, `casa_de_paz_membresia`,
  `casa_de_paz_red`, `red`, `red_cargo` (`08_estructura.sql`).
- **[EXISTE]** `casa_paz_url` (`19_registro_publico.sql:7`): `iglesia_id, persona_id,
  casa_de_paz_id, casa_de_paz_cargo_id, slug, estado (estado_url_enum), fecha_activacion/
  desactivacion`, + auditoría/soft-delete. Índice único de slug vivo.
  - Trigger `trg_gestionar_casa_paz_url` (`:93`): crea la URL en `INACTIVO` al asignar
    `LIDER_CDP`, y la desactiva al cerrar ese cargo.
  - `fn_resolver_url_registro(slug)` (`:128`, `SECURITY DEFINER`, `GRANT ... TO anon`):
    lectura pública; devuelve `admite_registro`, `lider_nombre`, `casa_de_paz_nombre`.
  - `fn_registrar_persona_via_url(slug, datos)` (`:158`, `SECURITY DEFINER`, `GRANT ... TO
    anon`): alta atómica pública (persona + persona_detalle + persona_llegada + membresía),
    con rate limit (20/10 min por URL).
  - **RLS** (`:233`): SELECT = `iglesia_id IN fn_mis_iglesias()`; **UPDATE = `fn_es_operativo_en(iglesia_id)`**
    (solo Supervisor). Sin INSERT/DELETE policy (nace por trigger, nunca se borra).
- **[EXISTE]** RLS de `casa_de_paz_membresia` (`27_permisos_estructura.sql:173`): INSERT/UPDATE =
  `fn_es_operativo_en OR fn_es_lider_cdp OR fn_es_sublider_cdp`. **No** incluye Afirmación.
- **[EXISTE]** Funciones de acceso (`05_funciones_acceso.sql`, `15_permisos.sql`):
  `fn_mi_persona_id()`, `fn_mis_iglesias()`, `fn_es_operativo_en()` (tras
  `43_pastor_no_operativo.sql` = solo `SUPERVISOR_VISION_ACCION`), `fn_es_lider_cdp()`,
  `fn_es_lider_de_red()`, `fn_mis_iglesias_detalle()` (expone `es_operativo`, `es_pastor`).

### 1.2 Frontend (`frontend/src/`)

- **[EXISTE]** Rutas en `App.tsx` + `utils/constants.ts` (`ROUTES`), protegidas por
  `components/layout/RequiereRol.tsx` con listas de `RolUI`.
- **[EXISTE]** `utils/permisos.ts`: única fuente de verdad de nav/rutas por rol.
  `RolUI = SUPER_ADMIN | PASTOR | SUPERVISOR | LIDER_RED | LIDER_CDP | SUBLIDER_CDP`
  (un **solo rol efectivo** por prioridad — `determinarRolUI`). `CATALOGO_NAV`, `RUTAS_POR_ROL`,
  `obtenerNavItems`, `rolesPermitidosPara`.
- **[EXISTE]** `hooks/useRolUI.ts` (deriva el RolUI), `store/auth.store.ts` (iglesias,
  iglesiaActiva, esSuperAdmin), `hooks/useDashboard.ts` (`useMisRoles`).
- **[EXISTE]** Registro público: `pages/RegistroPublico.tsx`,
  `components/registro-publico/FormularioMembresiaPublico.tsx`,
  `services/registro-publico.service.ts`, `hooks/useRegistroPublico.ts`,
  `types/registro-publico.types.ts`.
- **[EXISTE]** `components/casas-de-paz/BuscadorPersona.tsx` (búsqueda tokenizada por
  nombre+apellido — reutilizable para elegir al Líder de CdP).
- **[EXISTE]** `services/persona.service.ts` (altas por inserts directos + RLS).

## 2. Decisión: roles generales vs. cargos departamentales

**Confirmado con el owner (Fase 1):** NO se agrega `LIDER_AFIRMACION` a
`rol_sistema_enum`. El permiso se deriva de una **asignación departamental**:
`persona + departamento AFIRMACION + cargo LIDER_DEPARTAMENTO + iglesia`.

- `usuario_rol` se mantiene para roles generales del sistema.
- `departamento` se mantiene como catálogo por iglesia.
- Se reutiliza el cargo `LIDER_DEPARTAMENTO`.
- Se crea la tabla puente **[PROPUESTO] `departamento_cargo`** (ver §4).

Motivo: es ortogonal (multi-sombrero), consistente con `red_cargo`/`ministerio_persona`,
y deja listo el futuro panel del Supervisor (que solo insertará una fila).

## 3. Tablas reutilizadas sin cambios

`iglesia`, `persona`, `persona_detalle`, `persona_llegada`, `casa_de_paz`,
`casa_de_paz_cargo`, `casa_de_paz_membresia`, `casa_de_paz_red`, `red`, `red_cargo`,
`cargo`, `departamento`, `motivo_llegada`, `casa_paz_url`.

## 4. Nuevas estructuras [PROPUESTO]

### 4.1 Tabla `departamento_cargo`

```
departamento_cargo (
  id             uuid PK default gen_random_uuid(),
  iglesia_id     uuid NOT NULL REFERENCES iglesia(id),
  departamento_id uuid NOT NULL REFERENCES departamento(id),
  persona_id     uuid NOT NULL REFERENCES persona(id),
  cargo_id       uuid NOT NULL REFERENCES cargo(id),   -- LIDER_DEPARTAMENTO
  fecha_inicio   date NOT NULL,
  fecha_fin      date,
  + columnas de auditoría estándar (fecha_creacion/actualizacion, creado_por,
    actualizado_por, fecha_eliminacion, eliminado_por)
  CONSTRAINT chk_departamento_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
)
```

- **Índice único** `uq_departamento_cargo_lider_vigente` sobre `(departamento_id, cargo_id)`
  `WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL` → un solo líder vigente por departamento.
- Triggers estándar: `trg_auditoria_departamento_cargo` (`fn_auditoria`), `trg_no_delete_departamento_cargo`
  (`fn_bloquear_delete`).
- Trigger de validación **[PROPUESTO] `fn_validar_departamento_cargo`**: la persona pertenece a
  `iglesia_id`, `departamento` pertenece a la misma iglesia, y `cargo.codigo = 'LIDER_DEPARTAMENTO'`.

### 4.2 Funciones de acceso [PROPUESTO]

- `fn_es_lider_departamento(p_iglesia_id uuid, p_departamento_codigo varchar) RETURNS boolean`
  `SECURITY DEFINER`: existe fila vigente en `departamento_cargo` para `fn_mi_persona_id()`,
  cargo `LIDER_DEPARTAMENTO`, departamento con ese código en esa iglesia.
- `fn_es_lider_afirmacion_en(p_iglesia_id uuid) RETURNS boolean` = wrapper con
  `'AFIRMACION'` (azúcar para RLS/legibilidad).

### 4.3 RPC de registro interno [PROPUESTO]

```
fn_registrar_persona_afirmacion(p_datos jsonb, p_casa_de_paz_cargo_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```
Pasos:
1. Resolver el `casa_de_paz_cargo` por `p_casa_de_paz_cargo_id`: debe ser cargo `LIDER_CDP`
   **vigente** (`fecha_fin IS NULL`), con su `casa_de_paz_id`, `iglesia_id`, CdP activa.
   Si no → excepción `AFIRMACION_LIDER_CDP_INVALIDO`.
2. Autorización: `IF NOT fn_es_lider_afirmacion_en(v_iglesia_id) THEN RAISE ... AFIRMACION_SIN_PERMISO`.
3. Insertar `persona` (+ `persona_detalle` si hay datos censales), `persona_llegada`
   (motivo `INVITACION_PERSONAL`, `invitado_por_id` = el líder de CdP), y
   `casa_de_paz_membresia` (`es_principal=true`) en la CdP resuelta — todo en la misma
   transacción (la función es una unidad atómica).
4. Devolver `{ persona_id, nombre_completo, casa_de_paz_nombre }`.

Reutiliza la validación de obligatoriedad de membresía ya existente
(`21_validaciones_membresia.sql`) porque inserta `persona_detalle`.

### 4.4 RPC(s) de administración de URLs [PROPUESTO]

- Listado enriquecido: `fn_listar_casa_paz_url_afirmacion(p_iglesia_id uuid) RETURNS TABLE(...)`
  `SECURITY DEFINER` con guard `fn_es_lider_afirmacion_en OR fn_es_operativo_en`. Devuelve por
  fila: `url_id, slug, estado, lider_cdp_nombre, casa_de_paz_nombre, red_nombre, lider_red_nombre`,
  filtrando a URLs cuyo `casa_de_paz_cargo` (LIDER_CDP) esté **vigente**.
- Acción masiva idempotente: `fn_set_estado_casa_paz_url(p_ids uuid[], p_estado estado_url_enum)
  RETURNS jsonb` `SECURITY DEFINER`: valida permiso + que cada URL sea de la iglesia del caller y
  de un líder de CdP vigente; aplica el cambio solo a las que difieren; devuelve
  `{ actualizadas: n, omitidas: [{id, motivo}] }`. Idempotente y con resultados parciales.
  - "Activar todas" = el frontend obtiene los ids del listado y llama a este RPC con estado `ACTIVO`.

### 4.5 RLS / grants [PROPUESTO]

- `departamento_cargo`: `ENABLE ROW LEVEL SECURITY`. SELECT = `iglesia_id IN fn_mis_iglesias()`.
  INSERT/UPDATE = `fn_es_operativo_en(iglesia_id)` (el Supervisor designa; hoy se hace por DB con
  el trigger deshabilitado, igual que el bootstrap de roles).
- `casa_paz_url` UPDATE: **agregar una policy permisiva adicional** (no modificar la existente,
  para minimizar colisión con el trabajo en paralelo): `pol_casa_paz_url_update_afirmacion`
  con `USING/WITH CHECK fn_es_lider_afirmacion_en(iglesia_id)`. En Postgres las policies
  permisivas se combinan con OR, así que Supervisor **y** Líder de Afirmación podrán actualizar.
- GRANT EXECUTE de los RPC nuevos a `authenticated` (no a `anon`).
- Registro interno: **no** se toca la RLS de `casa_de_paz_membresia` (el RPC es `SECURITY DEFINER`
  y valida permiso internamente → mínimo privilegio).

## 5. Contratos de datos (frontend ↔ backend)

- `fn_registrar_persona_afirmacion(p_datos, p_casa_de_paz_cargo_id)` → `{ persona_id, nombre_completo, casa_de_paz_nombre }`.
  `p_datos` = mismo shape que `DatosRegistroPublico` (`types/registro-publico.types.ts`).
- `fn_listar_casa_paz_url_afirmacion(p_iglesia_id)` → filas con la jerarquía de §4.4.
- `fn_set_estado_casa_paz_url(p_ids, p_estado)` → `{ actualizadas, omitidas[] }`.
- Errores server-side por `ERRCODE=P0001` con prefijos (`AFIRMACION_*`), mapeados a i18n en el
  frontend (mismo patrón duck-typed de `error.code`/`error.message` que ya usa el proyecto).

## 6. Frontend afectado [PROPUESTO]

- `utils/constants.ts`: nueva ruta `AFIRMACION: '/afirmacion'`.
- `utils/permisos.ts`: nuevo `NavItem` de Afirmación **mostrado por capacidad**, no por RolUI
  (ver decisión). Se añade el ítem al `CATALOGO_NAV` y el `AppShell`/`obtenerNavItems` lo incluye
  cuando `esLiderAfirmacion` es true, en paralelo a las rutas por rol.
- Backend flag: extender `fn_mis_iglesias_detalle()` (o `fn_mis_roles_dashboard`) con
  `es_lider_afirmacion boolean`, y reflejarlo en `auth.store.ts` / tipos.
- `hooks/useEsLiderAfirmacion.ts` [PROPUESTO]: lee el flag para la iglesia activa.
- `components/layout/RequiereCapacidad.tsx` [PROPUESTO] (o extender `RequiereRol`): guard por
  booleano en vez de por lista de RolUI.
- `pages/Afirmacion.tsx` [PROPUESTO] con dos vistas: "Registrar persona" (reusa el form de
  membresía) y "URLs" (tabla con jerarquía, selección múltiple, acciones masivas).
- `components/afirmacion/*` [PROPUESTO], `services/afirmacion.service.ts`,
  `hooks/useAfirmacion.ts`, `types/afirmacion.types.ts`.
- Reutilizar `FormularioMembresiaPublico` extrayendo su cuerpo de campos a un componente
  compartido (p. ej. `CamposMembresia`) para no duplicar el formulario; el submit interno usa el
  nuevo RPC y agrega el selector de Líder de CdP (`BuscadorPersona`).

## 7. Seguridad del formulario público

Sin cambios en el mecanismo público ya existente (cumple todas las prohibiciones del §4.2 del
instructivo): ruta pública `/registro/:slug` sin auth, contexto resuelto server-side por slug,
`anon` solo puede ejecutar `fn_resolver_url_registro`/`fn_registrar_persona_via_url` (cero GRANT de
tabla a `anon`, `REVOKE ALL` explícito), rate limit por URL, respuesta pública mínima. El panel de
Afirmación solo cambia **qué URLs están activas**, no el mecanismo de alta.

## 8. Transacciones, idempotencia, duplicados

- **Atomicidad interna**: `fn_registrar_persona_afirmacion` corre como una transacción (a
  diferencia de `crearReporte()` del módulo Reportes, que hace inserts separados y puede dejar
  huérfanos — se evita ese patrón aquí).
- **Idempotencia masiva**: `fn_set_estado_casa_paz_url` solo actúa sobre URLs cuyo estado difiere;
  repetir la acción no cambia nada ni falla.
- **Duplicados**: `uq_persona_ci` (parcial, vivo) bloquea CI repetido; el frontend además puede
  avisar por nombre/CI antes de enviar (ver open-questions Q-2).

## 9. Relaciones (resumen)

```
iglesia ─< departamento ─< departamento_cargo >─ persona
                              │
                              └─ cargo (LIDER_DEPARTAMENTO)

Líder de Red ─ red ─< casa_de_paz_red >─ casa_de_paz ─< casa_de_paz_cargo (LIDER_CDP)
                                                        │
                                          casa_paz_url ─┘  (slug → registro público)
persona (nueva) ─< casa_de_paz_membresia >─ casa_de_paz
```

## 10. Alternativas consideradas y descartadas

- **`LIDER_AFIRMACION` en `rol_sistema_enum`**: descartada — rompe el multi-sombrero y mezcla un
  rol de sistema con una capacidad departamental. (Confirmado por el owner.)
- **`departamento_persona` estilo `ministerio_persona`** (es_lider bool, sin cargo): válida y más
  simple, pero ignora el cargo `LIDER_DEPARTAMENTO` ya sembrado; se prefirió `departamento_cargo`.
- **Columna `departamento_id` en `persona_cargo`**: descartada — modifica una tabla central que el
  compañero también toca (riesgo de colisión) y ensucia una tabla de propósito general.
- **Ampliar la RLS de `casa_de_paz_membresia` para el registro interno**: descartada — más
  superficie de escritura directa; se prefiere el RPC `SECURITY DEFINER` (mínimo privilegio).
- **Modificar la policy UPDATE de `casa_paz_url`**: se prefiere **añadir** una policy adicional en
  vez de editar la existente, para no pisar trabajo en paralelo.
