# Requisitos — Fundación

## Introducción

Define las convenciones transversales que **toda** tabla, función y política de VisionHub debe cumplir: identificadores, auditoría, borrado lógico, nomenclatura, idioma y manejo de errores. Ninguna otra área puede contradecir este documento.

## Glosario

- **Tabla_De_Dominio**: Toda tabla del esquema `public` que almacena datos de negocio. Excluye catálogos inmutables y tablas de sistema de Supabase.
- **Catalogo**: Tabla de valores de referencia editables por el Supervisor (tipos de ingreso, ministerios, cargos, temas).
- **Auditoria**: Conjunto de seis campos que registran quién creó, modificó o eliminó cada fila y cuándo.
- **Borrado_Logico**: Marcar una fila como eliminada sin removerla físicamente de la base de datos.
- **Actor**: El usuario autenticado que ejecuta una operación, identificado por `auth.uid()`.
- **Modelo_Hibrido**: Patrón de dos tablas (asignación + datos físicos) usado para direcciones y teléfonos, en lugar de polimorfismo puro.

## Requisitos

### Requisito 1: Identificadores

**Historia:** Como arquitecto, quiero identificadores no adivinables y generables en el cliente, para que el sistema escale a N iglesias sin colisiones ni fuga de volumen de datos.

#### Criterios de aceptación

1. THE Sistema SHALL usar `UUID` como tipo de la clave primaria de toda Tabla_De_Dominio.
2. THE Sistema SHALL definir el valor por defecto de toda clave primaria como `gen_random_uuid()`.
3. IF una tabla usa un entero autoincremental como clave primaria, THEN THE Sistema SHALL rechazar ese diseño.
4. THE Sistema SHALL nombrar la clave primaria de toda Tabla_De_Dominio como `id`.
5. WHERE una tabla referencia a otra, THE Sistema SHALL nombrar la clave foránea como `<tabla_referenciada>_id`.

### Requisito 2: Auditoría

**Historia:** Como pastor, quiero saber quién cambió cada dato y cuándo, para poder auditar el sistema y confiar en sus números.

#### Criterios de aceptación

1. THE Sistema SHALL incluir en toda Tabla_De_Dominio los campos `fecha_creacion`, `fecha_actualizacion`, `creado_por`, `actualizado_por`, `fecha_eliminacion` y `eliminado_por`.
2. WHEN se inserta una fila, THE Sistema SHALL asignar `fecha_creacion = now()` y `creado_por = auth.uid()` sin depender de que el cliente los envíe.
3. WHEN se actualiza una fila, THE Sistema SHALL asignar `fecha_actualizacion = now()` y `actualizado_por = auth.uid()` sin depender de que el cliente los envíe.
4. IF un cliente envía un valor para `fecha_creacion`, `creado_por`, `fecha_actualizacion` o `actualizado_por`, THEN THE Sistema SHALL ignorar ese valor y sobrescribirlo con el calculado en el servidor.
5. THE Sistema SHALL definir `creado_por`, `actualizado_por` y `eliminado_por` como `UUID` referenciando a `auth.users(id)`.
6. WHERE una operación la ejecuta un proceso automático sin Actor, THE Sistema SHALL registrar `NULL` en el campo de autoría correspondiente.

### Requisito 3: Borrado lógico

**Historia:** Como supervisor, quiero que nada se borre de verdad, para no perder historia y poder revertir errores.

#### Criterios de aceptación

1. THE Sistema SHALL implementar el borrado de toda Tabla_De_Dominio asignando `fecha_eliminacion = now()` y `eliminado_por = auth.uid()`.
2. IF una operación intenta ejecutar `DELETE` físico sobre una Tabla_De_Dominio, THEN THE Sistema SHALL rechazar la operación.
3. THE Sistema SHALL excluir las filas con `fecha_eliminacion IS NOT NULL` de toda consulta de lectura, salvo que la consulta pida explícitamente el historial.
4. WHEN una fila se marca como eliminada, THE Sistema SHALL conservar todas las filas que la referencian, sin eliminarlas en cascada.
5. THE Sistema SHALL considerar `fecha_eliminacion IS NULL` como la condición de "fila vigente".

### Requisito 4: Nomenclatura e idioma

**Historia:** Como desarrollador, quiero una sola convención de nombres, para no tener que adivinar cómo se llama cada cosa.

#### Criterios de aceptación

1. THE Sistema SHALL nombrar tablas, columnas, funciones, tipos y políticas en español, en `snake_case` y en minúsculas.
2. THE Sistema SHALL nombrar las tablas en singular, por ejemplo `persona`, no `personas`.
3. THE Sistema SHALL nombrar los tipos enumerados con el sufijo `_enum`, por ejemplo `grado_instruccion_enum`.
4. THE Sistema SHALL declarar los valores de todo tipo enumerado en `MAYUSCULA_CON_GUION_BAJO`.
5. THE Sistema SHALL nombrar las tablas de relación uniendo las dos entidades relacionadas, por ejemplo `casa_de_paz_membresia`.
6. THE Sistema SHALL escribir sin tildes los identificadores del esquema, y con tildes todo texto destinado a personas.

### Requisito 5: Valores fijos y catálogos

**Historia:** Como supervisor, quiero poder editar las listas de valores de mi iglesia, sin que el sistema se rompa ni haya que tocar código.

#### Criterios de aceptación

1. WHERE un campo admite un conjunto de valores fijo que no cambia por iglesia, THE Sistema SHALL modelarlo como tipo enumerado de PostgreSQL.
2. WHERE un campo admite un conjunto de valores que el Supervisor puede editar, THE Sistema SHALL modelarlo como Catalogo, es decir una tabla con clave foránea.
3. IF un valor de Catalogo está referenciado por al menos una fila vigente, THEN THE Sistema SHALL impedir su borrado lógico.
4. THE Sistema SHALL incluir en todo Catalogo los campos `nombre`, `activo` y `orden`.

### Requisito 6: Modelo híbrido de direcciones y teléfonos

**Historia:** Como arquitecto, quiero integridad referencial real en direcciones y teléfonos, sin recurrir a polimorfismo con columnas sin restricción.

#### Criterios de aceptación

1. THE Sistema SHALL modelar direcciones y teléfonos con dos tablas: una de asignación y una de datos físicos.
2. THE Sistema SHALL declarar en la tabla de asignación una clave foránea por cada entidad asignable: `persona_id`, `iglesia_id` y `casa_de_paz_id`.
3. THE Sistema SHALL exigir mediante una restricción `CHECK` que exactamente una de las claves foráneas de asignación tenga valor y las demás sean `NULL`.
4. THE Sistema SHALL permitir como máximo una asignación con `es_principal = true` por entidad y por tipo, entre las filas vigentes.
5. WHERE una asignación deja de usarse, THE Sistema SHALL marcarla con `activo = false` en lugar de eliminarla, para conservar el historial.

### Requisito 7: Historial

**Historia:** Como supervisor, quiero ver cómo cambió la estructura en el tiempo, para entender el crecimiento y responder por decisiones pasadas.

#### Criterios de aceptación

1. WHERE una asignación de persona a estructura o cargo puede cambiar en el tiempo, THE Sistema SHALL modelarla como tabla de historial con `fecha_inicio` y `fecha_fin`.
2. THE Sistema SHALL considerar vigente toda fila de historial cuyo `fecha_fin IS NULL`.
3. WHEN se registra una asignación nueva que reemplaza a la vigente, THE Sistema SHALL asignar `fecha_fin` a la anterior en la misma transacción.
4. IF existe más de una fila vigente donde el dominio admite una sola, THEN THE Sistema SHALL rechazar la operación que produjo la segunda.
5. THE Sistema SHALL exigir que `fecha_fin` sea nula o posterior o igual a `fecha_inicio`.

### Requisito 8: Reglas en la base de datos

**Historia:** Como arquitecto, quiero que las reglas vivan en la base, para que la web de hoy y la app móvil de mañana se comporten igual sin duplicar lógica.

#### Criterios de aceptación

1. THE Sistema SHALL implementar toda regla de negocio en la base de datos, mediante restricciones, funciones o disparadores.
2. IF una regla de negocio está implementada únicamente en el cliente, THEN THE Sistema SHALL considerar ese diseño inválido.
3. THE Sistema SHALL garantizar que toda operación permitida vía la API de Supabase respete las mismas reglas que una operación ejecutada en SQL directo.
4. WHERE un cálculo depende de datos de varias tablas, THE Sistema SHALL exponerlo como vista o función, no como consulta reconstruida en cada cliente.

### Requisito 9: Errores

**Historia:** Como desarrollador del frontend, quiero errores identificables por código, para mostrar el mensaje correcto sin leer cadenas de texto.

#### Criterios de aceptación

1. WHEN una regla de negocio rechaza una operación, THE Sistema SHALL lanzar una excepción con un `ERRCODE` de la clase `P0001` y un mensaje en español.
2. THE Sistema SHALL incluir en el mensaje de error el nombre de la regla violada y el valor que la violó.
3. IF una restricción de base de datos rechaza una operación, THEN THE Sistema SHALL nombrar esa restricción de forma que su nombre identifique la regla, por ejemplo `chk_asignacion_una_sola_entidad`.
