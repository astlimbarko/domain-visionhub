# 17 — Membresía ampliada — implementation-plan.md

## Estado al cierre de esta sesión (2026-08-08)

Esta sesión fue de **investigación y especificación únicamente** para
KAN-123, KAN-124, KAN-125 y KAN-126. No se escribió código de este
cluster (ni SQL ni frontend) porque el diseño fino depende de las
decisiones de producto listadas en `open-questions.md` (5 de ellas
afectan directamente el modelo de datos de KAN-123). Ver
`requirements.md` §4 para el detalle de lo que ya existía y no había que
rehacer, y `database-impact.md` §5 para el orden recomendado una vez se
respondan las preguntas.

Ticket KAN-127 (permisos de Afirmación, relacionado pero independiente
de este cluster) sí se implementó en esta misma sesión — ver
`harness/14-afirmacion/` para el módulo base y el commit de esta sesión
para el detalle (nueva función `fn_listar_casas_de_paz_afirmacion` +
pestaña "Casas de Paz" en el frontend de Afirmación).

## Fases recomendadas (una vez resueltas las preguntas)

### Fase A — Modelo de datos de KAN-123

1. Cerrar Q-1, Q-2, Q-3, Q-4, Q-5 con el owner.
2. Migración: `precision_fecha_enum`, `tipo_discipulado` (+ seed),
   `persona_discipulado`, `persona_seminario`,
   `persona_universidad_rey_jesus`, `persona_mentor`, columnas/tabla de
   bautismo. RLS + auditoría + `trg_bloquear_delete` en cada una.
3. Sin UI todavía — verificable por curl/RPC directo, mismo patrón que
   `harness/12-pruebas-curl`.

### Fase B — UI de campos de KAN-123 (sin wizard)

4. Extender `CamposMembresiaFields` o partirlo en sub-componentes por
   grupo (Discipulados, Seminario, Universidad, Mentor, Bautismo,
   Cónyuge, Familia, Ministerios), cada uno usable de forma aislada.
5. Cónyuge/Familia: UI que llama al alta ya existente de
   `relacion_familiar`/`referencia_familiar` (Q-6).
6. Ministerios: multiselect sobre `ministerio_persona` ya existente.

### Fase C — Wizard paginado (KAN-124)

7. Cerrar Q-7 (persistencia cliente vs. servidor).
8. Construir `FormularioPaginado` genérico.
9. Envolver los grupos de la Fase B en páginas; aplicar a
   `FormularioMembresiaPublico` (KAN-125) primero (menor riesgo, sin
   sesión de por medio).

### Fase D — Completar Membresía al ingresar (KAN-126)

10. Cerrar Q-8 (alcance exacto).
11. `fn_mi_membresia_incompleta()` + botón `Saltar` con re-solicitud en
    login siguiente.
12. Aplicar el wizard de la Fase C también a este flujo y al de
    invitación existente (`MembresiaObligatoria.tsx`), unificando los 4
    puntos de entrada sobre el mismo componente, tal como pide KAN-124
    ("este comportamiento será reutilizado por los diferentes flujos").

## Verificación esperada antes de "Finalizada" en cada ticket

Mismo estándar que el resto del proyecto: build/typecheck limpio,
prueba real end-to-end (no solo revisión de código) antes de mover
cualquiera de estos 4 tickets más allá de "En revisión".
