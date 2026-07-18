# Tareas — Reporte de Casa de Paz

## 1. Libros y temas

- [ ] 1.1 Crear `cdp_libro` con `chk_libro_numero` (1 a 7). — *Req 4.1*
- [ ] 1.2 Sembrar los 7 libros. — *Req 4.1*
- [ ] 1.3 Crear `cdp_tema` con `iglesia_id` nulable y `chk_tema_numero`. — *Req 4.2, 4.3, 4.5*
- [ ] 1.4 **Pedir al owner** el índice de temas de los 7 tomos de "52 Lecciones de Vida". No están en `domain_knowledge`. — *Req 4.3*
- [ ] 1.5 Mientras tanto, sembrar 52 temas por libro con nombre provisional "Libro N — Tema M". — *Req 4.3*
- [ ] 1.6 Crear un tema especial por libro con `es_especial = true` y `numero = NULL`. — *Req 4.5*
- [ ] 1.7 Permitir al Supervisor crear temas con `iglesia_id` = su iglesia. — *Req 4.4*

## 2. Reporte

- [ ] 2.1 Crear `casa_de_paz_reporte` con los cuatro `CHECK`. — *Req 1.1, 1.2, 1.4, 5.5*
- [ ] 2.2 Crear `semana_inicio` (columna generada, lunes ISO de `fecha_reunion`) y `uq_reporte_cdp_semana` sobre `(casa_de_paz_id, semana_inicio)` — la unicidad es por semana, no por fecha exacta. — *Req 1.3*
- [ ] 2.3 Crear `idx_reporte_cdp_fecha` (`casa_de_paz_id, fecha_reunion DESC`). — *Rendimiento*
- [ ] 2.4 Crear `fn_validar_tema_libro()` y su disparador. — *Req 4.7*
- [ ] 2.5 Verificar que `libro_id`, `tema_id` y `disertador_id` son nulables: la obligatoriedad la define el panel, no el esquema. — *Req 1.8*
- [ ] 2.6 Verificar que declarar evangelizados con `salio_evangelizar = false` falla. — *Req 5.5*
- [ ] 2.7 Aplicar el bloque estándar de Fundación. — *00-fundacion*

## 3. Asistencia

- [ ] 3.1 Crear `casa_de_paz_asistencia` con `es_visita` y `es_menor` nulable. — *Req 2.1*
- [ ] 3.2 Crear `uq_asistencia_reporte_persona`. — *Req 2.2*
- [ ] 3.3 Crear `idx_asistencia_persona`. **Crítico**: las reglas de estado consultan las últimas N asistencias de una persona en cada evaluación. — *Rendimiento*
- [ ] 3.4 Crear `fn_validar_asistencia()` y su disparador. — *Req 2.7, 2.8, 3.5*
- [ ] 3.5 Verificar que `es_visita` se calcula y **no** se acepta del cliente. — *Req 2.7*
- [ ] 3.6 Verificar que una persona sin `fecha_nacimiento` y sin `es_menor` falla con `ASISTENCIA_EDAD_INDEFINIDA`. — *Req 3.5*
- [ ] 3.7 Verificar que no existen filas de ausentes: la ausencia es la falta de fila. — *Req 2.9*
- [ ] 3.8 Crear el endpoint de alta rápida: `primer_nombre`, `primer_apellido`, `sexo` y nada más. — *Req 2.5, 2.6*

## 4. Totales

- [ ] 4.1 Crear `fn_asistencia_es_menor(uuid)`. — *Req 3.3, 3.4, 3.6, 3.7*
- [ ] 4.2 Verificar que la edad se calcula a la `fecha_reunion` y no a hoy. — *Req 3.3*
- [ ] 4.3 Verificar que la frontera sale de `fn_criterio(iglesia_id, 'EDAD_MINIMA_CREYENTE')` y no de un `12` literal. — *Req 3.7*
- [ ] 4.4 Crear la vista `v_reporte_totales` con `LEFT JOIN`. — *Req 3.1*
- [ ] 4.5 Verificar que un reporte sin asistentes aparece con ceros, no desaparece. — *Req 3.1*
- [ ] 4.6 Verificar que **no** existen columnas `total_menores` / `total_mayores` en la tabla. — *Req 3.2*

## 5. Evangelizados

- [ ] 5.1 Crear la vista `v_reporte_evangelismo` con declarados, registrados y diferencia. — *Req 5.1, 5.2, 5.3*
- [ ] 5.2 Conectar `diferencia <> 0` a la alerta del Supervisor. — *Req 5.4*
- [ ] 5.3 Verificar que ninguno de los dos sobrescribe al otro. — *Req 5.3*

> Depende de la tabla `evangelismo` de [06-evangelismo-cdp](../06-evangelismo-cdp/). Crear la vista después de esa área.

## 6. Reportes faltantes

- [ ] 6.1 Crear `fn_cdp_sin_reporte(uuid, date)`. — *Req 7.1, 7.4*
- [ ] 6.2 Verificar que `date_trunc('week', ...)` devuelve lunes. — *Req 7.2*
- [ ] 6.3 Verificar que las CdP inactivas quedan fuera. — *Req 7.3*

## 7. Permisos

- [ ] 7.1 Crear `fn_puede_reportar_cdp(uuid)`. — *Req 1.5, 1.6*
- [ ] 7.2 Crear `fn_es_lider_cdp(uuid)` y `fn_es_sublider_cdp(uuid)`. — *Req 6.1, 6.2*
- [ ] 7.3 Crear `pol_reporte_select` (amplia: líder de red y supervisor leen todo su alcance). — *Req 1.7*
- [ ] 7.4 Crear `pol_reporte_insert` (estrecha: solo líder o sublíder de esa CdP, o admin). — *Req 1.5, 1.6*
- [ ] 7.5 Crear `pol_reporte_update` con la condición configurable del sublíder. — *Req 6.1, 6.2, 6.5*
- [ ] 7.6 Aplicar RLS a `casa_de_paz_asistencia`, heredando el alcance del reporte. — *01-tenancy Req 4.1*

## 8. Verificación

- [ ] 8.1 Con el JWT del líder de la CdP A, crear un reporte de la CdP B. Debe fallar. — *Req 1.6*
- [ ] 8.2 Con el JWT del sublíder, crear un reporte de su CdP. Debe funcionar. — *Req 1.5*
- [ ] 8.3 Con el JWT del sublíder y `SUBLIDER_PUEDE_EDITAR_REPORTE = false`, editar un reporte enviado. Debe fallar. — *Req 6.2*
- [ ] 8.4 Activar el criterio y repetir. Debe funcionar. — *Req 6.2*
- [ ] 8.5 Crear dos reportes de la misma CdP en la misma semana con **fechas distintas** (ej. lunes y miércoles). El segundo debe fallar igual — la unicidad es por semana. — *Req 1.3*
- [ ] 8.6 Marcar 5 asistentes (2 menores por fecha de nacimiento, 1 menor por `es_menor`, 2 mayores) y verificar que `v_reporte_totales` da 3 y 2. — *Req 3.1, 3.3, 3.4*
- [ ] 8.7 Declarar 8 evangelizados y registrar 2. Verificar que `diferencia = 6` y que aparece en la alerta. — *Req 5.4*
- [ ] 8.8 Crear un reporte con fecha futura. Debe fallar. — *Req 1.4*

## Dependencias

- [00-fundacion](../00-fundacion/), [01-tenancy-iglesias](../01-tenancy-iglesias/), [02-persona-parentela](../02-persona-parentela/), [03-estructura](../03-estructura/).
- `fn_criterio()` de [10-panel-supervisor](../10-panel-supervisor/) para `EDAD_MINIMA_CREYENTE`.
- `evangelismo` de [06-evangelismo-cdp](../06-evangelismo-cdp/) para la vista de la tarea 5.1.

## Bloquea a

[05-estados-ssva](../05-estados-ssva/) — las transiciones se calculan sobre `casa_de_paz_asistencia`.
[08-finanzas-cdp](../08-finanzas-cdp/) — los ingresos se registran contra el reporte.
[09-dashboards](../09-dashboards/) — casi todo sale de aquí.
