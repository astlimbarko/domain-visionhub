# 17 — Membresía ampliada — requirements.md

> **Fase 1 (análisis + especificación).** Cubre KAN-123, KAN-124, KAN-125 y
> KAN-126, un cluster de tickets que describe un mismo flujo (registro /
> completar Membresía) en distintas entradas. Ver `database-impact.md` para
> el inventario exacto de lo que hoy existe vs. lo que se propone, y
> `open-questions.md` para las decisiones de producto que bloquean el
> diseño fino (no la investigación).

## 1. Objetivo

Ampliar el formulario de Membresía con los campos pedidos por Daniel
Morales (KAN-123), organizarlo en un asistente paginado reutilizable
(KAN-124), y aplicarlo consistentemente a las tres entradas por las que
hoy —o a futuro— se completa una ficha de Membresía:

1. **Registro público por URL de Casa de Paz** (KAN-125) — ya existe
   (`13-registro-publico-cdp`), sin autenticación.
2. **Completar Membresía al aceptar una invitación de liderazgo** — ya
   existe (`42_invitacion_lideres.sql`, `MembresiaObligatoria.tsx`).
3. **Completar Membresía al ingresar a VisionHub con rol pero sin
   invitación** (KAN-126) — **no existe todavía**, es un caso nuevo.
4. **Registro interno por Afirmación** — ya existe (`14-afirmacion`),
   reutiliza los mismos campos.

## 2. Alcance de este documento

Es un documento de **investigación y especificación**, no de
implementación. Encontramos que el cluster tiene una dependencia real:
KAN-124 (paginación) y KAN-125/126 (dónde se usa la paginación) dependen
de qué campos y qué agrupamiento en "páginas" define KAN-123 — y KAN-123
tiene varias decisiones de producto sin cerrar (ver `open-questions.md`).
Construir la paginación ahora, contra el set de campos viejo, arriesga
rehacer trabajo cuando se cierren esas decisiones.

## 3. Los 4 tickets, resumidos

### KAN-123 — Ampliar formulario de Membresía con nuevos campos

8 grupos de campos nuevos: Discipulados (catálogo + fecha + precisión,
selección múltiple), Seminario (sí/no + fecha + precisión), Universidad
del Rey Jesús (sí/no + fecha + precisión), Mentor (sí/no + selección de
una lista + es-miembro), Bautismo (sí/no + en-nuestra-iglesia + fecha +
precisión), Cónyuge (sí/no + nombre + es-miembro), Familia (sí/no + lista
de familiares con selección "ya existe" o texto libre + es-miembro cada
uno), Ministerios (sí/no + selección múltiple, **ya existen en BD**).
Patrón repetido: fecha + precisión (`Exacta | Aproximada | Solo mes y año
| Solo año`) para Discipulados, Seminario, Universidad y Bautismo.

### KAN-124 — Formulario de Membresía paginado

Dividir el formulario (ampliado por KAN-123) en secciones/páginas,
navegación, guardado al avanzar (no solo al final), conservar progreso si
la persona abandona y vuelve. Explícitamente reutilizable por los
distintos flujos de alta.

### KAN-125 — Membresía desde URL de Casa de Paz

El alta pública ya existe (`RegistroPublico.tsx`, `FormularioMembresiaPublico.tsx`,
`fn_registrar_persona_via_url`). Ya cumple "sin botón Saltar" y "contexto
resuelto server-side por slug". Lo que falta es que use el formulario
paginado (KAN-124) con el set de campos ampliado (KAN-123).

### KAN-126 — Completar Membresía al ingresar a VisionHub

Caso **distinto** del ya existente `MembresiaObligatoria.tsx`: ese
componente solo se dispara para usuarios que llegaron por
`invitacion_lider`/`invitacion_departamento` (`fn_mi_invitacion_pendiente`).
KAN-126 pide detectar **cualquier** usuario autenticado con rol pero sin
Membresía completa (no solo los invitados), con botón `Saltar` real (entra
al sistema) y re-solicitud en cada ingreso posterior mientras siga
incompleta.

## 4. Lo que ya está resuelto (no rehacer)

- El registro público por URL (`19_registro_publico.sql`,
  `fn_resolver_url_registro`, `fn_registrar_persona_via_url`) — sin botón
  Saltar, contexto server-side, rate limit. **KAN-125 ya cumple sus
  requisitos actuales**; solo falta la paginación/campos nuevos.
- El formulario compartido `CamposMembresiaFields` (usado por
  `FormularioMembresiaPublico`, `MembresiaObligatoria` y
  `RegistrarPersonaAfirmacion`) — ya evita triplicar el JSX de los campos
  censales base.
- El modelo de relaciones familiares (`relacion_familiar`,
  `referencia_familiar`, `tipo_relacion` con `inverso_id` y
  `cuenta_para_familia` — `harness/02-persona-parentela`) — cubre
  conceptualmente Cónyuge y Familia de KAN-123 (§6/§7) sin tabla nueva,
  ver `technical-design.md` §3.
- `ministerio_persona` — ya existe y ya soporta selección múltiple
  (KAN-123 §8 no necesita tabla nueva, solo UI).
- La obligatoriedad configurable por iglesia (`MEMBRESIA_*_OBLIGATORIO`,
  `21_validaciones_membresia.sql`, `fn_config_formulario`) — patrón a
  replicar para los campos nuevos si hiciera falta marcarlos obligatorios.

## 5. Actores

Los mismos 5 de `harness/14-afirmacion` (Líder de Afirmación, Supervisor,
Pastor, Super Admin, Persona pública anónima) más: **cualquier usuario
autenticado con al menos un cargo operativo vigente** (nuevo actor
implícito de KAN-126, sin nombre propio hasta ahora en el sistema).

## 6. Reglas de negocio heredadas (no se relajan)

- Aislamiento por iglesia en todo objeto/consulta nuevo.
- El registro público nunca confía en datos de iglesia/CdP enviados por el
  navegador (contexto resuelto server-side por slug) — se mantiene igual
  para KAN-125.
- Auditoría + soft delete en toda tabla nueva.
- "Fecha aproximada" nunca debe forzar a la persona a inventar un día o
  mes que no recuerda (KAN-123, regla general de fechas).

## 7. Ver también

- `technical-design.md` — inventario EXISTE/PROPUESTO y diseño de las
  piezas nuevas (catálogo de discipulados, wizard paginado, draft-save,
  detección general de Membresía incompleta).
- `database-impact.md` — tablas/funciones nuevas propuestas y su impacto.
- `open-questions.md` — decisiones de producto que bloquean el diseño
  fino de cada ticket.
- `implementation-plan.md` — qué se hizo en esta sesión (nada de código de
  este cluster; solo la especificación) y el orden recomendado para
  implementarlo cuando las preguntas se resuelvan.
