# Tareas — Evangelismo de Casa de Paz

## 1. Registro

- [ ] 1.1 Crear `escala_evangelismo_enum` con los **cuatro** valores, aunque solo uno sea usable hoy. — *Req 1.2*
- [ ] 1.2 Crear `evangelismo` con los tres `CHECK`. — *Req 1.1, 1.5, 1.8*
- [ ] 1.3 Crear `chk_evangelismo_solo_cdp_modulo1`. Documentar que el Módulo 2 la elimina con `DROP CONSTRAINT`. — *Req 1.3, 1.4*
- [ ] 1.4 Crear `uq_evangelismo_persona_cdp_fecha`. — *Req 1.9*
- [ ] 1.5 Crear `idx_evangelismo_cdp_fecha`. — *Rendimiento*
- [ ] 1.6 Crear `fn_evangelismo_crear_persona()` y su disparador. — *Req 2.2, 2.5*
- [ ] 1.7 Verificar que evangelizar a un CRE **no** lo devuelve a SIM. — *Req 2.4*
- [ ] 1.8 Verificar que registrar con `escala = 'RED'` falla. — *Req 1.4*
- [ ] 1.9 Confirmar que **no** existe columna de teléfono: va por `telefono_asignacion.persona_id`. Cierra el pendiente de `software/pendientes.md`. — *Req 1.7*
- [ ] 1.10 Aplicar el bloque estándar de Fundación. — *00-fundacion*

## 2. Metas

- [ ] 2.1 Habilitar la extensión: `CREATE EXTENSION IF NOT EXISTS btree_gist`. Sin esto, la restricción de exclusión no se puede crear. — *Req 4.9*
- [ ] 2.2 Agregar `casa_de_paz.meta_evangelismo INTEGER` nulable con `chk_meta_propia_positiva`. — *Req 3.1, 3.2, 3.4*
- [ ] 2.3 Crear `meta_evangelismo_asignada`. — *Req 4.1, 4.2, 4.3*
- [ ] 2.4 Crear `chk_meta_asignada_fechas`. — *Req 4.4*
- [ ] 2.5 Crear `excl_meta_asignada_solapada` con `EXCLUDE USING gist` y `daterange(..., '[]')`. — *Req 4.8, 4.9*
- [ ] 2.6 Verificar que dos metas con períodos solapados fallan. — *Req 4.9*
- [ ] 2.7 Verificar que dos metas con períodos contiguos pero no solapados se aceptan. — *Req 4.8*
- [ ] 2.8 Verificar que una meta que empieza el mismo día que termina otra **falla**: `'[]'` incluye ambos extremos. — *Req 4.9*

## 3. Permisos

- [ ] 3.1 Crear `fn_es_rol_superior_de_cdp(uuid)`. — *Req 4.5*
- [ ] 3.2 Crear `pol_meta_asignada_select` (amplia: el líder ve su meta). — *Req 4.10*
- [ ] 3.3 Crear `pol_meta_asignada_insert` (solo roles superiores). — *Req 4.5, 4.6*
- [ ] 3.4 Crear la política de `UPDATE` para el asignador y los roles superiores. — *Req 4.11*
- [x] 3.5 Crear la política de `casa_de_paz.meta_evangelismo`: la fija el líder de esa CdP o un rol superior. **Hecho 2026-07-18** (`24_permisos_meta_propia.sql`): `casa_de_paz` tenía la política `UPDATE` genérica de `16_rls.sql` (cualquiera con acceso a la iglesia podía escribir), encontrado al construir el frontend. — *Req 3.3, 3.5*
- [ ] 3.6 Verificar que el sublíder lee la meta propia y no la edita. — *Req 3.6*
- [ ] 3.7 Verificar que un líder de CdP no puede asignarse una meta asignada a sí mismo. — *Req 4.6*
- [ ] 3.8 Verificar que un líder de CdP que además es líder de esa red **sí** puede. Es un rol superior real. — *Req 4.5*

## 4. Meta efectiva y tasa

- [ ] 4.1 Crear `fn_meta_efectiva(uuid, date)` con el `NOT EXISTS` de prioridad. — *Req 5.1, 5.2, 5.8*
- [ ] 4.2 Verificar que con meta propia y asignada vigente, devuelve la asignada con `origen = 'ASIGNADA'`. — *Req 5.2*
- [ ] 4.3 Verificar que sin asignada vigente devuelve la propia con `origen = 'PROPIA'`. — *Req 5.1*
- [ ] 4.4 Verificar que sin ninguna devuelve cero filas. — *Req 5.3*
- [ ] 4.5 Crear `fn_tasa_evangelismo(uuid, date, date)`. — *Req 5.4, 5.7*
- [ ] 4.6 Verificar que sin meta devuelve los evangelizados y `tasa = NULL`, **no** cero filas. — *Req 5.5*
- [ ] 4.7 Verificar que con `meta = 0` devuelve `tasa = NULL` y **no** lanza división por cero. — *Req 5.5*
- [ ] 4.8 Verificar que la tasa puede pasar de 100. — *Req 5.6*
- [ ] 4.9 Verificar que la tasa redondea a 2 decimales. — *Req 5.4*

## 5. Integración con el reporte

- [ ] 5.1 Crear la vista `v_reporte_evangelismo` de [04-reporte-cdp](../04-reporte-cdp/tasks.md#5-evangelizados). — *Req 6.2, 6.3*
- [ ] 5.2 Verificar que declarar 8 y registrar 2 da `diferencia = 6`. — *Req 6.3*

## 6. Alineación con el frontend

- [ ] 6.1 Documentar el mapeo de campos: `created_at` → `fecha_creacion`, `deleted_at` → `fecha_eliminacion`, etc. — *Riesgo*
- [ ] 6.2 Crear `fn_mi_rol_operativo(uuid)` para el `RoleGuard` del front. — *Riesgo*
- [ ] 6.3 **Decidir:** `SUPERVISOR_VISION` (nuestro catálogo) vs `SUPERVISOR_VISION_ACCION` (el front). Renombrar uno de los dos. — *Riesgo*
- [ ] 6.4 Verificar que `casa_de_paz.meta_evangelismo` es `INTEGER` nulable con defecto nulo, tal como pide `iu/meta-evangelismo-kpi/requirements.md`. — *Req 3.1, 3.2*
- [ ] 6.5 Confirmar que la tabla se llama `meta_evangelismo_asignada`, como el front espera. — *Req 4.1*

## 7. Verificación

- [ ] 7.1 Registrar un evangelizado y confirmar que la persona nace en `SIM`. — *Req 2.2*
- [ ] 7.2 Registrar dos veces la misma persona, misma CdP, misma fecha. El segundo debe fallar. — *Req 1.9*
- [ ] 7.3 Con el JWT del líder de red, asignar una meta a una CdP de su red. Debe funcionar. Con el de otra red, debe fallar. — *Req 4.5*
- [ ] 7.4 **Prueba de que el rol operativo no autoriza:** con el JWT de un líder de CdP, forzar en el cliente el rol `PASTOR` y pedir datos de otra CdP. RLS debe bloquear igual. — *Riesgo*
- [ ] 7.5 Con fecha futura. Debe fallar. — *Req 1.8*
- [ ] 7.6 Evangelizar a una persona de otra iglesia. Debe fallar con `EVANGELISMO_IGLESIA_DISTINTA`. — *Req 2.5*

## Dependencias

- [02-persona-parentela](../02-persona-parentela/), [03-estructura](../03-estructura/), [05-estados-ssva](../05-estados-ssva/) (`fn_transicionar_estado`).

## Bloquea a

[04-reporte-cdp](../04-reporte-cdp/) tarea 5.1 — la vista de evangelizados declarados vs registrados.
[09-dashboards](../09-dashboards/) — los KPI de evangelismo.
