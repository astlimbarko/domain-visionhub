# Requisitos — Calendario y Eventos

## Introducción

Eventos ministeriales de la Casa de Paz, con vista mensual y semanal, cumpleaños automáticos y notificaciones.

`software/modulos.md` no lista este módulo entre los 9 componentes del Módulo 1, pero el frontend ya está construido (`iu/calendario-eventos/`, `iu/eventos-rango-fechas/`). Entra ahora para que ese front tenga datos que consumir. Estos requisitos se alinean con lo que espera.

## Glosario

- **Evento**: Actividad programada, asociada a una Casa_De_Paz, con tipo, fecha y hora.
- **Tipo_Evento**: Categoría de evento ministerial. Catalogo con nombre, ícono, descripción y color.
- **Evento_Un_Dia**: Evento sin `fecha_fin`, o con `fecha_fin` igual a `fecha_inicio`.
- **Evento_Multi_Dia**: Evento cuya `fecha_fin` es posterior a `fecha_inicio`. Por ejemplo un retiro.
- **Rango_Valido**: Rango cuya fecha y hora de fin es posterior o igual a la de inicio.
- **Cumpleano_Automatico**: Evento derivado de `persona.fecha_nacimiento`. No se almacena como Evento.
- **Mega_Fiesta**: Evento donde todas las Casas de Paz de una Red se congregan. Lo crea el Líder de Red.

## Requisitos

### Requisito 1: Tipos de evento

**Historia:** Como administrador, quiero un catálogo de tipos de evento para que los líderes clasifiquen bien sus actividades.

#### Criterios de aceptación

1. THE Sistema SHALL sembrar los Tipo_Evento: `RMS`, `AVIVATE`, `ELITE_LINAJE_ESCOGIDO`, `MUJERES_DEL_AHORA`, `MOS`, `REUNION`, `MEGA_FIESTA` y `CUMPLEANOS` (nombres confirmados por el owner, ver [design.md](design.md)).
2. THE Sistema SHALL registrar de cada Tipo_Evento: `codigo`, `nombre`, `icono`, `descripcion`, `color`, `activo` y `orden`.
3. THE Sistema SHALL almacenar `color` en formato hexadecimal de seis dígitos con almohadilla.
4. THE Sistema SHALL almacenar `icono` como referencia a un archivo PNG, no como binario.
5. THE Sistema SHALL mantener la integridad referencial entre Evento y Tipo_Evento.
6. THE Sistema SHALL permitir al Supervisor agregar Tipo_Evento propios de su Iglesia.
7. IF un Tipo_Evento está referenciado por al menos un Evento vigente, THEN THE Sistema SHALL impedir su borrado lógico.

### Requisito 2: Eventos

**Historia:** Como líder, quiero agendar las actividades de mi casa de paz.

#### Criterios de aceptación

1. THE Sistema SHALL registrar de cada Evento: `casa_de_paz_id`, `tipo_evento_id`, `titulo`, `descripcion`, `fecha_inicio`, `fecha_fin`, `hora_inicio`, `hora_fin` e `iglesia_id`.
2. THE Sistema SHALL exigir `casa_de_paz_id`, `tipo_evento_id`, `titulo` y `fecha_inicio`.
3. THE Sistema SHALL permitir `fecha_fin`, `hora_inicio` y `hora_fin` nulas.
4. IF `fecha_fin` es anterior a `fecha_inicio`, THEN THE Sistema SHALL rechazar la operación.
5. IF `fecha_inicio` es igual a `fecha_fin` y `hora_fin` es anterior a `hora_inicio`, THEN THE Sistema SHALL rechazar la operación.
6. WHERE `fecha_fin` es posterior a `fecha_inicio`, THE Sistema SHALL permitir que `hora_fin` sea anterior a `hora_inicio`: un retiro puede empezar el viernes a las 18:00 y terminar el domingo a las 12:00.
7. THE Sistema SHALL permitir crear Eventos con fecha pasada, para registrar lo ya ocurrido.
8. THE Sistema SHALL permitir al Líder y al Sublíder de la Casa_De_Paz crear Eventos de su Casa_De_Paz.
9. IF un Usuario que no es Líder ni Sublíder vigente de esa Casa_De_Paz ni Rol_Superior intenta crear un Evento suyo, THEN THE Sistema SHALL rechazar la operación.
10. THE Sistema SHALL permitir al Líder editar y eliminar lógicamente cualquier Evento de su Casa_De_Paz.

### Requisito 3: Consulta por rango

**Historia:** Como líder, quiero ver el calendario del mes o de la semana.

#### Criterios de aceptación

1. THE Sistema SHALL exponer los Eventos de una Casa_De_Paz que se intersecan con un rango de fechas.
2. THE Sistema SHALL incluir en el resultado todo Evento_Multi_Dia que se interseca parcialmente con el rango, aunque empiece antes o termine después.
3. THE Sistema SHALL exponer los Eventos de una Red y de una Iglesia, para los Rol_Superior.
4. THE Sistema SHALL permitir filtrar por Tipo_Evento.
5. THE Sistema SHALL ordenar los Eventos por `fecha_inicio` y luego por `hora_inicio`, con los nulos al final.

### Requisito 4: Cumpleaños

**Historia:** Como líder, quiero ver los cumpleaños de mis miembros en el calendario sin tener que cargarlos.

#### Criterios de aceptación

1. THE Sistema SHALL derivar los Cumpleano_Automatico de `persona.fecha_nacimiento`.
2. THE Sistema SHALL NOT almacenar los Cumpleano_Automatico como filas de Evento.
3. THE Sistema SHALL exponer los Cumpleano_Automatico de los Miembro_CdP vigentes de una Casa_De_Paz para un rango de fechas.
4. THE Sistema SHALL calcular el cumpleaños de cada año a partir del mes y el día, ignorando el año de nacimiento.
5. WHERE una Persona no tiene `fecha_nacimiento`, THE Sistema SHALL excluirla de los Cumpleano_Automatico.
6. THE Sistema SHALL exponer la edad que cumple la Persona.
7. WHERE la fecha de nacimiento es 29 de febrero, THE Sistema SHALL exponer el cumpleaños el 28 de febrero en los años no bisiestos.

### Requisito 5: Mega Fiesta

**Historia:** Como líder de red, quiero crear la Mega Fiesta donde se juntan todas mis casas de paz.

#### Criterios de aceptación

1. THE Sistema SHALL permitir únicamente al Líder de Red y a los Rol_Superior crear Eventos de tipo `MEGA_FIESTA`.
2. IF un Líder de CdP intenta crear un Evento de tipo `MEGA_FIESTA`, THEN THE Sistema SHALL rechazar la operación.
3. WHEN se crea una `MEGA_FIESTA` de una Red, THE Sistema SHALL exponerla en el calendario de todas las Casas de Paz vigentes de esa Red.
4. THE Sistema SHALL asociar la `MEGA_FIESTA` a una Red y no a una Casa_De_Paz.

### Requisito 6: Notificaciones

**Historia:** Como líder, quiero que me avisen de lo que viene.

#### Criterios de aceptación

1. THE Sistema SHALL exponer los Eventos próximos de una Casa_De_Paz dentro de una ventana de días configurable.
2. THE Sistema SHALL definir `DIAS_AVISO_EVENTO` con valor por defecto 7.
3. THE Sistema SHALL exponer los Cumpleano_Automatico próximos en la misma ventana.
4. THE Sistema SHALL permitir al Supervisor configurar qué notificaciones recibe cada rol.
5. THE Sistema SHALL exponer las notificaciones como consulta, y SHALL NOT enviar correos ni mensajes en el Módulo 1.
