# 14 — Departamento de Afirmación — database-impact.md

> Fase 1. **Nada de esto está aplicado.** Inventario de solo lectura + cambios propuestos.

## 1. Inventario exacto de objetos actuales relacionados

| Objeto | Definición | Rol en Afirmación |
|---|---|---|
| `departamento` (tabla) | `08_estructura.sql:327` | Catálogo por iglesia. Sembrado `EVANGELISMO/AFIRMACION/DISCIPULADO/ENVIO` (`seed_04_por_iglesia.sql:27`). |
| `cargo` código `LIDER_DEPARTAMENTO` | `seed_01_catalogos_globales.sql:35` (Tipo B, nivel IGLESIA) | Cargo a reutilizar para el líder. |
| `persona_cargo` (tabla) | `08_estructura.sql:79` | Sin `departamento_id`; no basta por sí sola. |
| `casa_de_paz`, `casa_de_paz_cargo` | `08_estructura.sql:21,196` | CdP y su liderazgo (`LIDER_CDP`). |
| `casa_de_paz_membresia` | `08_estructura.sql:243`; RLS `27_permisos_estructura.sql:173` | Destino del alta. INSERT = operativo/líder/sublíder CdP. |
| `casa_paz_url` (tabla + triggers + fns) | `19_registro_publico.sql` | URLs públicas. UPDATE RLS = `fn_es_operativo_en` (`:239`). |
| `fn_registrar_persona_via_url`, `fn_resolver_url_registro` | `19_registro_publico.sql:158,128` | Flujo público (se reutiliza intacto). |
| `fn_es_operativo_en` | `05_...:73` → redefinida `43_pastor_no_operativo.sql:17` (solo Supervisor) | Permiso operativo base. |
| `fn_es_lider_cdp`, `fn_es_lider_de_red`, `fn_mi_persona_id`, `fn_mis_iglesias`, `fn_mis_iglesias_detalle` | `05_`, `15_`, `43_` | Reutilizadas por las nuevas funciones. |
| `motivo_llegada` código `INVITACION_PERSONAL` | usado en `19_registro_publico.sql:199` | Motivo del alta interna. |

## 2. Objetos que se reutilizan SIN cambios

`departamento`, `cargo`, `persona`, `persona_detalle`, `persona_llegada`, `casa_de_paz`,
`casa_de_paz_cargo`, `casa_de_paz_red`, `red`, `red_cargo`, `casa_de_paz_membresia` (tabla y su RLS),
`casa_paz_url` (tabla, triggers y funciones públicas), `motivo_llegada`, y todas las funciones de
acceso citadas. El registro público no se modifica.

## 3. Cambios propuestos (NO ejecutados)

### 3.1 Nuevos objetos (aditivos)
- **Tabla** `departamento_cargo` + índice `uq_departamento_cargo_lider_vigente` + triggers
  `trg_auditoria_departamento_cargo` / `trg_no_delete_departamento_cargo` + `fn_validar_departamento_cargo`.
- **Funciones** `fn_es_lider_departamento`, `fn_es_lider_afirmacion_en`,
  `fn_registrar_persona_afirmacion`, `fn_listar_casa_paz_url_afirmacion`, `fn_set_estado_casa_paz_url`.
- **RLS** de `departamento_cargo` (SELECT por iglesia; INSERT/UPDATE por `fn_es_operativo_en`).
- **Policy adicional** `pol_casa_paz_url_update_afirmacion` sobre `casa_paz_url` (permisiva, se
  combina con OR con la existente — no la reemplaza).
- **Grants** EXECUTE de los RPC nuevos a `authenticated`.

### 3.2 Regeneración de función existente (no edita historial de datos)
- `fn_mis_iglesias_detalle()` → agregar columna `es_lider_afirmacion boolean`. Requiere
  `DROP FUNCTION + CREATE` (RETURNS TABLE), igual que `43_pastor_no_operativo.sql:33`. **Riesgo de
  coordinación**: es una función compartida; confirmar que el compañero no la esté editando en
  paralelo antes de regenerarla.

### 3.3 Lo que NO se toca
- No se altera `rol_sistema_enum` (ni ningún enum).
- No se altera la RLS de `casa_de_paz_membresia`.
- No se edita la policy UPDATE existente de `casa_paz_url`.
- No se borra ni modifica ninguna fila de datos.

## 4. Impacto esperado en datos existentes

**Ninguno.** Todos los cambios son DDL aditivo (tablas/funciones/policies nuevas) + una función
regenerada. No hay `UPDATE`/`DELETE` de datos. La única escritura de datos en esta etapa es la
**designación manual del primer Líder de Afirmación** (una fila en `departamento_cargo`), a
ejecutar explícitamente y por separado (Fase A3), previa confirmación de Q-5.

## 5. Plan futuro de migración y rollback

- **Migración**: archivos SQL nuevos `46_..49_` en `harness/11-esquema-bd/sql/`, cada uno en su
  transacción, aplicados por Management API/pooler. Correr las 4 auditorías del harness después.
- **Rollback** (todo reversible sin pérdida):
  - Frontend: no exponer la ruta/nav (feature efectivamente oculta).
  - `pol_casa_paz_url_update_afirmacion`: `DROP POLICY` → vuelve al comportamiento actual.
  - RPC/funciones nuevas: `DROP FUNCTION` (nadie más depende de ellas).
  - `departamento_cargo`: soft — vaciar (`fecha_fin`/`fecha_eliminacion`) para revocar accesos; el
    `DROP TABLE` solo si se descarta el módulo entero (no hay FKs entrantes).
  - `fn_mis_iglesias_detalle`: reponer la versión previa (sin la columna) desde `43_...`.

## 6. Matriz de permisos por actor y operación

| Operación | Super Admin | Pastor | Supervisor | Líder de Afirmación | Líder CdP/Sublíder | Anónimo |
|---|---|---|---|---|---|---|
| Designar Líder de Afirmación (`departamento_cargo` INSERT) | ✗ (no operativo) | ✗ | ✔ (a futuro, panel) | ✗ | ✗ | ✗ |
| Ver asignaciones de su iglesia (SELECT) | ✔ (todas) | ✔ (lectura) | ✔ | ✔ | — | ✗ |
| Registro interno (`fn_registrar_persona_afirmacion`) | ✗ | ✗ | ✗* | ✔ | ✗ | ✗ |
| Registrar persona vía URL pública | — | — | — | — | — | ✔ |
| Administrar estado de URLs (`casa_paz_url` UPDATE) | ✗ | ✗ | ✔ (ya existía) | ✔ (nuevo) | ✗ | ✗ |
| Ver listado de URLs de la iglesia (SELECT) | ✔ | ✔ | ✔ | ✔ | ✔ (miembros leen) | ✗ |
| Crear/editar CdP, Redes, cargos | ✗ | ✗ | ✔ | ✗ | ✗ | ✗ |

\* El RPC interno es exclusivo del Líder de Afirmación por diseño; el Supervisor da de alta personas
por los flujos ya existentes (Personas/Casas de Paz), no por este RPC. Si se quisiera permitir al
Supervisor usar también este RPC, basta con incluir `fn_es_operativo_en` en su chequeo (decisión
menor, no asumida).

**Principios sostenidos:** aislamiento por iglesia (`fn_mis_iglesias`), auditoría + soft delete en
todo objeto nuevo, mínimo privilegio, Pastor y Super Admin nunca operadores de este módulo.
