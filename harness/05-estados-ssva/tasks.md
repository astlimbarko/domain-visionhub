# Tareas — Estados SSVA

## 1. Motor de criterios

- [ ] 1.1 Crear `criterio_definicion` (global, con rangos). — *Req 11.1*
- [ ] 1.2 Crear `criterio_valor` (por iglesia) con `uq_criterio_valor`. — *Req 11.1*
- [ ] 1.3 Sembrar los 8 criterios de la tabla del diseño. — *Req 5.2, 5.5, 6.2, 8.2, 9.2, 10.4*
- [ ] 1.4 Crear `fn_criterio(uuid, varchar)` con `COALESCE` al valor por defecto. — *Req 11.2, 11.3*
- [ ] 1.5 Verificar que una iglesia sin filas en `criterio_valor` devuelve los valores por defecto. — *Req 11.3*
- [ ] 1.6 Crear `fn_validar_criterio_valor()` y su disparador. — *Req 11.9*
- [ ] 1.7 Verificar que `VISITAS_PARA_CRE = 0` falla con `CRITERIO_FUERA_DE_RANGO`. — *Req 11.9*
- [ ] 1.8 Restringir la escritura de `criterio_valor` a `fn_es_admin_en(iglesia_id)`. — *Req 11.4, 11.5*
- [ ] 1.9 Verificar que `creado_por` / `actualizado_por` registran quién cambió el criterio. — *Req 11.8*
- [ ] 1.10 Auditar el código: ningún umbral literal. Buscar `12`, `90`, `8`, `2`, `3` en las funciones. Todos deben salir de `fn_criterio`. — *Req 11.1*

## 2. Estados

- [ ] 2.1 Crear `estado`. — *Req 1.4*
- [ ] 2.2 Sembrar los 6, con `DA` y `DI` en `activo = false`. — *Req 1.1, 1.2*
- [ ] 2.3 Crear `persona_estado` con `chk_persona_estado_fechas`. — *Req 2.1*
- [ ] 2.4 Crear `uq_persona_estado_vigente`. — *Req 2.2, 1.5*
- [ ] 2.5 Crear `idx_persona_estado_persona`. — *Rendimiento*
- [ ] 2.6 Crear `fn_validar_estado_activo()` y su disparador. — *Req 1.3*
- [ ] 2.7 Verificar que transicionar a `DA` falla con `ESTADO_NO_DISPONIBLE`. — *Req 1.3*
- [ ] 2.8 Crear `fn_transicionar_estado(...)` con la guarda de estado idéntico. — *Req 2.3, 2.4, 2.5*
- [ ] 2.9 Verificar que transicionar al mismo estado **no** crea fila de historial. — *Req 2.6*
- [ ] 2.10 Aplicar el bloque estándar de Fundación. — *00-fundacion*

## 3. Estado inicial

- [ ] 3.1 Crear el disparador que asigna `SIM` al crear una persona por evangelismo. — *Req 3.1*
- [ ] 3.2 Crear el disparador que asigna `SIM` al crear una persona por alta rápida. — *Req 3.2*
- [ ] 3.3 Verificar que toda persona nace con exactamente un estado vigente. — *Req 1.5, 3.3*
- [ ] 3.4 Permitir el cambio manual del estado inicial. — *Req 3.4*

## 4. Visitas consecutivas

- [ ] 4.1 Crear `fn_visitas_consecutivas(uuid, uuid)`. — *Req 5.1*
- [ ] 4.2 Verificar el caso: vino, faltó, vino → debe dar **1**, no 2. Es la prueba que distingue "consecutivas" de "últimas N". — *Req 5.1*
- [ ] 4.3 Verificar que una reunión no reportada no rompe la racha. — *Decisión de diseño*
- [ ] 4.4 Verificar que sin asistencias devuelve 0. — *Req 5.1*
- [ ] 4.5 Verificar que se cuenta sobre reuniones reportadas, no sobre semanas del calendario. — *Decisión de diseño*

## 5. Transiciones

- [ ] 5.1 Crear `fn_evaluar_estado_por_asistencia()`. — *Req 5, 6, 7*
- [ ] 5.2 Crear `trg_evaluar_estado` como `AFTER INSERT` sobre `casa_de_paz_asistencia`. **`AFTER` y no `BEFORE`**: la función debe ver la fila nueva. — *Req 5.8, 6.7*
- [ ] 5.3 Verificar que RE se evalúa **antes** que CRE y hace `RETURN` temprano. — *Riesgo*
- [ ] 5.4 Crear `fn_evaluar_membresia_cdp(uuid, uuid, date)`. — *Req 8, 9*
- [ ] 5.5 Crear `migracion_propuesta` con `uq_migracion_pendiente`. — *Req 8.3*
- [ ] 5.6 Crear el endpoint para que un líder resuelva una propuesta. — *Req 8.5*
- [ ] 5.7 Verificar que la migración **no** se ejecuta sola. — *Req 8.4*
- [ ] 5.8 Verificar que no se acumula una propuesta por semana (`ON CONFLICT DO NOTHING`). — *Req 8.3*

## 6. Inactividad

- [ ] 6.1 Crear `fn_inactividad_cdp(uuid)`. — *Req 10.1, 10.3*
- [ ] 6.2 Verificar que Inactivo **no** existe como fila en `estado`. — *Req 10.2*
- [ ] 6.3 Verificar que la membresía **no** se cierra sola por inactividad. — *Req 10.6*
- [ ] 6.4 Conectar `supera_umbral` a la alerta del líder. — *Req 10.5*

## 7. Verificación de reglas

Cada una es un escenario end-to-end con curl. Son la prueba de que el motor funciona.

- [ ] 7.1 **NC → CRE:** persona de 25 años en NC, dos asistencias consecutivas. Debe quedar CRE con motivo "2 visitas consecutivas". — *Req 5.1*
- [ ] 7.2 **Menor no avanza:** persona de 8 años en NC, cuatro asistencias consecutivas. Debe seguir NC. — *Req 5.4*
- [ ] 7.3 **Edad al límite:** persona que cumple 12 entre la primera y la segunda visita. La edad se evalúa a la fecha de la reunión que dispara. — *Req 5.6*
- [ ] 7.4 **Sin fecha de nacimiento:** persona con `es_menor = true`. Debe seguir NC. Con `es_menor = false`, debe pasar a CRE. — *Req 5.7*
- [ ] 7.5 **RE:** persona CRE, última asistencia hace 100 días, asiste. Debe quedar RE. — *Req 6.1*
- [ ] 7.6 **RE no aplica a nuevos:** persona sin asistencia previa, primera asistencia. **No** debe quedar RE. — *Req 6.5*
- [ ] 7.7 **RE antes que CRE:** persona NC, ausente 100 días, asiste. Debe quedar RE, no CRE. — *Riesgo*
- [ ] 7.8 **RE → CRE:** persona RE, dos asistencias consecutivas. Debe quedar CRE. — *Req 7.1*
- [ ] 7.9 **Membresía automática:** persona sin membresía, dos asistencias consecutivas. Debe tener membresía principal. — *Req 9.1, 9.3*
- [ ] 7.10 **Migración propuesta:** miembro de la CdP A con ocho asistencias consecutivas a la CdP B. Debe existir una propuesta pendiente y la membresía principal debe seguir en A. — *Req 8.1, 8.4*
- [ ] 7.11 **Criterio configurable:** cambiar `VISITAS_PARA_CRE` a 4 y verificar que con 2 visitas ya no promueve. — *Req 11.6*
- [ ] 7.12 **Sin retroactividad:** bajar `VISITAS_PARA_CRE` de 4 a 2 y confirmar que los NC con 3 visitas **no** se promueven solos. — *Req 11.7*
- [ ] 7.13 **SIM → NC es manual:** cuatro asistencias de un SIM. Debe seguir SIM. — *Req 4.3*

## 8. Pendientes con el owner

- [ ] 8.1 **Confirmar RE → CRE con 2 visitas.** `criterios.md` define la salida de RE solo vía discipulado (Módulo 4). Sin esta regla, un reconciliado queda en RE para siempre. — *Req 7*
- [ ] 8.2 **Confirmar el riesgo de los menores en NC.** Está aceptado, pero conviene que quede claro que el número de NC va a incluir niños que llevan años viniendo. Los dashboards lo separan. — *Req 5.4*
- [ ] 8.3 **Pedir los 52 nombres de tema** por libro (ver [04-reporte-cdp](../04-reporte-cdp/tasks.md)). — *04-reporte Req 4.3*

## Dependencias

- [03-estructura](../03-estructura/): `casa_de_paz_membresia`.
- [04-reporte-cdp](../04-reporte-cdp/): `casa_de_paz_asistencia` y `casa_de_paz_reporte`. **Sin la lista de asistencia por persona, nada de esta área funciona.**

## Bloquea a

[09-dashboards](../09-dashboards/) — los estados y las alertas se muestran ahí.
[10-panel-supervisor](../10-panel-supervisor/) — el panel edita `criterio_valor`.
