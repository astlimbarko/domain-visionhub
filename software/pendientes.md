# Pendientes de Revision

## Roles y Permisos del Sistema

Definido en `modulos.md` (seccion "Roles del sistema" y "Panel de configuracion del Supervisor").

**Accion pendiente:** Claude Code examinara el proyecto y disenhara los permisos granulares exactos por rol (que accion puede hacer cada rol en el sistema).

## Panel de configuracion del Supervisor

Documentado en `modulos.md`. El Supervisor de la Vision en Accion configura: dashboards, formularios, departamentos activos, estados SSVA, notificaciones, moneda y catalogos.

**Accion pendiente:** Claude Code definira los detalles tecnicos de cada area configurable.

## Discipulado (no es prioridad ahora)

El modulo de Discipulado se implementara despues del Modulo 1. Por ahora NO se trabaja en:
- Lecciones por curso (cantidad varia: 12, 5, 10).
- Cursos y retiros.
- Envio y formacion post-envio.

Se vera cuando se llegue al modulo correspondiente (despues de Afirmacion).

## Configuracion inicial de iglesias

- **Iglesia de Cochabamba:** Se documenta pero NO se da de alta en esta fase. Verificar que el modelo de `iglesia_padre_id` permita agregarla despues sin migraciones.
- **Supervisor compartido:** La misma persona puede ser supervisor en 2 iglesias. Verificar que RLS permita esto (el supervisor necesita acceder a multiples tenants).
- **Pastor con multi-iglesia:** El pastor de Santa Cruz tambien pastorea Montero. Verificar que el dashboard del pastor muestre ambas iglesias correctamente.

## Area de Membresia

- `fecha_ultimo_envio` — Definir tipo de dato: DATE, TEXT o TIMESTAMP.
- `Cual es su cargo(s) en la iglesia?` — Verificar si la estructura de cargos Tipo A/B cubre esto.
- `En que ministerio sirve?` — Verificar relacion con asignaciones ministeriales.
- `Es lider de algun ministerio?` — Verificar si es cargo o asignacion.

## Area de Evangelismo

- Campo `domicilio` — Definir flujo de normalizacion.
- `telefono_persona_id` — Verificar si es telefono de la persona evangelizada o del evangelizador.

## Area de Liderazgo

- `liderazgo_persona` — Definir si `activo` se calcula automaticamente segun `fecha_fin` o es manual.

## Area de Formulario de CdP

- **Cantidad de evangelizados:** Definir si es informativo o se calcula automaticamente.
- **Tabla de temas:** Definir si es fija (libro 52 lecciones) o configurable.
