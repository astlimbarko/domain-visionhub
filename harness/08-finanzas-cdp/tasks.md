# Tareas — Finanzas de Casa de Paz

## 1. Catálogo

- [ ] 1.1 Confirmar que `moneda_enum` existe (se crea en [01-tenancy](../01-tenancy-iglesias/tasks.md)). — *Req 3.2*
- [ ] 1.2 Crear `finanzas_tipo_ingreso` con `iglesia_id` nulable. — *Req 2.1, 2.3*
- [ ] 1.3 Crear `uq_tipo_ingreso_codigo`. — *Req 2.1*
- [ ] 1.4 Sembrar `OFRENDA`, `DIEZMO`, `PRIMICIA`, `PACTO` como globales. — *Req 2.2*
- [ ] 1.5 Aplicar la regla de catálogo en uso. — *Req 2.4*

## 2. Ingresos

- [ ] 2.1 Crear `finanzas_ingreso` con `monto NUMERIC(12,2)`. **No usar `FLOAT`**: el binario no representa decimales exactos y los totales dejan de cuadrar. — *Req 1.5*
- [ ] 2.2 Crear `chk_ingreso_monto` (`> 0`) y `chk_ingreso_fecha`. — *Req 1.4, 1.6*
- [ ] 2.3 Confirmar que `persona_id` es nulable. — *Req 1.3*
- [ ] 2.4 Crear `idx_ingreso_cdp_fecha` e `idx_ingreso_reporte`. — *Rendimiento*
- [ ] 2.5 Crear `fn_ingreso_moneda_defecto()` y su disparador. — *Req 3.3*
- [ ] 2.6 Crear el disparador que valida la iglesia de `persona_id`. — *Req 1.8*
- [ ] 2.7 Verificar que `monto = 0` falla. — *Req 1.4*
- [ ] 2.8 Verificar que `0.1 + 0.2` sobre `NUMERIC` da exactamente `0.3`. Es la prueba de que no se usó `FLOAT`. — *Req 1.5*
- [ ] 2.9 Aplicar el bloque estándar de Fundación. — *00-fundacion*

## 3. Moneda

- [ ] 3.1 Verificar que `iglesia.moneda_defecto` es `BOB` en las dos iglesias. — *Req 3.4*
- [ ] 3.2 Verificar que un ingreso sin moneda toma la de la iglesia. — *Req 3.3*
- [ ] 3.3 Verificar que se pueden registrar `BOB` y `USD` en el mismo reporte. — *Req 3.7*
- [ ] 3.4 Confirmar que **no** existe tabla de tipo de cambio ni función de conversión. — *Req 3.8*
- [ ] 3.5 **Auditar todas las funciones de total**: cada una debe tener `moneda` en el `GROUP BY` y en el retorno. Ninguna puede devolver un número sin moneda. — *Req 3.5, 3.6*

## 4. Reportes

- [ ] 4.1 Crear `fn_ingresos_cdp(uuid, date, date)`. — *Req 4.1, 4.2, 4.3*
- [ ] 4.2 Crear `fn_ingresos_red(uuid, date, date)`. — *Req 4.1*
- [ ] 4.3 Crear `fn_ingresos_iglesia(uuid, date, date)`. — *Req 4.1*
- [x] 4.4 Crear `fn_ingresos_comparativo(uuid, date, date)`. **Corregido 2026-07-18**: mismo bug de columna ambigua que `fn_eventos_cdp`/`fn_cumpleanos_cdp` (ver `11-esquema-bd/design.md` Riesgos) — la CTE `monedas` referenciaba `moneda_id` sin calificar, colisionando con la columna de salida del mismo nombre. Encontrado y verificado en navegador al construir el frontend de Finanzas. — *Req 4.4, 4.5*
- [ ] 4.5 Verificar que un período sin ingresos devuelve `0`, no cero filas. — *Req 4.6*
- [ ] 4.6 Verificar que con período anterior en cero, `variacion_pct` es `NULL` y **no** 100. — *Decisión de diseño*
- [ ] 4.7 Verificar que una moneda presente solo en un período aparece igual, con `0` en el otro. — *Req 4.6*

## 5. Integración con el reporte

- [ ] 5.1 Crear `fn_upsert_ingreso_reporte(...)`. — *Req 6.2, 6.3, 6.4, 6.5*
- [ ] 5.2 Crear `fn_registrar_ingresos_reporte(...)` con verificación de permiso. — *Req 6.1*
- [x] 5.2b **Agregado 2026-07-18**: `fn_registrar_ingresos_reporte` rechaza `p_total_ofrendas IS NULL` con `REPORTE_OFRENDAS_OBLIGATORIO`. `p_total_diezmos` sigue nulable. — *Req 6.7, 6.8*
- [ ] 5.3 Verificar que un total de `0` o nulo **no** crea ingreso. — *Req 6.4*
- [ ] 5.4 **Verificar el upsert:** registrar 500, corregir a 550, confirmar que hay **una** fila con 550 y no dos que suman 1.050. — *Req 6.5*
- [ ] 5.5 Verificar que poner el total en `0` después de haberlo cargado elimina lógicamente el ingreso. — *Req 6.4*
- [ ] 5.6 Crear `fn_reporte_cascada_ingresos()` y su disparador sobre `casa_de_paz_reporte`. — *Req 6.6*
- [ ] 5.7 Verificar que eliminar el reporte elimina sus ingresos. Es la única cascada del sistema. — *Req 6.6*

## 6. Visibilidad

- [ ] 6.1 Agregar `SUBLIDER_VE_OFRENDAS` a la configuración, con defecto `false`. — *Req 5.3*
- [ ] 6.2 Crear `fn_puede_ver_ingresos_cdp(uuid)`. — *Req 5.1, 5.2, 5.4, 5.5*
- [ ] 6.3 Crear `pol_ingreso_select` con la condición de visibilidad. — *Req 5.7*
- [ ] 6.4 Crear `pol_ingreso_insert` y `pol_ingreso_update` con `fn_puede_reportar_cdp`. No existe `fn_es_invitado_en` (retirada junto con el rol `INVITADO`, ver `01-tenancy-iglesias/design.md`); el Alcance ya lo resuelve `fn_puede_reportar_cdp` sola. — *Req 5.6*
- [ ] 6.5 **Prueba clave:** con `SUBLIDER_VE_OFRENDAS = false`, pedir `/rest/v1/finanzas_ingreso` con el JWT del sublíder por curl directo, sin pasar por el front. Debe devolver `[]`. Si devuelve datos, la restricción está solo en el frontend y el requisito 5.7 no se cumple. — *Req 5.7*
- [ ] 6.6 Activar el criterio y repetir. Debe devolver los ingresos. — *Req 5.2*
- [ ] 6.7 Con el JWT del líder de red, confirmar que ve los ingresos de todas las CdP de su red. — *Req 5.4*
- [ ] 6.8 Con el JWT de un rol sin `fn_puede_reportar_cdp` en esa CdP (por ejemplo un líder de otra CdP), intentar modificar un ingreso. Debe fallar. — *Req 5.6*
- [ ] 6.9 Ejecutar la auditoría de RLS. Cero filas. — *01-tenancy Req 4.7*

## Dependencias

- [01-tenancy-iglesias](../01-tenancy-iglesias/) (`moneda_enum`, `iglesia.moneda_defecto`), [03-estructura](../03-estructura/), [04-reporte-cdp](../04-reporte-cdp/) (`fn_puede_reportar_cdp`), [06-evangelismo-cdp](../06-evangelismo-cdp/) (`fn_es_rol_superior_de_cdp`), [10-panel-supervisor](../10-panel-supervisor/) (`fn_config_bool`).

## Bloquea a

[09-dashboards](../09-dashboards/) — los KPI y gráficos financieros de los cinco roles.
