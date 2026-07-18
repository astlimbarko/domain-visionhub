# Tareas — Estructura Organizacional

## 1. Red y Casa de Paz

- [ ] 1.1 Crear `red`. — *Req 1.1, 1.2*
- [ ] 1.2 Crear `casa_de_paz`. — *Req 2.2*
- [ ] 1.3 Crear `casa_de_paz_red` con `chk_cdp_red_fechas` y `uq_cdp_red_vigente`. — *Req 2.1, 2.3, 2.4*
- [ ] 1.4 Agregar la FK `direccion_asignacion.casa_de_paz_id` (pendiente de [02-persona-parentela](../02-persona-parentela/tasks.md)). — *Req 2.10*
- [ ] 1.5 Crear `fn_validar_red_desactivacion()` y su disparador. — *Req 7.5*
- [ ] 1.6 Crear `fn_cdp_desactivacion_cierra_membresias()` y su disparador. — *Req 7.6*
- [ ] 1.7 Aplicar el bloque estándar de Fundación a ambas. — *00-fundacion*

## 2. Cargos

- [ ] 2.1 Crear `tipo_cargo_enum` con `A`, `B`. — *Req 4.2*
- [ ] 2.2 Crear el catálogo `cargo`. — *Req 4.1*
- [ ] 2.3 Sembrar los 20 cargos de la tabla del diseño, más `ANFITRION`. — *Req 4.1, 4.2*
- [ ] 2.4 Confirmar la clasificación: `ANCIANO` es Tipo A; `SUPERVISOR_VISION` es Tipo B. — *Req 4.2*
- [ ] 2.5 No sembrar `MENTOR`: `cargos.md` lo declara pendiente de definir. — *Req 4.1*
- [ ] 2.6 Crear `persona_cargo` con `chk_persona_cargo_fechas`. — *Req 4.6*
- [ ] 2.7 Crear `fn_validar_persona_cargo()` (un Tipo A vigente + misma iglesia) y su disparador. — *Req 4.3, 7.3*
- [ ] 2.8 Crear la vista `v_persona_cargo_vigente`. — *Req 4.7*
- [ ] 2.9 Verificar que `activo` **no** existe como columna: se deriva de `fecha_fin IS NULL`. — *Req 4.7*
- [ ] 2.10 Verificar que una persona puede tener un Tipo A y tres Tipo B a la vez. — *Req 4.5*
- [ ] 2.11 Verificar que un segundo Tipo A vigente falla con `CARGO_TIPO_A_DUPLICADO`. — *Req 4.3*

## 3. Cargos con ámbito

- [ ] 3.1 Crear `red_cargo` con `chk_red_cargo_fechas`. — *Req 1.3, 1.6*
- [ ] 3.2 Crear `fn_validar_red_cargo()` con la lista de cargos únicos. **No usar índice parcial con subconsulta**: el predicado debe ser inmutable y PostgreSQL lo rechaza. — *Req 1.4, 1.7, 7.2*
- [ ] 3.3 Verificar que `SUBLIDER_RED` admite varios vigentes. — *Req 1.5*
- [ ] 3.4 Crear `casa_de_paz_cargo` con `chk_cdp_cargo_fechas`. — *Req 2.5, 2.7*
- [ ] 3.5 Crear el disparador equivalente: `LIDER_CDP` y `ANFITRION` únicos, `SUBLIDER_CDP` libre. — *Req 2.5, 2.6, 2.7, 7.1*
- [x] 3.5b **Hecho 2026-07-18** (`25_iglesia_membresia_cdp.sql`): `fn_validar_cdp_cargo` no verificaba que la Persona perteneciera a la misma Iglesia que la Casa_De_Paz (a diferencia de `fn_validar_persona_cargo`). Encontrado al revisar el caso de `Iglesia_Membresia`. Verificado: asignar a alguien de Montero como líder de una CdP de Santa Cruz ahora falla con `CDP_CARGO_IGLESIA_DISTINTA`. — *Req 14*
- [ ] 3.6 Verificar que una persona puede liderar dos CdP a la vez. — *Req 2.8*
- [ ] 3.7 Verificar que un segundo `LIDER_CDP` vigente falla. — *Req 7.1*
- [x] 3.7b **Hecho 2026-07-18**: `casa_de_paz.iglesia_membresia_id` + `fn_validar_iglesia_membresia` (solo un Rol_Superior la fija). Verificado con `fn_es_rol_superior_de_cdp` en falso (sin contexto de auth) rechazando el cambio, y el `CHECK` de "distinta de la propia iglesia" rechazando el caso trivial. Falta una verificación de punta a punta con una cuenta real de líder de red/supervisor cuando se construya el módulo de frontend de Casas de Paz. — *Req 15, 16*
- [ ] 3.8 Crear `fn_redes_incompletas(uuid)`. — *Req 1.8*
- [ ] 3.9 Verificar que se puede crear una red sin encargados y que aparece en `fn_redes_incompletas`. — *Req 1.8, 1.9*

## 4. Membresía

- [ ] 4.1 Crear `casa_de_paz_membresia` con `chk_membresia_fechas`. — *Req 3.1*
- [ ] 4.2 Crear `uq_membresia_principal_vigente`. — *Req 3.2*
- [ ] 4.3 Crear el índice `casa_de_paz_membresia (persona_id) WHERE es_principal AND fecha_fin IS NULL`. — *Rendimiento*
- [ ] 4.4 Verificar que una persona puede tener una membresía principal y otras no principales. — *Req 3.3*
- [ ] 4.5 Verificar que dos principales vigentes falla. — *Req 3.2*
- [ ] 4.6 Documentar en el glosario la diferencia Miembro_CdP / Miembro_Iglesia. Ningún dashboard debe decir "miembros" sin decir de cuál. — *Req 3.5*

## 5. Ministerios

- [ ] 5.1 Crear `ministerio` con `iglesia_id NOT NULL` y **sin** `red_id`. — *Req 5.1, 5.2*
- [ ] 5.2 Crear `uq_ministerio_codigo_iglesia`. — *Req 5.3*
- [ ] 5.3 Sembrar los 14 ministerios por cada iglesia. — *Req 5.3*
- [ ] 5.4 No crear Evangelismo Élite como ministerio 15: es un equipo dentro de Evangelismo, Módulo 2. — *Req 5.3*
- [ ] 5.5 Crear `ministerio_persona` con `chk_ministerio_persona_fechas`. — *Req 5.4, 5.5*
- [ ] 5.6 Crear `uq_ministerio_lider_vigente`. — *Req 5.6*
- [ ] 5.7 Crear `fn_ministerio_por_red(uuid)` con los cuatro JOINs. — *Req 5.8, 5.9*
- [ ] 5.8 Verificar que **no** existe `red_id` en `ministerio_persona`: la red se deriva. — *Req 5.9*
- [ ] 5.9 Verificar que cambiar a alguien de CdP cambia su red en `fn_ministerio_por_red` sin tocar la asignación ministerial. Es la prueba de que la derivación funciona. — *Req 5.9*
- [ ] 5.10 **Confirmar con el owner:** ¿el cruce red × ministerio debe mostrar a quienes no tienen CdP? Hoy el `JOIN` los descarta. — *Req 5.8*
- [ ] 5.11 Restringir el cierre de un ministerio a `fn_es_admin_en(iglesia_id)`. — *Req 5.7*

## 6. Departamentos

- [ ] 6.1 Crear `departamento`. — *Req 6.1, 6.2*
- [ ] 6.2 Sembrar los cuatro por cada iglesia. — *Req 6.1*
- [ ] 6.3 Restringir el cambio de `activo` al Supervisor (`fn_es_admin_en`). — *Req 6.3*
- [ ] 6.4 Crear el historial de representantes departamentales de Red. — *Req 6.4*
- [ ] 6.5 Permitir representantes departamentales de CdP sin exigirlos. — *Req 6.5*

## 7. RLS

- [ ] 7.1 Habilitar RLS y aplicar las 4 políticas estándar a todas las tablas del área. — *01-tenancy Req 4.1*
- [ ] 7.2 `cargo` es catálogo global: lectura para `authenticated`, escritura solo `SUPER_ADMIN`. — *Req 4.1*
- [ ] 7.3 Ejecutar la auditoría de RLS. Cero filas. — *01-tenancy Req 4.7*
- [x] 7.4 **Hecho 2026-07-18** (`27_permisos_estructura.sql`): `red`, `casa_de_paz` (INSERT), `casa_de_paz_red`, `red_cargo`, `casa_de_paz_cargo`, `casa_de_paz_membresia`, `ministerio` y `ministerio_persona` habían quedado con la política genérica de escritura de `16_rls.sql` ("iglesia_id IN fn_mis_iglesias()"), que permite a cualquier usuario con acceso a la iglesia crear una red, auto-asignarse Líder de Red o de cualquier CdP, mover una CdP a otra red, o tocar la membresía de otra persona. Encontrado al construir el frontend de Casas de Paz. Acotado a `fn_es_operativo_en` más, según la tabla, el Líder de la propia Red o CdP. Verificado con una cuenta Supervisor real: crear red, asignar líder/sublíderes/encargados, crear CdP, asignar líder/anfitrión, y que desactivar una red con CdP vigentes falla con `RED_CON_CDP_ACTIVAS`.

## 8. Verificación

- [ ] 8.1 Con el JWT del líder de red de Montero, pedir las CdP de Santa Cruz. Debe devolver `[]`. — *01-tenancy Req 4.4*
- [ ] 8.2 Asignar un cargo a una persona de otra iglesia. Debe fallar con `CARGO_IGLESIA_DISTINTA`. — *Req 7.3*
- [ ] 8.3 Desactivar una red con CdP vigentes. Debe fallar con `RED_CON_CDP_ACTIVAS`. — *Req 7.5*
- [ ] 8.4 Desactivar una CdP y confirmar que sus membresías quedaron con `fecha_fin`. — *Req 7.6*
- [ ] 8.5 Registrar `fecha_fin < fecha_inicio` en cada historial. Debe fallar en todos. — *Req 7.4*
- [ ] 8.6 Cambiar una CdP de red y confirmar que el historial conserva la red anterior. — *Req 2.3*

## Dependencias

- [00-fundacion](../00-fundacion/), [01-tenancy-iglesias](../01-tenancy-iglesias/), [02-persona-parentela](../02-persona-parentela/).

## Bloquea a

[04-reporte-cdp](../04-reporte-cdp/), [05-estados-ssva](../05-estados-ssva/), [08-finanzas-cdp](../08-finanzas-cdp/), [09-dashboards](../09-dashboards/).
