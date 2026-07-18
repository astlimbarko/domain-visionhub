# Tareas — Calendario y Eventos

## 1. Tipos de evento

- [ ] 1.1 Crear `tipo_evento` con `iglesia_id` nulable y `chk_tipo_evento_color`. — *Req 1.2, 1.3, 1.6*
- [ ] 1.2 Crear `uq_tipo_evento_codigo`. — *Req 1.5*
- [ ] 1.3 Sembrar los 8 tipos como globales (`iglesia_id = NULL`). — *Req 1.1*
- [ ] 1.4 **Pedir al owner** el significado de RMS, AVIVATE, HOMBRES, DEBORAS y MOS. No están en `domain_knowledge`; salen del front. Llenar `descripcion` y sumarlos al glosario. — *Req 1.2*
- [ ] 1.5 **Tomar los colores del front ya construido** para que coincidan. Los del diseño son provisionales. — *Req 1.2*
- [ ] 1.6 Confirmar que `icono` guarda la ruta al PNG, no el binario. Los archivos van a Supabase Storage. — *Req 1.4*
- [ ] 1.7 Aplicar la regla de catálogo en uso (no se borra si está referenciado). — *Req 1.7*
- [ ] 1.8 Verificar que `color = 'rojo'` falla. — *Req 1.3*

## 2. Eventos

- [ ] 2.1 Crear `evento` con los tres `CHECK`. — *Req 2.1, 2.2, 2.3*
- [ ] 2.2 Crear `chk_evento_fechas`. — *Req 2.4*
- [ ] 2.3 Crear `chk_evento_horas` usando `IS DISTINCT FROM`. **No usar `<>`**: con `fecha_fin` nula, `<>` da `NULL` y el `CHECK` pasa por accidente. — *Req 2.5, 2.6*
- [ ] 2.4 Crear `chk_evento_ambito` (CdP o Red, exactamente uno). — *Req 5.4*
- [ ] 2.5 Crear `idx_evento_cdp_fecha` e `idx_evento_red_fecha`. — *Rendimiento*
- [ ] 2.6 Verificar que un retiro del viernes 18:00 al domingo 12:00 **se acepta**. Es el caso que rompe la validación ingenua de horas. — *Req 2.6*
- [ ] 2.7 Verificar que un evento de un día con `hora_fin < hora_inicio` **falla**. — *Req 2.5*
- [ ] 2.8 Verificar que `fecha_fin < fecha_inicio` falla. — *Req 2.4*
- [ ] 2.9 Verificar que se puede crear un evento con fecha pasada. — *Req 2.7*
- [ ] 2.10 Aplicar el bloque estándar de Fundación. — *00-fundacion*

## 3. Consulta por rango

- [ ] 3.1 Crear `fn_eventos_cdp(uuid, date, date, uuid)`. — *Req 3.1, 3.3, 3.4*
- [ ] 3.2 Usar `daterange && daterange` para la intersección. **No filtrar por `fecha_inicio BETWEEN`**: perdería los eventos que empiezan antes del rango. — *Req 3.2*
- [ ] 3.3 Verificar los cinco casos de intersección: evento dentro, que empieza antes, que termina después, que envuelve el rango, que coincide. — *Req 3.2*
- [ ] 3.4 Verificar `ORDER BY fecha_inicio, hora_inicio NULLS LAST`. — *Req 3.5*
- [ ] 3.5 Verificar que filtrar por tipo funciona y que `NULL` devuelve todos. — *Req 3.4*
- [ ] 3.6 Crear las funciones equivalentes de Red e Iglesia para los roles superiores. — *Req 3.3*

## 4. Cumpleaños

- [ ] 4.1 Crear `fn_cumpleanos_cdp(uuid, date, date)`. — *Req 4.1, 4.3*
- [ ] 4.2 Verificar que **no** se almacenan como filas de `evento`. — *Req 4.2*
- [ ] 4.3 Verificar que las personas sin `fecha_nacimiento` quedan fuera. — *Req 4.5*
- [ ] 4.4 Verificar un rango que cruza el 31/12: `generate_series` debe tocar dos años. — *Req 4.4*
- [ ] 4.5 **Verificar el 29 de febrero en un año no bisiesto** (por ejemplo 2027). Sin el `CASE`, `make_date` lanza excepción y tumba el calendario entero por una sola persona. — *Req 4.7*
- [ ] 4.6 Verificar que `edad_cumple` es la edad que cumple, no la que tiene. — *Req 4.6*
- [ ] 4.7 Verificar la regla de bisiesto completa: 2100 no es bisiesto. — *Req 4.7*

## 5. Mega Fiesta

- [ ] 5.1 Crear `fn_es_lider_de_red(uuid)`. — *Req 5.1*
- [ ] 5.2 Crear `fn_puede_crear_evento(uuid, uuid)` reutilizando `fn_puede_reportar_cdp`. — *Req 2.8, 5.1*
- [ ] 5.3 Verificar que un líder de CdP no puede crear `MEGA_FIESTA`. — *Req 5.2*
- [ ] 5.4 Verificar que un líder de red sí. — *Req 5.1*
- [ ] 5.5 Verificar que la Mega Fiesta aparece en el calendario de todas las CdP de esa red. — *Req 5.3*
- [ ] 5.6 Verificar que se crea con `red_id` y `casa_de_paz_id = NULL`. — *Req 5.4*

## 6. Notificaciones

- [ ] 6.1 Agregar `DIAS_AVISO_EVENTO` a `criterio_definicion` (defecto 7, rango 1 a 90). — *Req 6.2*
- [ ] 6.2 Crear `fn_proximos_cdp(uuid)`. — *Req 6.1, 6.3*
- [ ] 6.3 Verificar que **no** se envía ningún correo ni mensaje: el Módulo 1 solo expone la consulta. — *Req 6.5*
- [ ] 6.4 Conectar la configuración de notificaciones por rol al panel del Supervisor. — *Req 6.4*

## 7. Permisos

- [ ] 7.1 Crear `pol_evento_insert` con las dos ramas (CdP y Red). — *Req 2.8, 2.9, 5.1*
- [ ] 7.2 Crear `pol_evento_select` con el alcance de `fn_mis_iglesias()`. — *Req 3.1*
- [ ] 7.3 Crear `pol_evento_update` para el líder de la CdP y los roles superiores. — *Req 2.10*
- [ ] 7.4 Con el JWT del líder de la CdP A, crear un evento de la CdP B. Debe fallar. — *Req 2.9*
- [ ] 7.5 Ejecutar la auditoría de RLS. Cero filas. — *01-tenancy Req 4.7*

## Dependencias

- [02-persona-parentela](../02-persona-parentela/) (`fecha_nacimiento`, `fn_nombre_completo`), [03-estructura](../03-estructura/), [04-reporte-cdp](../04-reporte-cdp/) (`fn_puede_reportar_cdp`), [05-estados-ssva](../05-estados-ssva/) (`fn_criterio`), [06-evangelismo-cdp](../06-evangelismo-cdp/) (`fn_es_rol_superior_de_cdp`).

## Bloquea a

[09-dashboards](../09-dashboards/) — el calendario y los próximos eventos.
