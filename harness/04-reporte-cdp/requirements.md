# Requisitos — Reporte de Casa de Paz

## Introducción

El formulario semanal que llena el líder o el sublíder después de cada reunión. Hoy se hace por WhatsApp o Google Forms; el sistema lo reemplaza.

Es el corazón operativo del Módulo 1: de aquí sale la asistencia, que alimenta los estados SSVA, los criterios de membresía y casi todos los dashboards. Si este formulario no se llena, el sistema no sabe nada.

**Decisión de fondo:** el reporte registra **qué personas** asistieron, no solo cuántas. `domain_knowledge/casas-de-paz/reporte.md` pedía dos números (menores y mayores), pero con dos números los cuatro criterios de `casas-de-paz/criterios.md` — 2 visitas para miembro, 8 para migrar, 12 inasistencias para inactivo, 3 meses para reconciliado — son incalculables. Los totales se derivan de la lista.

## Glosario

- **Reporte**: Registro de una reunión semanal de una Casa_De_Paz.
- **Asistencia**: Registro de que una Persona estuvo en una reunión.
- **Asistente**: Persona presente en una reunión. Puede ser Miembro_CdP o Visita.
- **Visita**: Persona presente que no es Miembro_CdP de esa Casa_De_Paz.
- **Menor**: Asistente de menos de 12 años.
- **Mayor**: Asistente de 12 años o más.
- **Libro**: Uno de los 7 tomos de "52 Lecciones de Vida".
- **Tema**: Una de las 52 lecciones de un Libro, o un tema especial.
- **Disertador**: Persona que enseñó la palabra en la reunión.
- **Evangelizados_Declarados**: Número que el líder escribe en el formulario.
- **Evangelizados_Registrados**: Cantidad de registros de evangelismo de esa fecha y esa CdP.
- **Alta_Rapida**: Registro de una Persona con datos mínimos, hecho desde el formulario de asistencia.

## Requisitos

### Requisito 1: Reporte

**Historia:** Como líder de casa de paz, quiero reportar mi reunión desde el sistema en lugar de mandar un mensaje de WhatsApp.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de cada Reporte: `casa_de_paz_id`, `fecha_reunion`, `libro_id`, `tema_id`, `disertador_id`, `salio_evangelizar`, `testimonios` y `comentarios`.
2. THE Sistema SHALL exigir `casa_de_paz_id` y `fecha_reunion` en todo Reporte.
3. THE Sistema SHALL permitir como máximo un Reporte vigente por Casa_De_Paz y `fecha_reunion`.
4. THE Sistema SHALL rechazar una `fecha_reunion` posterior a la fecha actual.
5. THE Sistema SHALL permitir que el Líder de CdP y el Sublíder de CdP creen el Reporte de su Casa_De_Paz.
6. IF un Usuario que no es Líder ni Sublíder vigente de esa Casa_De_Paz intenta crear su Reporte, THEN THE Sistema SHALL rechazar la operación.
7. THE Sistema SHALL permitir que el Supervisor y el Líder de Red lean todo Reporte de su alcance.
8. THE Sistema SHALL definir qué campos del Reporte son obligatorios según la configuración de la Iglesia, conforme a [10-panel-supervisor](../10-panel-supervisor/requirements.md).

### Requisito 2: Asistencia por persona

**Historia:** Como líder, quiero marcar quién vino de mi lista, para que el sistema sepa a quién hay que ir a buscar.

#### Criterios de aceptación

1. THE Sistema SHALL registrar la Asistencia como una fila por Persona y por Reporte.
2. THE Sistema SHALL permitir como máximo una Asistencia vigente por Persona y por Reporte.
3. THE Sistema SHALL presentar al líder la lista de Miembro_CdP vigentes de su Casa_De_Paz para que marque los presentes.
4. THE Sistema SHALL permitir agregar como Asistente a una Persona que no es Miembro_CdP de esa Casa_De_Paz.
5. THE Sistema SHALL permitir registrar una Persona nueva mediante Alta_Rapida desde el formulario de asistencia.
6. THE Sistema SHALL exigir en el Alta_Rapida únicamente `primer_nombre`, `primer_apellido` y `sexo`.
7. THE Sistema SHALL marcar cada Asistencia como Miembro_CdP o Visita, según la membresía vigente de la Persona en esa Casa_De_Paz.
8. THE Sistema SHALL exigir que la Persona y la Casa_De_Paz de una Asistencia pertenezcan a la misma Iglesia.
9. THE Sistema SHALL registrar la ausencia de forma implícita: un Miembro_CdP vigente sin fila de Asistencia en un Reporte estuvo ausente.

### Requisito 3: Totales de asistencia

**Historia:** Como líder de red, quiero ver cuántos menores y cuántos mayores asistieron, sin que nadie tenga que contarlos a mano.

#### Criterios de aceptación

1. THE Sistema SHALL calcular el total de Menores y el total de Mayores de un Reporte a partir de sus Asistencias.
2. THE Sistema SHALL NOT permitir que el usuario escriba los totales a mano.
3. THE Sistema SHALL clasificar a un Asistente como Menor o Mayor según su edad en la `fecha_reunion`.
4. WHERE una Persona no tiene `fecha_nacimiento`, THE Sistema SHALL usar el campo `es_menor` de la Asistencia para clasificarla.
5. THE Sistema SHALL exigir `es_menor` cuando la Persona no tiene `fecha_nacimiento`.
6. WHERE una Persona tiene `fecha_nacimiento`, THE Sistema SHALL ignorar `es_menor` y calcular la edad.
7. THE Sistema SHALL usar 12 años como frontera entre Menor y Mayor, tomando el valor del criterio configurable `EDAD_MINIMA_CREYENTE`.

### Requisito 4: Libros y temas

**Historia:** Como líder, quiero elegir el tema de la lista, no escribirlo, para que los reportes sean comparables entre casas.

#### Criterios de aceptación

1. THE Sistema SHALL modelar el Libro como Catalogo, con 7 filas numeradas del 1 al 7.
2. THE Sistema SHALL modelar el Tema como Catalogo, asociado a un Libro, con `numero` y `nombre`.
3. THE Sistema SHALL admitir hasta 52 Temas por Libro, uno por semana del año.
4. THE Sistema SHALL permitir al Supervisor agregar, editar y desactivar Temas.
5. THE Sistema SHALL permitir un Tema marcado como especial, para reuniones fuera de lo cotidiano.
6. WHERE el Reporte usa un Tema especial, THE Sistema SHALL permitir describirlo en texto libre.
7. IF el `tema_id` de un Reporte no pertenece al `libro_id` de ese Reporte, THEN THE Sistema SHALL rechazar la operación.

### Requisito 5: Evangelizados

**Historia:** Como supervisor, quiero saber si lo que el líder declara coincide con lo que registró, para detectar reportes inflados.

#### Criterios de aceptación

1. THE Sistema SHALL permitir al líder declarar la cantidad de evangelizados de la salida como Evangelizados_Declarados.
2. THE Sistema SHALL calcular los Evangelizados_Registrados como el conteo de registros de evangelismo de esa Casa_De_Paz con esa `fecha_reunion`.
3. THE Sistema SHALL exponer ambos valores por separado, y SHALL NOT sobrescribir uno con el otro.
4. IF Evangelizados_Declarados difiere de Evangelizados_Registrados, THEN THE Sistema SHALL exponer la discrepancia en las alertas del Supervisor.
5. IF `salio_evangelizar = false` y Evangelizados_Declarados es mayor que cero, THEN THE Sistema SHALL rechazar la operación.
6. THE Sistema SHALL permitir Evangelizados_Declarados nulo cuando `salio_evangelizar = false`.

### Requisito 6: Edición

**Historia:** Como supervisor, quiero decidir si el sublíder puede corregir un reporte ya enviado.

#### Criterios de aceptación

1. THE Sistema SHALL permitir al Líder de CdP editar los Reportes de su Casa_De_Paz.
2. THE Sistema SHALL permitir al Sublíder editar un Reporte enviado únicamente si la configuración de la Iglesia lo habilita.
3. THE Sistema SHALL registrar toda edición en los campos de auditoría.
4. WHERE un Reporte se edita, THE Sistema SHALL recalcular los totales y los estados derivados.
5. THE Sistema SHALL permitir al Supervisor editar cualquier Reporte de su Iglesia.

### Requisito 7: Reportes faltantes

**Historia:** Como líder de red, quiero ver en rojo qué casas no reportaron esta semana, para saber a quién llamar.

#### Criterios de aceptación

1. THE Sistema SHALL exponer, para una Red y una semana, las Casas de Paz activas sin Reporte vigente.
2. THE Sistema SHALL definir la semana como el intervalo de lunes a domingo.
3. THE Sistema SHALL excluir del cálculo las Casas de Paz con `activo = false`.
4. THE Sistema SHALL exponer el mismo cálculo a nivel de Iglesia para el Supervisor.
