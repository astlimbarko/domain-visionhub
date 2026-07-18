# Módulos Futuros

Esbozo de lo que viene después del Módulo 1. **No se especifica en detalle todavía**: `domain_knowledge` tiene huecos en varias de estas áreas y especificarlas ahora garantiza reescribirlas después.

Lo que sí importa hoy: que el esquema del Módulo 1 no les cierre la puerta. Cada sección dice qué quedó preparado y qué habrá que agregar.

---

## Módulo 2 — Departamento de Evangelismo

El trabajo grande de evangelismo a nivel de toda la iglesia. El Módulo 1 ya cubre el trabajo chico de cada casa de paz.

### Ya está preparado

- `evangelismo.escala` tiene los cuatro valores del enum (`CASA_DE_PAZ`, `RED`, `IGLESIA`, `COBERTURA`). Solo `CASA_DE_PAZ` es usable, por un `CHECK`.
- Abrir el módulo es una línea: `ALTER TABLE evangelismo DROP CONSTRAINT chk_evangelismo_solo_cdp_modulo1;`
- `meta_evangelismo_asignada` ya soporta metas por jerarquía; se extiende a red e iglesia.
- El Ministerio de Evangelismo ya existe entre los 14.

### Qué falta

| Tema | Detalle |
|------|---------|
| Evangelismo Élite | `ministerios.md` lo describe como equipo dentro del Ministerio de Evangelismo, bajo autoridad del evangelista. Se modela como `ministerio_equipo`. **No es un ministerio 15.** |
| Normalización de domicilio | En el Módulo 1 es texto libre. Cuando el departamento haga seguimiento, pasa al Modelo_Hibrido. |
| Metas por red e iglesia | Extender `meta_evangelismo_asignada` con ámbito, igual que `evento`. |
| Representantes departamentales | El historial ya existe en [03-estructura](03-estructura/); falta la operación. |
| Campañas | No está en `domain_knowledge`. Hay que investigarlo. |

---

## Módulo 3 — Departamento de Afirmación

Bautismo, altar, retiro de sanidad interior. Fuente: `domain_knowledge/departamentos/afirmacion.md`.

### Ya está preparado

- El formulario de membresía del Módulo 1 ya captura los datos base de la persona.
- El mapeo de `bd-modelo.md` ya define la tabla `afirmacion` con `bautizo_en_esta_iglesia`, `fecha_bautizo`, `iglesia_bautizado` (FK) o `iglesia_bautizado_txt`.
- `casa_de_paz.iglesia_membresia_id` ya existe (agregado 2026-07-18, ver [03-estructura](03-estructura/design.md#iglesia_membresia_id)): cuando el censo de Miembro_Iglesia se construya, cuenta a las personas de esa CdP como membresía de esa Iglesia en vez de la Iglesia dueña de la CdP. Cubre el caso de un líder de una Iglesia cuya CdP funciona en la ciudad de una Iglesia hermana.

### Qué falta

| Tema | Detalle |
|------|---------|
| Tabla `afirmacion` | Fechas de altar, fiesta, bautizo. Retiro de sanidad interior. |
| **Miembro_Iglesia** | Acá se define de verdad: `cargos.md` dice que se es miembro de la iglesia al bautizarse. El Módulo 1 solo tiene Miembro_CdP. Los dashboards van a tener que mostrar los dos. |
| RSLI | Retiro de Sanidad Interior. Ver `afirmacion.md`. |
| Operadores de Afirmación | Registran los datos de los bautizados. |

**Impacto en el Módulo 1:** cuando entre, todo dashboard que hoy dice `miembros_cdp` va a tener que decidir si además muestra `miembros_iglesia`. Por eso el campo se llama `miembros_cdp` desde ahora ([09-dashboards](09-dashboards/design.md)).

---

## Módulo 4 — Departamento de Discipulado

Los 7 cursos, los retiros y el envío. Es el que desbloquea la mitad del SSVA.

### Ya está preparado

- `estado` ya tiene `DA` y `DI` sembrados con `activo = false`. Activarlos es un `UPDATE`.
- `configuracion_definicion` ya tiene `CLASES_PARA_DI` y `ASISTENCIAS_PARA_DA` con `modulo = 4`, ocultos del panel.
- `fn_transicionar_estado` y `persona_estado` no cambian.
- `fn_validar_estado_activo` ya bloquea las transiciones a DA y DI hasta que se activen.

### Qué falta

| Tema | Detalle |
|------|---------|
| Cursos | 7, con orden y nombre. Fuente: `departamentos/discipulado.md`. |
| Lecciones | La cantidad varía (12, 5, 10). `pendientes.md` deja abierto si hay estándar o es configurable. |
| Inscripción | Persona, curso, fecha de alta, fecha de completado. |
| **Asistencia a clases** | Es lo que habilita DA y DI. Misma decisión que en el reporte de CdP: lista de personas, no números. |
| Retiro del Espíritu Santo | Evento de un día. |
| Retiro de Mentores | Evento de un día. |
| Envío | Fecha de envío como líder de CdP. `fecha_ultimo_envio` sigue pendiente de tipo (DATE, TEXT o TIMESTAMP). |
| Formación post-envío | Seminario, Universidad Vino Nuevo. |

### Las transiciones que se activan

| Transición | Criterio |
|-----------|----------|
| NC/CRE → DA | asiste a discipulado |
| DA → DI | `CLASES_PARA_DI` clases ausentes |
| DI → DA | retoma asistencia |
| RE → DA | asiste a discipulado |

**Decisión pendiente:** si el owner aprueba `RE → CRE` con 2 visitas ([05-estados-ssva](05-estados-ssva/requirements.md#requisito-7-re--cre)), hay que reconciliar esa regla con `RE → DA`. Probablemente convivan: RE → CRE por asistencia a la CdP, RE → DA por asistencia al discipulado.

---

## Módulo 5 — Departamento de Envío

Envío de líderes a abrir casas de paz.

### Qué falta

| Tema | Detalle |
|------|---------|
| Requisitos de envío | Discipulado de líderes completo + Retiro del Espíritu Santo + aval pastoral. Depende del Módulo 4. |
| Comisiones | Sin documentar. Investigar. |
| Operadores de Envío | Apoyo administrativo en comisiones. |

Depende del Módulo 4: no se puede verificar "completó el discipulado de líderes" sin discipulado.

---

## Módulo 6 — Finanzas completas

Contabilidad general. El Módulo 1 solo registra ingresos de casa de paz.

### Qué falta

| Tema | Detalle |
|------|---------|
| Egresos | No modelados. |
| Tipo de cambio | El Módulo 1 no convierte monedas ([08-finanzas-cdp](08-finanzas-cdp/requirements.md), Req 3.8). Acá hace falta: fecha, fuente y política de conversión. |
| Conteo de ofrendas | `finanzas/finanzas.md` describe el proceso. |
| Reportes por período | Semanal, mensual, trimestral, semestral, anual. Parcialmente cubierto por `fn_ingresos_*`. |
| Diezmo nominal | `finanzas_ingreso.persona_id` ya existe y está sin usar. El diezmo viene en sobre con nombre, así que el dato existe en papel. |

---

## App móvil

Después de que la web funcione. No se documenta ahora.

### Ya está preparado

La decisión de fondo del Módulo 1 fue **poner todas las reglas en la base**:

- Cada transición de estado es un disparador, no código de React.
- Cada permiso es una política RLS, no un `if` del front.
- Cada configuración es una fila, no una constante compilada.
- Cada dashboard es una RPC que devuelve JSON listo.

La app móvil consume la misma API de Supabase y obtiene el mismo comportamiento sin reimplementar nada. Si alguna regla hubiera quedado en el front, la app tendría que copiarla y las dos se irían desviando.

### Qué falta

| Tema | Detalle |
|------|---------|
| Stack | Sin definir. |
| Modo sin conexión | Las casas de paz se reúnen en domicilios; la señal puede fallar. Es la decisión de diseño más importante de la app. |
| Notificaciones push | El Módulo 1 expone las notificaciones como consulta, sin enviarlas ([07-calendario-eventos](07-calendario-eventos/requirements.md), Req 6.5). |

---

## Cochabamba

No es un módulo, pero es el escalamiento que el modelo ya soporta.

Santa Cruz y Montero nacen con `iglesia_padre_id = NULL`. Cuando Cochabamba entre:

```sql
INSERT INTO iglesia (nombre, ciudad, cobertura_id)
VALUES ('Centro de Vida Global', 'Cochabamba', :cobertura_id);

UPDATE iglesia SET iglesia_padre_id = :cochabamba_id
WHERE ciudad IN ('Santa Cruz', 'Montero');
```

Dos sentencias. Sin migración de esquema, sin cambio de políticas RLS. Es lo que exige el Requisito 7.7 de [01-tenancy-iglesias](01-tenancy-iglesias/requirements.md), y hay una tarea que lo prueba en una rama descartable antes de que haga falta de verdad.

Lo mismo vale para la iglesia número 4, la 10 o la 100.

---

## Cobertura superior

`domain_knowledge/cargos/cargos.md` dice que la Red del Ap. Edgar Ortuño está bajo Iglesia Rey Jesús (Ap. Guillermo Maldonado, Miami).

`cobertura.cobertura_padre_id` ya existe y no se usa en el Módulo 1. Cuando haga falta registrarlo, es un `INSERT` y un `UPDATE`.
