# Requisitos — Persona y Parentela

## Introducción

Persona es la entidad central del sistema: todo lo demás la referencia. Este documento cubre su identidad, sus datos censales, sus direcciones y teléfonos, cómo llegó a la iglesia, sus relaciones familiares y el conteo de familias.

El conteo de familias estaba marcado como pendiente de diseño en `software/bd-modelo.md`. Aquí se cierra.

## Glosario

- **Persona**: Ser humano registrado en el sistema. Pertenece a exactamente una Iglesia.
- **Persona_Detalle**: Extensión de Persona con datos censales (lugar de nacimiento, estado civil, grado de instrucción, ocupación).
- **Apellido_Casada**: Apellido que adopta una mujer al casarse en Bolivia, con el formato `de <apellido del esposo>`.
- **Nombre_Completo**: Representación textual del nombre de una Persona, calculada según su estado civil.
- **Relacion_Familiar**: Vínculo entre dos Personas registradas, con un tipo y su inverso.
- **Referencia_Familiar**: Vínculo en texto libre hacia un familiar que no está registrado en el sistema.
- **Relacion_Directa**: Tipo de Relacion_Familiar que cuenta para formar una familia. Por defecto: cónyuge, hijo y abuelo.
- **Nucleo_Familiar**: Conjunto de Personas conectadas entre sí por Relacion_Directa. Es la unidad que la iglesia cuenta como "una familia".
- **Persona_Oculta**: Persona de alto rango excluida de las búsquedas normales.
- **Llegada**: Registro de cómo y cuándo una Persona llegó a la Iglesia.

## Requisitos

### Requisito 1: Identidad

**Historia:** Como líder, quiero registrar el nombre de una persona como lo pide el formulario de la iglesia, sin campos de más ni de menos.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de toda Persona: `primer_nombre`, `primer_apellido`, `sexo` e `iglesia_id`.
2. THE Sistema SHALL permitir que `segundo_nombre`, `segundo_apellido`, `apellido_casada`, `fecha_nacimiento`, `ci` y `correo` sean nulos.
3. THE Sistema SHALL usar un solo campo `VARCHAR(100)` por cada componente del nombre, y SHALL NOT dividirlo en `nombre_1`, `nombre_2`.
4. WHERE una Persona tiene tres o más nombres, THE Sistema SHALL admitir que `segundo_nombre` contenga varios, por ejemplo "Elena María".
5. THE Sistema SHALL exigir que `ci` sea único entre las Personas vigentes de todo el sistema, no solo dentro de una Iglesia.
6. THE Sistema SHALL permitir `ci` nulo, porque los menores y los recién llegados a menudo no lo tienen.
7. THE Sistema SHALL normalizar `correo` a minúsculas y sin espacios antes de guardarlo.
8. THE Sistema SHALL definir `sexo` como enum con los valores `M` y `F`.
9. THE Sistema SHALL rechazar una `fecha_nacimiento` posterior a la fecha actual.

### Requisito 2: Datos censales

**Historia:** Como pastor, quiero saber cuántas parejas casadas y qué nivel de instrucción tiene mi congregación, porque son indicadores que uso para decidir.

#### Criterios de aceptación

1. THE Sistema SHALL almacenar en Persona_Detalle: `nacimiento_ciudad`, `estado_civil`, `grado_instruccion` y `ocupacion`.
2. THE Sistema SHALL separar Persona_Detalle de Persona en tablas distintas, para no sobrecargar la tabla central.
3. THE Sistema SHALL relacionar Persona y Persona_Detalle uno a uno.
4. THE Sistema SHALL definir `estado_civil` como enum con: `SOLTERO`, `CASADO`, `VIUDO`, `DIVORCIADO`.
5. THE Sistema SHALL definir `grado_instruccion` como enum con los once valores de `software/bd-modelo.md`.
6. THE Sistema SHALL permitir nulos en todos los campos de Persona_Detalle: son informativos.
7. THE Sistema SHALL exponer el conteo de Personas con `estado_civil = CASADO` por Iglesia.

### Requisito 3: Apellido de casada

**Historia:** Como secretaria, quiero que el sistema sugiera el apellido de casada pero me deje corregirlo, porque no todas las mujeres lo usan igual.

#### Criterios de aceptación

1. THE Sistema SHALL permitir llenar `apellido_casada` únicamente cuando `estado_civil = CASADO`.
2. IF `estado_civil` es distinto de `CASADO` y `apellido_casada` no es nulo, THEN THE Sistema SHALL rechazar la operación.
3. WHERE una Persona de sexo `F` y `estado_civil = CASADO` tiene una Relacion_Familiar de tipo cónyuge con una Persona registrada, THE Sistema SHALL sugerir `apellido_casada` como la concatenación de `'de '` con el `primer_apellido` del cónyuge.
4. THE Sistema SHALL permitir que el usuario sobrescriba el valor sugerido.
5. THE Sistema SHALL tratar la sugerencia como sugerencia: SHALL NOT asignar `apellido_casada` de forma automática.
6. THE Sistema SHALL NOT modificar `primer_apellido` ni `segundo_apellido` al asignar `apellido_casada`.
7. WHEN `estado_civil` cambia de `CASADO` a `DIVORCIADO` o `SOLTERO`, THE Sistema SHALL vaciar `apellido_casada`.
8. WHERE una Persona de sexo `F` está casada y su cónyuge no está registrado, THE Sistema SHALL usar sus apellidos de nacimiento en el Nombre_Completo.

### Requisito 4: Nombre completo

**Historia:** Como usuario, quiero ver el nombre de la persona escrito como se usa en Bolivia, en toda pantalla y todo reporte.

#### Criterios de aceptación

1. THE Sistema SHALL exponer el Nombre_Completo como campo calculado, y SHALL NOT almacenarlo.
2. WHERE `apellido_casada` es nulo, THE Sistema SHALL componer el Nombre_Completo como `primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido`, omitiendo los nulos.
3. WHERE `apellido_casada` no es nulo, THE Sistema SHALL componer el Nombre_Completo como `primer_nombre`, `segundo_nombre`, `primer_apellido`, `apellido_casada`, omitiendo `segundo_apellido`.
4. THE Sistema SHALL separar los componentes con un solo espacio, sin espacios dobles ni al inicio ni al final.

### Requisito 5: Direcciones y teléfonos

**Historia:** Como líder, quiero registrar varias direcciones y teléfonos por persona y saber cuál es el principal.

#### Criterios de aceptación

1. THE Sistema SHALL modelar direcciones y teléfonos con el Modelo_Hibrido definido en [00-fundacion](../00-fundacion/requirements.md#requisito-6-modelo-híbrido-de-direcciones-y-teléfonos).
2. THE Sistema SHALL registrar de cada dirección: `ciudad`, `zona`, `anillo`, `calle`, `numero`, `referencia`, `url_gps` y `observaciones`.
3. THE Sistema SHALL permitir que `anillo` sea nulo: es exclusivo de Santa Cruz de la Sierra.
4. THE Sistema SHALL definir el tipo de teléfono como Catalogo con: celular personal, celular trabajo, fijo, WhatsApp, otro.
5. THE Sistema SHALL permitir varias direcciones y varios teléfonos por Persona.
6. THE Sistema SHALL permitir como máximo una dirección principal y un teléfono principal por Persona entre las asignaciones vigentes.
7. WHERE una dirección o teléfono deja de usarse, THE Sistema SHALL marcar la asignación con `activo = false` y SHALL conservar el historial.

### Requisito 6: Llegada a la iglesia

**Historia:** Como pastor, quiero saber cómo llegó cada persona, para medir qué está funcionando.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de cada Llegada: `motivo_llegada`, `fecha_ingreso`, `iglesia_id` y `comentarios`.
2. THE Sistema SHALL permitir registrar quién invitó a la Persona como clave foránea a otra Persona (`invitado_por_id`) o como texto libre (`invitado_por_txt`).
3. IF `invitado_por_id` e `invitado_por_txt` tienen valor a la vez, THEN THE Sistema SHALL rechazar la operación.
4. THE Sistema SHALL definir `motivo_llegada` como Catalogo con: decisión propia, invitación de alguien, evento, campaña, otro.
5. THE Sistema SHALL permitir varias Llegadas por Persona, para registrar el historial de pertenencia a distintas Iglesias.
6. THE Sistema SHALL rechazar una `fecha_ingreso` posterior a la fecha actual.

### Requisito 7: Relaciones familiares

**Historia:** Como líder, quiero registrar que dos miembros son padre e hijo preguntándoles, y que el sistema entienda la relación en los dos sentidos.

#### Criterios de aceptación

1. THE Sistema SHALL registrar Relacion_Familiar entre dos Personas mediante `persona_id`, `familiar_id` y `tipo_relacion_id`.
2. THE Sistema SHALL definir el tipo de relación como Catalogo, con un campo `inverso_id` que apunta al tipo inverso.
3. WHEN se registra una Relacion_Familiar de A hacia B con tipo T, THE Sistema SHALL registrar automáticamente la relación de B hacia A con el tipo inverso de T.
4. WHEN se elimina lógicamente una Relacion_Familiar, THE Sistema SHALL eliminar lógicamente su inversa en la misma operación.
5. IF `persona_id` es igual a `familiar_id`, THEN THE Sistema SHALL rechazar la operación.
6. IF ya existe una Relacion_Familiar vigente entre las mismas dos Personas, THEN THE Sistema SHALL rechazar la creación de una segunda.
7. THE Sistema SHALL exigir que todo tipo de relación tenga inverso definido.
8. THE Sistema SHALL registrar las Relacion_Familiar de forma manual, y SHALL NOT inferirlas automáticamente por apellido, dirección ni ningún otro heurístico.
9. IF las dos Personas de una Relacion_Familiar pertenecen a Iglesias distintas, THEN THE Sistema SHALL rechazar la operación.

### Requisito 8: Referencias familiares

**Historia:** Como líder, quiero anotar que alguien tiene un hermano en la iglesia aunque ese hermano todavía no esté registrado.

#### Criterios de aceptación

1. THE Sistema SHALL registrar Referencia_Familiar con `persona_id`, `nombre_familiar` (texto) y `tipo_relacion_id`.
2. THE Sistema SHALL permitir Referencia_Familiar cuando el familiar no está registrado en el sistema.
3. THE Sistema SHALL excluir las Referencia_Familiar del conteo de Nucleo_Familiar.
4. WHERE una Referencia_Familiar se convierte en Relacion_Familiar porque el familiar se registró, THE Sistema SHALL permitir eliminar lógicamente la referencia.

### Requisito 9: Conteo de familias

**Historia:** Como pastor, quiero saber cuántas familias tiene mi iglesia, porque es uno de los números que más me importan.

#### Criterios de aceptación

1. THE Sistema SHALL definir Nucleo_Familiar como el conjunto de Personas conectadas, directa o indirectamente, por Relacion_Directa.
2. THE Sistema SHALL marcar qué tipos de relación son Relacion_Directa mediante el campo `cuenta_para_familia` del Catalogo de tipos.
3. THE Sistema SHALL asignar `cuenta_para_familia = true` por defecto a: cónyuge, hijo y abuelo, con sus inversos.
4. THE Sistema SHALL asignar `cuenta_para_familia = false` por defecto a los demás tipos, incluidos primo, tío y sobrino.
5. THE Sistema SHALL permitir al Supervisor cambiar `cuenta_para_familia` de cualquier tipo de relación.
6. THE Sistema SHALL contar como un Nucleo_Familiar de una sola Persona a quien no tiene ninguna Relacion_Directa vigente.
7. THE Sistema SHALL calcular los Nucleo_Familiar por Iglesia, sin cruzar Iglesias.
8. THE Sistema SHALL exponer el total de Nucleo_Familiar de una Iglesia como una sola llamada.
9. THE Sistema SHALL excluir del cálculo las Personas eliminadas lógicamente y las relaciones eliminadas lógicamente.
10. WHEN el Supervisor cambia `cuenta_para_familia` de un tipo, THE Sistema SHALL reflejar el nuevo conteo en la siguiente consulta, sin requerir recálculo manual.

### Requisito 10: Personas ocultas

**Historia:** Como pastor, quiero que los cargos altos no aparezcan en las búsquedas normales de los líderes.

#### Criterios de aceptación

1. THE Sistema SHALL incluir en Persona un campo `oculto` booleano, con valor por defecto `false`.
2. THE Sistema SHALL excluir las Persona_Oculta de las búsquedas, salvo que la consulta las pida explícitamente.
3. THE Sistema SHALL permitir que solo un Usuario con rol `ADMIN` en esa Iglesia cambie el campo `oculto`.
4. THE Sistema SHALL incluir las Persona_Oculta en los conteos agregados: ocultar no es excluir de las estadísticas.
