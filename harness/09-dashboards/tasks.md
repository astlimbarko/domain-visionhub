# Tareas — Dashboards

## 1. Funciones auxiliares

- [ ] 1.1 Crear `fn_kpi_miembros_activos(uuid, date)`. — *Req 2.1, 2.2*
- [ ] 1.2 Crear `fn_kpi_asistencia_ultima(uuid)` con `variacion_pct`. — *Req 2.1, 2.2*
- [ ] 1.3 Verificar que `variacion_pct` es `NULL` cuando el anterior es cero. — *Req 7.5*
- [ ] 1.4 Crear `fn_lista_miembros_cdp(uuid)` con el semáforo. — *Req 2.4*
- [ ] 1.5 Crear `fn_reconciliados_cdp(uuid)` — personas en estado `RE`. — *05-estados Req 6.8*
- [ ] 1.6 Crear `fn_simpatizantes_cdp(uuid)` — personas en `SIM` que no avanzan. — *05-estados Req 4.5*
- [ ] 1.7 Crear `fn_conteo_estados(uuid)` con `es_menor` en el `GROUP BY`. — *Req 8.3, 8.4*
- [ ] 1.8 Verificar que **no** hay forma de pedir "cuántos NC" y recibir un solo número. — *Req 8.4*
- [ ] 1.9 **Confirmar con el owner** los umbrales del semáforo (2 semanas amarillo, 4 rojo). `dashboards/lider-cdp.md` no los define. — *Req 2.4*

## 2. Dashboard del Líder de CdP

- [ ] 2.1 Crear `fn_dashboard_lider_cdp(uuid, date)`. — *Req 2*
- [ ] 2.2 Agregar la verificación de acceso como **primera línea**. — *Req 1.1, 1.2*
- [ ] 2.3 Verificar que el histórico usa las últimas 8 **reuniones reportadas**, no las últimas 8 semanas. — *Req 2.3, 2.7*
- [ ] 2.4 Verificar que los ingresos del mes vienen desglosados por tipo y moneda. — *Req 2.5, 7.4*
- [ ] 2.5 Verificar que responde con una sola llamada. — *Req 7.3*

## 3. Dashboard del Sublíder

- [ ] 3.1 Crear `fn_dashboard_sublider_cdp(uuid, date)`, que filtra secciones por configuración. — *Req 3.1, 3.4*
- [ ] 3.2 Sembrar los defectos: reporte, asistencia y miembros visibles; ofrendas, gráficos e historial ocultos. — *Req 3.2, 3.3*
- [ ] 3.3 **Prueba clave:** con `SUBLIDER_VE_OFRENDAS = false`, llamar a la RPC del sublíder por curl directo. El JSON **no** debe contener montos. Si los trae y el front los oculta, el Requisito 3.5 no se cumple. — *Req 3.5*
- [ ] 3.4 Verificar que el sublíder no puede editar la lista de miembros. — *Req 3.6*

## 4. Dashboard del Líder de Red

- [ ] 4.1 Crear `fn_dashboard_lider_red(uuid, date)`. — *Req 4*
- [ ] 4.2 Verificar la asistencia promedio y que **no** divide por cero sin reuniones. — *Req 4.6*
- [ ] 4.3 Crear el ranking de CdP por asistencia. — *Req 4.3*
- [ ] 4.4 Conectar `fn_cdp_sin_reporte` filtrada por red. — *Req 4.4*
- [ ] 4.5 Verificar el desglose de ingresos por CdP, tipo y moneda. — *Req 4.5*

## 5. Dashboard del Supervisor

- [ ] 5.1 Crear `fn_dashboard_supervisor(uuid, date)`. — *Req 5*
- [ ] 5.2 Crear `fn_alertas_supervisor(uuid)` con las seis alertas. — *Req 5.5 a 5.10*
- [ ] 5.3 Verificar que las alertas **no** se pueden descartar: no existe tabla de "alerta leída". — *Req 5.11*
- [ ] 5.4 Verificar `cdp_sin_red`: cubre el hueco que el índice parcial de [03-estructura](../03-estructura/) no cierra (impide dos redes, no cero). — *Req 5.9*
- [ ] 5.5 Verificar que los departamentos desactivados no aparecen. — *Req 5.4*
- [ ] 5.6 Verificar que una red sin encargados aparece y sigue apareciendo hasta que se designen. — *Req 5.6*

## 6. Dashboard del Pastor

- [ ] 6.1 Crear `fn_dashboard_pastor(date)`. — *Req 6*
- [ ] 6.2 Verificar que usa `fn_mis_iglesias()` como filtro y devuelve listas vacías, no error, para quien no tiene iglesias. — *Req 1.5*
- [ ] 6.3 Verificar que los ingresos vienen agrupados por moneda y **nunca** como un total único. — *Req 6.6*
- [ ] 6.4 Verificar el selector de iglesias vía `fn_mis_iglesias_detalle()`. — *Req 6.1*
- [ ] 6.5 Verificar que se puede descender de iglesia a redes y de red a CdP. — *Req 6.7*
- [ ] 6.6 **Confirmar con el owner:** `dashboards/pastor.md` pide "ofrendas totales" como un número. Con dos monedas eso no existe. Hoy ambas iglesias usan BOB, así que el front puede mostrar un número mientras venga una sola fila de moneda. — *Req 6.6*

## 7. Auditoría de seguridad

**Es el punto más importante del área.** Toda función de dashboard es `SECURITY DEFINER` y por lo tanto **salta RLS**.

- [ ] 7.1 Listar todas las funciones `SECURITY DEFINER` del esquema:
      ```sql
      SELECT proname, prosecdef FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND prosecdef;
      ```
      — *Req 1.1*
- [ ] 7.2 Verificar una por una que las que reciben un UUID de ámbito (`iglesia_id`, `casa_de_paz_id`, `red_id`) verifican el acceso en su primera línea. — *Req 1.1*
- [ ] 7.3 Verificar que todas tienen `SET search_path = public`. — *00-fundacion*
- [ ] 7.4 **Prueba de fuego:** con el JWT del líder de una CdP de Montero, llamar a `fn_dashboard_lider_cdp` con el UUID de una CdP de Santa Cruz. Debe fallar con `DASHBOARD_FUERA_DE_ALCANCE`. Si devuelve datos, hay una fuga de datos entre iglesias. — *Req 1.1, 1.2*
- [ ] 7.5 Repetir con `fn_dashboard_supervisor`, `fn_dashboard_lider_red` y `fn_alertas_supervisor`. — *Req 1.3, 1.4*

## 8. Rendimiento

- [ ] 8.1 Cargar datos de prueba: 2 iglesias, 6 redes, 30 CdP, 3.000 personas, 52 semanas de reportes. — *Req 7.6*
- [ ] 8.2 Medir cada RPC de dashboard con `EXPLAIN ANALYZE`. Objetivo: menos de 2 segundos. — *Req 7.6*
- [ ] 8.3 Verificar que `fn_mis_iglesias()` aparece como InitPlan y no se evalúa por fila. — *01-tenancy*
- [ ] 8.4 Si `fn_dashboard_supervisor` pasa de 2 segundos, evaluar materializar `v_reporte_totales`. **No optimizar antes de medir.** — *Req 7.6*
- [ ] 8.5 Revisar el N+1 de `fn_alertas_supervisor` (llama a `fn_inactividad_cdp` por CdP). Si molesta, reescribir agregado. — *Riesgo*

## 9. Verificación funcional

- [ ] 9.2 Con el JWT del pastor, confirmar que ve las dos iglesias. — *Req 1.5*
- [ ] 9.3 Con el JWT de un líder de red, confirmar que solo ve las CdP de su red. — *Req 1.3*
- [ ] 9.4 Auditar los nombres de campo: ninguno se llama `miembros` a secas. — *Req 8.1, 8.2*
- [ ] 9.5 Auditar el JSON de todas las RPC: todo monto viene con su moneda. — *Req 7.4*
- [ ] 9.6 Auditar el front cuando se conecte: ningún KPI se calcula en el cliente. — *Req 7.1, 7.2*

## Dependencias

Todas las áreas anteriores. Es la última capa de lectura.

## Bloquea a

La conexión del frontend.
