# Requisitos — Finanzas de Casa de Paz

## Introducción

Registro de ofrendas y diezmos de las reuniones de Casa de Paz. **No es contabilidad**: eso es el Módulo 6. Aquí solo se registra lo que entra en cada reunión y se reporta por CdP, red e iglesia.

## Glosario

- **Ingreso**: Contribución económica registrada en el sistema.
- **Tipo_Ingreso**: Clase de contribución. Catalogo: ofrenda, diezmo, primicia, pacto.
- **Moneda**: Divisa del Ingreso. `BOB` o `USD`.
- **Ingreso_Grupal**: Ingreso sin Persona asociada. Es el caso normal de la ofrenda de una reunión.
- **Ingreso_Nominal**: Ingreso con Persona asociada. Es el caso del diezmo en sobre con nombre.
- **Moneda_Defecto**: Moneda que la Iglesia usa por defecto. `BOB` para el despliegue inicial.

## Requisitos

### Requisito 1: Registro de ingresos

**Historia:** Como líder, quiero registrar cuánto se ofrendó en mi reunión sin tener que hacer contabilidad.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de cada Ingreso: `tipo_ingreso_id`, `monto`, `moneda`, `fecha`, `iglesia_id` y el origen.
2. THE Sistema SHALL asociar todo Ingreso de Casa de Paz al Reporte de esa reunión.
3. THE Sistema SHALL permitir que `persona_id` sea nulo, para el Ingreso_Grupal.
4. THE Sistema SHALL exigir que `monto` sea mayor que cero.
5. THE Sistema SHALL almacenar `monto` con dos decimales exactos.
6. THE Sistema SHALL rechazar una `fecha` posterior a la fecha actual.
7. THE Sistema SHALL permitir varios Ingresos del mismo Tipo_Ingreso en el mismo Reporte.
8. THE Sistema SHALL exigir que la Persona de un Ingreso_Nominal pertenezca a la misma Iglesia.

### Requisito 2: Tipos de ingreso

**Historia:** Como supervisor, quiero poder agregar un tipo de contribución si mi iglesia lo necesita.

#### Criterios de aceptación

1. THE Sistema SHALL modelar Tipo_Ingreso como Catalogo.
2. THE Sistema SHALL sembrar los tipos: ofrenda, diezmo, primicia, pacto.
3. THE Sistema SHALL permitir al Supervisor agregar y desactivar Tipo_Ingreso de su Iglesia.
4. IF un Tipo_Ingreso está referenciado por al menos un Ingreso vigente, THEN THE Sistema SHALL impedir su borrado lógico.

### Requisito 3: Moneda

**Historia:** Como tesorero, quiero que los bolivianos y los dólares nunca se sumen entre sí.

#### Criterios de aceptación

1. THE Sistema SHALL registrar la Moneda en cada Ingreso.
2. THE Sistema SHALL definir Moneda como enum con `BOB` y `USD`.
3. THE Sistema SHALL asignar la Moneda_Defecto de la Iglesia cuando no se especifica.
4. THE Sistema SHALL definir `BOB` como Moneda_Defecto del despliegue inicial.
5. IF una consulta suma Ingresos de Monedas distintas sin agrupar por Moneda, THEN THE Sistema SHALL considerar esa consulta inválida.
6. THE Sistema SHALL agrupar por Moneda en todo total, subtotal y reporte.
7. THE Sistema SHALL permitir Ingresos en Monedas distintas dentro del mismo Reporte.
8. THE Sistema SHALL NOT convertir entre Monedas: no se registran tipos de cambio en el Módulo 1.

### Requisito 4: Reportes

**Historia:** Como pastor, quiero ver cuánto entró por casa de paz, por red y por iglesia, en el período que yo elija.

#### Criterios de aceptación

1. THE Sistema SHALL exponer los totales de Ingresos por Casa_De_Paz, por Red y por Iglesia.
2. THE Sistema SHALL permitir consultar por rango de fechas arbitrario.
3. THE Sistema SHALL desglosar los totales por Tipo_Ingreso y por Moneda.
4. THE Sistema SHALL exponer la comparación de un período contra el anterior de la misma duración.
5. THE Sistema SHALL exponer el total del mes en curso y el del mes anterior.
6. WHERE un período no tiene Ingresos, THE Sistema SHALL devolver cero y no una ausencia de fila.

### Requisito 5: Visibilidad

**Historia:** Como supervisor, quiero decidir si el sublíder ve los montos de la ofrenda.

#### Criterios de aceptación

1. THE Sistema SHALL permitir al Líder de CdP ver los Ingresos de su Casa_De_Paz.
2. THE Sistema SHALL permitir al Sublíder de CdP ver los Ingresos únicamente si la configuración de la Iglesia lo habilita.
3. THE Sistema SHALL definir `SUBLIDER_VE_OFRENDAS` con valor por defecto `false`.
4. THE Sistema SHALL permitir al Líder de Red ver los Ingresos de todas las Casas de Paz de su Red.
5. THE Sistema SHALL permitir al Supervisor y al Pastor ver todos los Ingresos de su alcance.
6. IF un Usuario intenta modificar un Ingreso fuera de su Alcance según su Rol_Sistema, THEN THE Sistema SHALL rechazar la operación.
7. THE Sistema SHALL aplicar la restricción de visibilidad en la base de datos, y SHALL NOT ocultar montos solo en el frontend.

### Requisito 6: Integración con el reporte de CdP

**Historia:** Como líder, quiero escribir el total de ofrendas en el mismo formulario del reporte.

#### Criterios de aceptación

1. THE Sistema SHALL permitir registrar los Ingresos de una reunión desde el formulario del Reporte.
2. THE Sistema SHALL crear un Ingreso de tipo ofrenda con el total declarado en el campo "Total ofrendas".
3. THE Sistema SHALL crear un Ingreso de tipo diezmo con el total declarado en el campo "Total diezmos".
4. WHERE el total declarado es cero o nulo, THE Sistema SHALL NOT crear el Ingreso.
5. WHEN se edita el total de un Reporte, THE Sistema SHALL actualizar el Ingreso correspondiente en lugar de crear otro.
6. WHERE un Reporte se elimina lógicamente, THE Sistema SHALL eliminar lógicamente sus Ingresos.
