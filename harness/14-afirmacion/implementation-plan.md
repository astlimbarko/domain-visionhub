# 14 — Departamento de Afirmación — implementation-plan.md

> Fase 1: este plan **no se ejecuta todavía**. Se ejecuta tras
> "Especificación aprobada. Puedes comenzar la implementación."

## Convenciones a respetar

- Migraciones SQL: nuevos archivos numerados en `harness/11-esquema-bd/sql/`, sin editar
  los existentes (append-only del historial). El siguiente número libre es **`46_...`**
  (último actual: `45_ciudad.sql`). Aplicar cada archivo en su propia transacción.
- **Trabajo en paralelo**: agregar objetos nuevos; no borrar ni alterar destructivamente
  tablas/policies existentes. Para `casa_paz_url` se **agrega** una policy, no se edita.
- Aplicar a Supabase por Management API / pooler `aws-0-ca-central-1` (patrón de sesiones
  previas). Nunca correr `DROP SCHEMA` ni resets.

## Fase A — Backend: modelo de asignación

- **A1** `46_departamento_cargo.sql`: tabla `departamento_cargo` + índice único de líder
  vigente + triggers de auditoría/no-delete + `fn_validar_departamento_cargo` + RLS
  (SELECT por iglesia, INSERT/UPDATE por `fn_es_operativo_en`) + grants.
- **A2** `47_funciones_afirmacion.sql`: `fn_es_lider_departamento`, `fn_es_lider_afirmacion_en`.
- **A3** Designación temporal del primer Líder de Afirmación **por DB** (script manual, con
  el trigger de validación deshabilitado si hiciera falta, igual que el bootstrap de roles).
  Requiere: qué persona y en qué iglesia (ver open-questions Q-5).

## Fase B — Backend: registro interno

- **B1** `fn_registrar_persona_afirmacion(p_datos, p_casa_de_paz_cargo_id)` (RPC atómico,
  `SECURITY DEFINER`), con validación de líder de CdP vigente + `fn_es_lider_afirmacion_en`.
- **B2** GRANT EXECUTE a `authenticated`.

## Fase C — Backend: administración de URLs

- **C1** `pol_casa_paz_url_update_afirmacion` (policy adicional en `casa_paz_url`).
- **C2** `fn_listar_casa_paz_url_afirmacion(p_iglesia_id)` (jerarquía Red→CdP→URL).
- **C3** `fn_set_estado_casa_paz_url(p_ids, p_estado)` (masivo, idempotente, resultados parciales).
- **C4** Exponer flag `es_lider_afirmacion` (extender `fn_mis_iglesias_detalle()` — requiere
  `DROP + CREATE` por ser `RETURNS TABLE`, igual que hizo `43_pastor_no_operativo.sql`).

## Fase D — Frontend: acceso y navegación

- **D1** `ROUTES.AFIRMACION` en `utils/constants.ts`.
- **D2** Reflejar `es_lider_afirmacion` en `auth.store.ts` + tipos + `useEsLiderAfirmacion`.
- **D3** Guard `RequiereCapacidad` (o extender `RequiereRol`) + item de nav por capacidad en
  `utils/permisos.ts` / `AppShell.tsx`.

## Fase E — Frontend: registro interno

- **E1** Extraer los campos de `FormularioMembresiaPublico` a `CamposMembresia` compartido.
- **E2** `pages/Afirmacion.tsx` vista "Registrar persona" + selector de Líder de CdP
  (`BuscadorPersona`) → `services/afirmacion.service.ts` → RPC B1.

## Fase F — Frontend: panel de URLs

- **F1** Vista "URLs": tabla con jerarquía, búsqueda/filtro, copiar, estado.
- **F2** Selección múltiple + acciones masivas (activar/desactivar/activar todas) → RPC C3,
  con confirmación, toasts de resultado parcial e invalidación de queries.

## Archivos que probablemente se modificarán/crearán

**Backend (nuevos):** `46_departamento_cargo.sql`, `47_funciones_afirmacion.sql`,
`48_afirmacion_rpc.sql`, `49_afirmacion_urls.sql` (numeración tentativa).
**Backend (regenerar función, no editar histórico):** `fn_mis_iglesias_detalle`.
**Frontend (modificar):** `utils/constants.ts`, `utils/permisos.ts`, `store/auth.store.ts`,
`components/layout/AppShell.tsx`, `App.tsx`, `types/auth.types.ts` (o dashboard types),
`src/locales/es/common.json`.
**Frontend (nuevos):** `pages/Afirmacion.tsx`, `components/afirmacion/*`,
`components/shared/CamposMembresia.tsx`, `components/layout/RequiereCapacidad.tsx`,
`services/afirmacion.service.ts`, `hooks/useAfirmacion.ts`, `hooks/useEsLiderAfirmacion.ts`,
`types/afirmacion.types.ts`.

## Migraciones previstas

Ver Fases A–C. Ninguna migración altera datos existentes; solo agrega tablas/funciones/policies.
Rollback = soft (desactivar policy nueva / no exponer nav); ver `database-impact.md §5`.

## Pruebas

- **Unitarias/DB (SQL):** unicidad de líder vigente por departamento; `fn_es_lider_afirmacion_en`
  true/false según vigencia; `fn_registrar_persona_afirmacion` crea las 4 filas correctas y es
  atómico (rollback si falla la membresía); rechazo con líder de CdP no vigente.
- **RLS:** un usuario sin asignación no puede ejecutar el RPC ni UPDATE de `casa_paz_url`; no ve
  URLs de otra iglesia; el Supervisor sigue pudiendo (no regresión).
- **Idempotencia:** `fn_set_estado_casa_paz_url` dos veces seguidas → segunda sin cambios; ids de
  otra iglesia → omitidos con motivo.
- **Integración/e2e (navegador, cuenta real):** designar líder por DB → aparece nav → registrar
  persona eligiendo líder de CdP → verificar membresía; activar/desactivar URL; "activar todas";
  registro público sin regresión.
- **Datos de prueba:** nunca correos inventados (riesgo de rebote Brevo). Usar `INSERT` directo por
  SQL o alias `+` sobre un correo real; limpiar con `DISABLE/ENABLE TRIGGER trg_no_delete_*`.

## Estrategia de verificación

Correr las 4 consultas de auditoría del harness (RLS al 100%, columnas de auditoría, `trg_no_delete`,
`search_path`) tras aplicar cada migración: deben seguir en cero filas. Verificar en navegador con
cuenta real (patrón de inyección de estado en `localStorage` para no re-loguear).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Colisión con el compañero en objetos compartidos | Solo agregar; para `casa_paz_url` policy nueva, no editar; coordinar numeración de archivos SQL. |
| Función `plpgsql RETURNS TABLE` con columnas ambiguas (bug recurrente del proyecto) | Calificar todas las columnas; ejercitar con datos reales antes de cerrar. |
| Líder con múltiples CdP | El RPC exige `casa_de_paz_cargo_id` explícito (una sola CdP). Ver Q-1. |
| Multi-tenancy en acciones masivas | Cada id se valida contra `fn_mis_iglesias()` server-side; ids ajenos se omiten. |
| Regresión del registro público | No se toca el mecanismo; suite e2e de no-regresión. |

## Dependencias entre tareas

A1 → A2 → (B1, C1, C2, C3). C4 → D2 → D3. B1 → E2. C2/C3 → F1/F2. A3 depende de A1 (+ decisión Q-5).
