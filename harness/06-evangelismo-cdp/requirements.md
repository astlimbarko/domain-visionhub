# Requisitos — Evangelismo de Casa de Paz

## Introducción

Cubre el evangelismo **de casa de paz**: el trabajo chico que hace cada CdP en su salida semanal. El Departamento de Evangelismo — el trabajo grande a nivel de toda la iglesia — es el Módulo 2.

La frontera es el campo `escala`: `CASA_DE_PAZ` entra ahora; `RED`, `IGLESIA` y `COBERTURA` entran con el Módulo 2. La columna existe desde hoy para que el Módulo 2 no necesite migración.

El frontend de este módulo **ya está construido** (`iu/rediseno-modulo-evangelismo/`, `iu/meta-evangelismo-kpi/`, `iu/sistema-evangelismo-reportes/`, `iu/mejora-formulario-evangelismo/`). Estos requisitos se alinean con lo que ese front espera consumir.

## Glosario

- **Evangelizado**: Persona registrada como alcanzada por una acción de evangelismo.
- **Escala**: Nivel al que se hizo el evangelismo: `CASA_DE_PAZ`, `RED`, `IGLESIA` o `COBERTURA`.
- **Meta_Propia**: Meta de evangelismo que el Líder de CdP fija para su propia Casa_De_Paz.
- **Meta_Asignada**: Meta que un Rol_Superior asigna a una Casa_De_Paz, con período de vigencia.
- **Meta_Vigente**: La Meta_Asignada cuyo período incluye la fecha evaluada.
- **Meta_Efectiva**: La meta que se usa para calcular la tasa. Es la Meta_Vigente si existe; si no, la Meta_Propia.
- **Rol_Superior**: Quien está por encima del Líder de CdP: Sublíder de Red, Líder de Red, Supervisor o Pastor.
- **Tasa_Evangelismo**: `(evangelizados / Meta_Efectiva) × 100`.
- **Asignador**: El Rol_Superior que creó una Meta_Asignada.

## Requisitos

### Requisito 1: Registro de evangelizados

**Historia:** Como líder, quiero registrar a quién evangelizamos en la salida, para poder darles seguimiento después.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de cada Evangelizado: `persona_id`, `fecha`, `escala`, `casa_de_paz_id` e `iglesia_id`.
2. THE Sistema SHALL definir `escala` como enum con `CASA_DE_PAZ`, `RED`, `IGLESIA`, `COBERTURA`.
3. THE Sistema SHALL permitir únicamente `escala = CASA_DE_PAZ` en el Módulo 1.
4. IF se registra un Evangelizado con `escala` distinta de `CASA_DE_PAZ`, THEN THE Sistema SHALL rechazar la operación.
5. THE Sistema SHALL exigir `casa_de_paz_id` cuando `escala = CASA_DE_PAZ`.
6. THE Sistema SHALL registrar el domicilio del Evangelizado como texto libre.
7. THE Sistema SHALL registrar el teléfono del Evangelizado mediante el Modelo_Hibrido de teléfonos.
8. THE Sistema SHALL rechazar una `fecha` posterior a la fecha actual.
9. THE Sistema SHALL permitir como máximo un registro vigente por Persona, Casa_De_Paz y fecha.

### Requisito 2: Persona evangelizada

**Historia:** Como líder, quiero que la persona que evangelizamos quede en el sistema con su estado, para poder buscarla después.

#### Criterios de aceptación

1. WHEN se registra un Evangelizado, THE Sistema SHALL crear o referenciar una Persona.
2. WHEN se crea la Persona por evangelismo, THE Sistema SHALL asignarle el Estado `SIM`.
3. THE Sistema SHALL exigir al registrar por evangelismo únicamente `primer_nombre`, `primer_apellido` y `sexo`.
4. THE Sistema SHALL permitir vincular un Evangelizado a una Persona ya registrada.
5. THE Sistema SHALL exigir que la Persona y la Casa_De_Paz pertenezcan a la misma Iglesia.
6. THE Sistema SHALL registrar quién evangelizó a la Persona como referencia a otra Persona.

### Requisito 3: Meta propia

**Historia:** Como líder de casa de paz, quiero fijarme una meta de evangelismo para medirme.

#### Criterios de aceptación

1. THE Sistema SHALL incluir en Casa_De_Paz un campo `meta_evangelismo` de tipo entero.
2. THE Sistema SHALL permitir que `meta_evangelismo` sea nulo, con valor por defecto nulo.
3. THE Sistema SHALL permitir al Líder de CdP fijar y editar la Meta_Propia de su Casa_De_Paz.
4. IF la Meta_Propia no es un entero positivo, THEN THE Sistema SHALL rechazar la operación.
5. IF un Usuario que no es Líder de esa Casa_De_Paz ni Rol_Superior intenta fijar la Meta_Propia, THEN THE Sistema SHALL rechazar la operación.
6. THE Sistema SHALL permitir al Sublíder de CdP leer la Meta_Propia sin modificarla.

### Requisito 4: Meta asignada

**Historia:** Como líder de red, quiero asignarle una meta a una casa de paz para un período, y que esa meta mande sobre la que el líder se puso.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de cada Meta_Asignada: `casa_de_paz_id`, `asignador_id`, `meta`, `fecha_inicio`, `fecha_fin` y `observaciones`.
2. THE Sistema SHALL exigir que `meta` sea un entero positivo no nulo.
3. THE Sistema SHALL exigir `fecha_inicio` y `fecha_fin` no nulas, de tipo fecha sin hora.
4. IF `fecha_fin` es anterior a `fecha_inicio`, THEN THE Sistema SHALL rechazar la operación.
5. THE Sistema SHALL permitir crear Meta_Asignada únicamente a un Rol_Superior de esa Casa_De_Paz.
6. IF un Líder de CdP intenta crear una Meta_Asignada para su propia Casa_De_Paz, THEN THE Sistema SHALL rechazar la operación.
7. THE Sistema SHALL registrar quién asignó la meta.
8. THE Sistema SHALL permitir como máximo una Meta_Asignada vigente por Casa_De_Paz en una fecha dada.
9. IF se crea una Meta_Asignada cuyo período se solapa con otra vigente de la misma Casa_De_Paz, THEN THE Sistema SHALL rechazar la operación.
10. THE Sistema SHALL permitir al Líder de CdP leer las Meta_Asignada de su Casa_De_Paz sin modificarlas.
11. THE Sistema SHALL permitir al Asignador y a los Rol_Superior editar y eliminar lógicamente una Meta_Asignada.

### Requisito 5: Meta efectiva y tasa

**Historia:** Como líder, quiero ver mi porcentaje de avance contra la meta que corresponde.

#### Criterios de aceptación

1. THE Sistema SHALL calcular la Meta_Efectiva de una Casa_De_Paz en una fecha como la Meta_Vigente si existe, y la Meta_Propia en caso contrario.
2. THE Sistema SHALL dar prioridad a la Meta_Asignada sobre la Meta_Propia.
3. WHERE no existe Meta_Vigente ni Meta_Propia, THE Sistema SHALL devolver Meta_Efectiva nula.
4. THE Sistema SHALL calcular la Tasa_Evangelismo como `(evangelizados / Meta_Efectiva) × 100`.
5. IF Meta_Efectiva es nula o cero, THEN THE Sistema SHALL devolver Tasa_Evangelismo nula, y SHALL NOT dividir por cero.
6. THE Sistema SHALL permitir que la Tasa_Evangelismo supere el 100%.
7. THE Sistema SHALL calcular los evangelizados de un período como el conteo de Evangelizado de esa Casa_De_Paz en ese rango de fechas.
8. THE Sistema SHALL exponer el origen de la Meta_Efectiva: propia o asignada.

### Requisito 6: Integración con el reporte de CdP

**Historia:** Como supervisor, quiero cruzar lo que el líder declara con lo que registra.

#### Criterios de aceptación

1. THE Sistema SHALL relacionar los Evangelizado con el Reporte de la Casa_De_Paz mediante `casa_de_paz_id` y `fecha`.
2. THE Sistema SHALL calcular los Evangelizados_Registrados de un Reporte conforme a [04-reporte-cdp](../04-reporte-cdp/requirements.md#requisito-5-evangelizados).
3. THE Sistema SHALL exponer la diferencia entre declarados y registrados.
