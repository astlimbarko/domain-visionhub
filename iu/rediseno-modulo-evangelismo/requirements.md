# Documento de Requisitos

## Introducción

Este documento especifica los requisitos para el rediseño del módulo de Evangelismo. El rediseño introduce una distinción clara entre dos tipos de metas: la **meta propia** que el líder de Casa de Paz establece para sí mismo, y la **meta asignada** que cualquier rol superior en la jerarquía puede asignarle con un período de vigencia. La meta asignada tiene prioridad sobre la meta propia para el cálculo de la Tasa de Evangelismo. Los roles superiores pueden gestionar las metas asignadas a todas las Casas de Paz bajo su jerarquía.

## Glosario

- **Sistema**: El sistema VisionHub de gestión de Casas de Paz
- **Módulo_Evangelismo**: El módulo frontend que muestra estadísticas y KPIs de evangelismo
- **Casa_de_Paz**: Unidad organizacional base (CDP) liderada por un Líder_CDP
- **Líder_CDP**: Usuario con rol `LIDER_CDP`, responsable de una Casa de Paz
- **Rol_Superior**: Cualquier usuario con rol `SUBLIDER_RED`, `LIDER_RED`, `SUPERVISOR_VISION_ACCION` o `PASTOR`
- **Meta_Propia**: Meta de evangelismo establecida por el propio Líder_CDP para su Casa de Paz
- **Meta_Asignada**: Meta de evangelismo asignada a una Casa de Paz por un Rol_Superior, con período de vigencia
- **Meta_Vigente**: La Meta_Asignada activa en la fecha actual (dentro de su período de vigencia)
- **Meta_Efectiva**: La meta utilizada para calcular la Tasa_Evangelismo; es la Meta_Vigente si existe, de lo contrario es la Meta_Propia
- **Tasa_Evangelismo**: Porcentaje calculado como (evangelizados / Meta_Efectiva) × 100
- **Asignador**: El Rol_Superior que creó una Meta_Asignada
- **Backend_API**: El servicio backend NestJS
- **Base_de_Datos**: La base de datos PostgreSQL gestionada por Prisma ORM

## Requisitos

### Requisito 1: Esquema de Base de Datos para Meta Asignada

**Historia de Usuario:** Como administrador del sistema, quiero una tabla dedicada para las metas asignadas jerárquicamente, para que los datos estén correctamente estructurados y sean auditables.

#### Criterios de Aceptación

1. THE Base_de_Datos SHALL incluir una tabla `meta_evangelismo_asignada` con columnas: `id`, `casa_de_paz_id`, `asignador_usuario_id`, `meta`, `fecha_inicio`, `fecha_fin`, `observaciones`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`
2. THE Base_de_Datos SHALL establecer una relación de clave foránea desde `meta_evangelismo_asignada.casa_de_paz_id` hacia la tabla `casa_de_paz`
3. THE Base_de_Datos SHALL establecer una relación de clave foránea desde `meta_evangelismo_asignada.asignador_usuario_id` hacia la tabla `usuario`
4. THE `meta` field SHALL ser de tipo entero positivo y no nulo
5. THE `fecha_inicio` y `fecha_fin` fields SHALL ser de tipo fecha (sin hora) y no nulos
6. THE Base_de_Datos SHALL crear índices en `casa_de_paz_id`, `asignador_usuario_id`, `fecha_inicio` y `fecha_fin` para rendimiento de consultas
7. THE Base_de_Datos SHALL preservar el campo existente `meta_evangelismo` en la tabla `casa_de_paz` para la Meta_Propia

### Requisito 2: Asignar Meta Jerárquica

**Historia de Usuario:** Como rol superior en la jerarquía, quiero asignar una meta de evangelismo con período de vigencia a una Casa de Paz bajo mi jerarquía, para que el líder tenga un objetivo formal establecido por la organización.

#### Criterios de Aceptación

1. WHEN un Rol_Superior solicita asignar una Meta_Asignada a una Casa_de_Paz, THE Backend_API SHALL verificar que el Rol_Superior tiene autoridad jerárquica sobre esa Casa_de_Paz
2. WHEN un Rol_Superior proporciona una meta válida con `fecha_inicio` y `fecha_fin`, THE Backend_API SHALL crear un registro en `meta_evangelismo_asignada` con el `asignador_usuario_id` del usuario autenticado
3. IF la `fecha_fin` es anterior a la `fecha_inicio`, THEN THE Backend_API SHALL retornar un error descriptivo
4. IF la `meta` proporcionada es menor o igual a cero, THEN THE Backend_API SHALL retornar un error descriptivo
5. WHEN se crea una Meta_Asignada nueva para una Casa_de_Paz, THE Backend_API SHALL eliminar (soft delete) cualquier Meta_Asignada vigente anterior de esa Casa_de_Paz
6. THE Backend_API SHALL retornar la Meta_Asignada creada incluyendo los datos del Asignador

### Requisito 3: Modificar Meta Asignada

**Historia de Usuario:** Como rol superior que asignó una meta, quiero poder modificar o eliminar la meta que yo asigné, para ajustar los objetivos según las circunstancias.

#### Criterios de Aceptación

1. WHEN un usuario solicita modificar una Meta_Asignada, THE Backend_API SHALL verificar que el usuario autenticado es el mismo Asignador que creó esa Meta_Asignada
2. IF el usuario autenticado no es el Asignador original, THEN THE Backend_API SHALL rechazar la solicitud con un error de autorización
3. WHEN el Asignador proporciona nuevos valores válidos, THE Backend_API SHALL actualizar los campos `meta`, `fecha_inicio`, `fecha_fin` u `observaciones` de la Meta_Asignada
4. WHEN el Asignador solicita eliminar una Meta_Asignada, THE Backend_API SHALL realizar un soft delete del registro
5. THE Backend_API SHALL retornar la Meta_Asignada actualizada tras una modificación exitosa

### Requisito 4: Consultar Meta Efectiva de una Casa de Paz

**Historia de Usuario:** Como líder o cualquier usuario con acceso a la Casa de Paz, quiero consultar la meta efectiva actual, para saber qué objetivo se está usando para calcular la tasa de evangelismo.

#### Criterios de Aceptación

1. WHEN el Módulo_Evangelismo solicita los datos de meta de una Casa_de_Paz, THE Backend_API SHALL retornar tanto la Meta_Propia como la Meta_Vigente (si existe)
2. WHEN existe una Meta_Asignada cuya `fecha_inicio` es menor o igual a la fecha actual y cuya `fecha_fin` es mayor o igual a la fecha actual, THE Backend_API SHALL incluirla como Meta_Vigente en la respuesta
3. WHEN no existe ninguna Meta_Asignada vigente, THE Backend_API SHALL retornar `null` para el campo `metaAsignada`
4. THE Backend_API SHALL incluir en la respuesta de Meta_Vigente: el valor de la meta, el nombre completo del Asignador, su rol, la `fecha_inicio` y la `fecha_fin`
5. THE Backend_API SHALL incluir la Meta_Propia (campo `meta_evangelismo` de `casa_de_paz`) en la respuesta, que puede ser `null`

### Requisito 5: Meta Propia del Líder

**Historia de Usuario:** Como líder de Casa de Paz, quiero establecer y actualizar mi propia meta de evangelismo personal, para tener un objetivo propio independiente de las metas asignadas.

#### Criterios de Aceptación

1. WHEN un Líder_CDP solicita actualizar su Meta_Propia, THE Backend_API SHALL verificar que el usuario autenticado es el Líder_CDP de esa Casa_de_Paz
2. WHEN el Líder_CDP proporciona un entero positivo válido, THE Backend_API SHALL actualizar el campo `meta_evangelismo` en la tabla `casa_de_paz`
3. THE Backend_API SHALL aceptar `null` para limpiar una Meta_Propia existente
4. IF el valor proporcionado es menor o igual a cero y no es `null`, THEN THE Backend_API SHALL retornar un error descriptivo
5. IF un usuario con rol distinto a `LIDER_CDP` intenta actualizar la Meta_Propia, THEN THE Backend_API SHALL rechazar la solicitud con un error de autorización

### Requisito 6: Visualización de Metas en el Módulo de Evangelismo (Vista Líder)

**Historia de Usuario:** Como líder de Casa de Paz, quiero ver claramente mis dos tipos de metas en la página de Evangelismo, para entender mis objetivos y quién me los asignó.

#### Criterios de Aceptación

1. THE Módulo_Evangelismo SHALL mostrar una tarjeta KPI de "Meta Propia" con el valor de la Meta_Propia del Líder_CDP
2. THE Módulo_Evangelismo SHALL mostrar una tarjeta KPI de "Meta Asignada" con el valor de la Meta_Vigente si existe
3. WHEN la Meta_Propia es `null`, THE Módulo_Evangelismo SHALL mostrar "Sin meta propia" en la tarjeta correspondiente
4. WHEN no existe Meta_Vigente, THE Módulo_Evangelismo SHALL mostrar "Sin meta asignada" en la tarjeta correspondiente
5. WHEN existe una Meta_Vigente, THE Módulo_Evangelismo SHALL mostrar debajo del valor: el nombre del Asignador, su rol y el período de vigencia (fecha_inicio – fecha_fin)
6. WHERE el usuario es Líder_CDP, THE Módulo_Evangelismo SHALL mostrar un control de edición en la tarjeta de Meta Propia
7. WHERE el usuario es Líder_CDP, THE Módulo_Evangelismo SHALL mostrar la tarjeta de Meta Asignada en modo solo lectura (sin controles de edición)

### Requisito 7: Cálculo y Visualización de la Tasa de Evangelismo

**Historia de Usuario:** Como líder o sublíder, quiero ver la tasa de evangelismo calculada contra la meta más relevante, para entender el progreso real hacia el objetivo prioritario.

#### Criterios de Aceptación

1. WHEN existe una Meta_Vigente con valor mayor a cero, THE Módulo_Evangelismo SHALL calcular la Tasa_Evangelismo como (evangelizados / Meta_Vigente) × 100
2. WHEN no existe Meta_Vigente pero existe Meta_Propia con valor mayor a cero, THE Módulo_Evangelismo SHALL calcular la Tasa_Evangelismo como (evangelizados / Meta_Propia) × 100
3. WHEN ni la Meta_Vigente ni la Meta_Propia tienen valor mayor a cero, THE Módulo_Evangelismo SHALL mostrar "Sin meta" en la tarjeta de Tasa_Evangelismo
4. THE Módulo_Evangelismo SHALL redondear la Tasa_Evangelismo calculada a dos decimales
5. THE Módulo_Evangelismo SHALL mostrar la Tasa_Evangelismo en formato "XX.XX%"
6. WHEN la Tasa_Evangelismo supera el 100%, THE Módulo_Evangelismo SHALL mostrar el valor real sin truncar (ej. "125.00%")
7. THE Módulo_Evangelismo SHALL indicar visualmente qué meta se está usando como referencia para el cálculo (meta asignada o meta propia)

### Requisito 8: Vista de Gestión de Metas para Roles Superiores

**Historia de Usuario:** Como rol superior en la jerarquía, quiero ver y gestionar las metas asignadas a todas las Casas de Paz bajo mi jerarquía, para hacer seguimiento del cumplimiento de objetivos.

#### Criterios de Aceptación

1. THE Módulo_Evangelismo SHALL mostrar a los Rol_Superior una lista de todas las Casas_de_Paz bajo su jerarquía con sus metas asignadas vigentes
2. WHEN un Rol_Superior accede a la vista de gestión, THE Backend_API SHALL retornar solo las Casas_de_Paz que pertenecen a la jerarquía del usuario autenticado
3. THE Módulo_Evangelismo SHALL mostrar para cada Casa_de_Paz: nombre/código, Meta_Vigente (si existe), Meta_Propia del líder, cantidad de evangelizados en el período actual y Tasa_Evangelismo
4. WHEN no existe Meta_Vigente para una Casa_de_Paz, THE Módulo_Evangelismo SHALL mostrar un control para asignar una nueva meta
5. WHEN existe una Meta_Vigente asignada por el usuario autenticado, THE Módulo_Evangelismo SHALL mostrar controles para modificar o eliminar esa meta
6. WHEN existe una Meta_Vigente asignada por otro usuario, THE Módulo_Evangelismo SHALL mostrar la meta en modo solo lectura para ese Rol_Superior
7. THE Módulo_Evangelismo SHALL permitir al Rol_Superior filtrar las Casas_de_Paz por red

### Requisito 9: Formulario de Asignación de Meta

**Historia de Usuario:** Como rol superior, quiero un formulario claro para asignar una meta a una Casa de Paz, para establecer objetivos con toda la información necesaria.

#### Criterios de Aceptación

1. WHEN un Rol_Superior inicia la asignación de meta, THE Módulo_Evangelismo SHALL mostrar un formulario con campos: meta (entero positivo), fecha_inicio, fecha_fin y observaciones (opcional)
2. THE Módulo_Evangelismo SHALL validar que la meta sea un entero positivo antes de enviar la solicitud
3. THE Módulo_Evangelismo SHALL validar que la fecha_fin sea posterior a la fecha_inicio antes de enviar la solicitud
4. WHEN el formulario se envía con datos válidos, THE Módulo_Evangelismo SHALL enviar la solicitud al Backend_API y mostrar confirmación de éxito
5. WHEN el Backend_API retorna un error, THE Módulo_Evangelismo SHALL mostrar el mensaje de error al usuario
6. THE Módulo_Evangelismo SHALL permitir cancelar el formulario sin guardar cambios

### Requisito 10: Autorización Jerárquica

**Historia de Usuario:** Como administrador del sistema, quiero que solo los roles con autoridad jerárquica sobre una Casa de Paz puedan asignarle metas, para mantener la integridad del sistema de objetivos.

#### Criterios de Aceptación

1. WHEN un `PASTOR` solicita asignar una meta a cualquier Casa_de_Paz de su iglesia, THE Backend_API SHALL autorizar la operación
2. WHEN un `SUPERVISOR_VISION_ACCION` solicita asignar una meta, THE Backend_API SHALL verificar que la Casa_de_Paz pertenece a una red bajo su supervisión antes de autorizar
3. WHEN un `LIDER_RED` solicita asignar una meta, THE Backend_API SHALL verificar que la Casa_de_Paz pertenece a su red antes de autorizar
4. WHEN un `SUBLIDER_RED` solicita asignar una meta, THE Backend_API SHALL verificar que la Casa_de_Paz pertenece a la red donde ejerce como sublíder antes de autorizar
5. IF un usuario con rol `LIDER_CDP` o `SUBLIDER_CDP` intenta asignar una Meta_Asignada, THEN THE Backend_API SHALL rechazar la solicitud con un error de autorización
6. THE Backend_API SHALL retornar un error 403 con mensaje descriptivo para cualquier intento de asignación no autorizado

### Requisito 11: Compatibilidad con el Sistema Existente

**Historia de Usuario:** Como desarrollador, quiero que el rediseño sea compatible con el sistema existente, para que los módulos actuales sigan funcionando sin interrupciones.

#### Criterios de Aceptación

1. THE Backend_API SHALL mantener el endpoint existente `PATCH /casas-de-paz/:id/meta-evangelismo` sin cambios en su contrato
2. THE Base_de_Datos SHALL preservar todos los registros existentes en `casa_de_paz.meta_evangelismo` durante la migración
3. THE Módulo_Evangelismo SHALL mantener la tarjeta KPI de "Evangelizados" en su posición actual
4. THE Módulo_Evangelismo SHALL mantener el gráfico de Timeline de Evangelismo sin cambios funcionales
5. THE Backend_API SHALL mantener compatibilidad con los endpoints existentes de estadísticas de evangelismo
