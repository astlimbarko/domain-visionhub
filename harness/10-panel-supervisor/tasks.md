# Tareas — Panel del Supervisor

> **Importante:** este área implementa el motor único de configuración. **No crear** las tablas `criterio_definicion` / `criterio_valor` que describe [05-estados-ssva](../05-estados-ssva/design.md): son el mismo motor. Ese documento las explica en su contexto; la implementación es una sola.

## 1. Motor

- [ ] 1.1 Crear `tipo_configuracion_enum` con `BOOLEANO`, `NUMERICO`, `TEXTO`. — *Req 2.4*
- [ ] 1.2 Crear `configuracion_definicion` con `descripcion NOT NULL`, `valor_min`, `valor_max`, `categoria` y `modulo`. — *Req 2.1, 2.2, 3.3*
- [ ] 1.3 Crear `configuracion_valor` con `uq_configuracion_valor`. — *Req 2.2*
- [ ] 1.4 Aplicar el bloque estándar de Fundación. — *00-fundacion*
- [ ] 1.5 Verificar que `creado_por` / `actualizado_por` responden quién cambió cada configuración. — *Req 1.6*

## 2. Lectura

- [ ] 2.1 Crear `fn_config_raw(uuid, varchar)` con `COALESCE` al valor por defecto. — *Req 2.3*
- [ ] 2.2 Crear `fn_config_bool(uuid, varchar)` que devuelve `false` ante código inexistente. **Valor seguro**: un typo debe cerrar el acceso, no abrirlo. — *Req 2.7*
- [ ] 2.3 Crear `fn_config_num(uuid, varchar)` **sin** `COALESCE`. Un código inexistente debe explotar: un criterio que devuelve cero en silencio promovería a todos. — *Req 2.7*
- [ ] 2.4 Crear `fn_config_txt(uuid, varchar)`. — *Req 2.7*
- [ ] 2.5 Crear `fn_criterio(uuid, varchar)` como alias de `fn_config_num`. — *05-estados Req 11.2*
- [ ] 2.6 Verificar que una iglesia sin filas en `configuracion_valor` devuelve todos los valores por defecto. — *Req 2.3*

## 3. Validación

- [ ] 3.1 Crear `fn_validar_configuracion()` con las cuatro validaciones. — *Req 1.1, 1.5, 2.5, 2.6*
- [ ] 3.2 Crear el disparador sobre `configuracion_valor`. — *Req 2.5*
- [ ] 3.3 Verificar que un booleano con valor `"si"` falla con `CONFIG_TIPO_INVALIDO`. — *Req 2.5*
- [ ] 3.4 Verificar que un numérico con valor `"abc"` falla con `CONFIG_TIPO_INVALIDO` y **no** con el error crudo de PostgreSQL. — *Req 2.5*
- [ ] 3.5 Verificar que un valor fuera de rango falla con `CONFIG_FUERA_DE_RANGO`. — *Req 2.6*
- [ ] 3.6 Verificar que un no-admin falla con `CONFIG_SIN_PERMISO`. — *Req 1.2*
- [ ] 3.7 Verificar que configurar una iglesia fuera del alcance falla con `CONFIG_FUERA_DE_ALCANCE`. — *Req 1.5*

## 4. Semilla

- [ ] 4.1 Sembrar los 8 criterios de CdP y SSVA, con `categoria` `CDP` o `SSVA`. — *Req 3.1, 4.1*
- [ ] 4.2 Sembrar `CLASES_PARA_DI` y `ASISTENCIAS_PARA_DA` con `modulo = 4`. — *Req 4.2*
- [ ] 4.3 Verificar que los criterios de módulo 4 **no** aparecen en el panel. — *Req 4.2*
- [ ] 4.4 Sembrar las 5 configuraciones del sublíder, todas en `false`. — *Req 5.2, 5.3*
- [ ] 4.5 Sembrar las 9 de formularios. — *Req 6.1, 6.2*
- [ ] 4.6 Sembrar `DIAS_AVISO_EVENTO`, `LIDER_VE_GRAFICOS`, `LIDER_RED_VE_COMPARATIVAS`. — *Req 5.4, 5.5, 10.2*
- [ ] 4.7 Verificar que toda definición tiene `descripcion` en español que explica qué hace. — *Req 3.3*

## 5. Formularios configurables

- [ ] 5.1 Crear `fn_validar_campos_reporte()` y su disparador sobre `casa_de_paz_reporte`. — *Req 6.3, 6.4*
- [ ] 5.2 Crear el equivalente para el formulario de membresía. — *Req 6.1, 6.3*
- [ ] 5.3 Verificar que los campos de texto se validan contra vacío, no solo contra nulo: `""` pasa un `NOT NULL` y no es un testimonio. — *Req 6.4*
- [ ] 5.4 Verificar que el mensaje de error nombra el campo. — *Req 6.4*
- [ ] 5.5 **Auditar:** toda perilla de obligatoriedad debe apuntar a una columna nulable. Una que apunte a un `NOT NULL` no hace nada y engaña. — *Req 6.5*
- [ ] 5.6 Crear `fn_config_formulario(uuid, varchar)` para el asterisco del front. — *Req 6.6*
- [ ] 5.7 Verificar que un campo oculto es siempre opcional. — *Req 6.7*

## 6. Panel

- [ ] 6.1 Crear `fn_panel_configuracion(uuid)`. — *Req 3.2, 4.4*
- [ ] 6.2 Agregar la verificación `fn_es_admin_en` como primera línea. — *Req 1.1, 1.3*
- [ ] 6.3 Verificar que devuelve valor actual, defecto, rango y descripción de cada perilla. — *Req 3.2, 3.3*
- [ ] 6.4 Verificar que `es_personalizado` distingue "cambiado" de "por defecto". — *Req 2.3*
- [ ] 6.5 Verificar que `advertencia` viaja en la respuesta y **no** está hardcodeada en el front. — *Req 3.4, 4.3, 9.3*
- [ ] 6.6 Verificar que las categorías vienen agrupadas. — *Req 4.4*

## 7. Catálogos y departamentos

- [ ] 7.1 Crear `pol_catalogo_update` con `iglesia_id IS NOT NULL` para cada catálogo editable. — *Req 8.2, 8.3*
- [ ] 7.2 Verificar que una fila global no se puede modificar desde la API, con ningún rol. — *Req 8.3*
- [ ] 7.3 **DECIDIR ANTES DE IMPLEMENTAR:** `cuenta_para_familia` está en `tipo_relacion`, que es un catálogo **global**. Si el Supervisor de Montero lo cambia, también cambia el conteo de familias de Santa Cruz. Dos salidas: (a) mover a `configuracion_valor` con un código por tipo — **recomendado**; (b) restringir a `SUPER_ADMIN` por ahora. — *Req 8.6, Riesgo*
- [ ] 7.4 Verificar que una fila de catálogo en uso no se puede borrar lógicamente. — *Req 8.4*
- [ ] 7.5 Verificar que sí se puede desactivar y que el histórico no se rompe. — *Req 8.5*
- [ ] 7.6 Permitir al Supervisor activar y desactivar departamentos. — *Req 7.1*
- [ ] 7.7 Verificar que un departamento desactivado conserva sus datos históricos. — *Req 7.3*
- [x] 7.7b **Corregido 2026-07-18** (`22_permisos_panel_supervisor.sql`): `departamento` e `iglesia_moneda` tenían la política RLS genérica de `16_rls.sql` (cualquier usuario con acceso a la iglesia podía escribir), no la de `fn_es_operativo_en`. Un `LIDER_CDP` común podía desactivar un departamento por la API REST directa sin pasar por el panel. — *Req 1.1, 1.2*
- [ ] 7.8 Permitir al Supervisor cambiar `iglesia.moneda_defecto`. — *Req 9.1*
- [ ] 7.9 Verificar que cambiar la moneda por defecto **no** toca los ingresos ya registrados. — *Req 9.2*

## 8. Verificación

- [ ] 8.1 **Prueba de punta a punta del sublíder:** con `SUBLIDER_VE_OFRENDAS = false`, pedir `/rest/v1/finanzas_ingreso` por curl con el JWT del sublíder. Debe devolver `[]`. Activarlo y repetir: debe devolver los ingresos. Es la prueba de que la configuración vive en la base y no en el front. — *Req 5.6*
- [ ] 8.2 Cambiar `VISITAS_PARA_CRE` y confirmar que la siguiente asistencia usa el valor nuevo. — *Req 2.8*
- [ ] 8.3 Verificar con `EXPLAIN ANALYZE` que `fn_config_bool` no se evalúa por fila en las políticas RLS. — *Riesgo*
- [ ] 8.4 Con el JWT del supervisor de Montero, cambiar una configuración de Santa Cruz. Debe fallar. — *Req 1.5*
- [ ] 8.5 Ejecutar la auditoría de RLS. Cero filas. — *01-tenancy Req 4.7*

## Dependencias

- [00-fundacion](../00-fundacion/), [01-tenancy-iglesias](../01-tenancy-iglesias/) (`fn_es_admin_en`, `fn_mis_iglesias`), [03-estructura](../03-estructura/) (`departamento`).

## Bloquea a

- [05-estados-ssva](../05-estados-ssva/) — `fn_criterio`.
- [04-reporte-cdp](../04-reporte-cdp/) — obligatoriedad de campos.
- [08-finanzas-cdp](../08-finanzas-cdp/) — `fn_config_bool` para `SUBLIDER_VE_OFRENDAS`.
- [09-dashboards](../09-dashboards/) — secciones configurables.

> Hay una dependencia circular con [05-estados-ssva](../05-estados-ssva/): `fn_criterio` vive aquí y se usa allá. **Implementar este motor primero**, antes que los disparadores de estados.
