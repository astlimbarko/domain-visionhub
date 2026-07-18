# Requirements Document

## Introduction

Este documento define los requisitos para el módulo de Calendario/Eventos del sistema VisionHub. El módulo permitirá a los líderes y sublíderes de Casas de Paz gestionar eventos ministeriales, visualizar cumpleaños de miembros, y recibir notificaciones sobre actividades próximas. El sistema incluye un catálogo predefinido de tipos de eventos ministeriales y proporciona vistas de calendario mensual y semanal con capacidades de filtrado.

## Glossary

- **Sistema_Calendario**: El módulo de calendario y eventos dentro de VisionHub
- **Evento**: Una actividad programada asociada a una Casa de Paz con fecha, hora y tipo específico
- **Tipo_Evento**: Categoría predefinida de evento ministerial (RMS, AVIVATE, HOMBRES, etc.)
- **Casa_de_Paz**: Grupo ministerial al cual pertenecen los eventos y personas
- **Líder**: Usuario con permisos completos sobre eventos de su Casa de Paz
- **Sublíder**: Usuario con permisos limitados para ver y crear ciertos tipos de eventos
- **Cumpleaños_Automático**: Evento generado automáticamente desde la fecha de nacimiento en la tabla personas
- **Vista_Calendario**: Interfaz visual que muestra eventos en formato mensual o semanal
- **Notificación_Evento**: Alerta enviada a usuarios sobre eventos próximos o cumpleaños

## Requirements

### Requirement 1: Gestión de Tipos de Evento

**User Story:** Como administrador del sistema, quiero tener un catálogo predefinido de tipos de eventos ministeriales, para que los líderes puedan clasificar sus actividades correctamente.

#### Acceptance Criteria

1. THE Sistema_Calendario SHALL almacenar los siguientes tipos de evento: RMS, AVIVATE, HOMBRES, DEBORAS, MOS, Reuniones, Mega Fiesta de Casa de Paz, y Cumpleaños
2. FOR EACH Tipo_Evento, THE Sistema_Calendario SHALL almacenar nombre, icono en formato PNG, descripción y color
3. THE Sistema_Calendario SHALL proporcionar el catálogo de Tipo_Evento para selección durante la creación de eventos
4. THE Sistema_Calendario SHALL mantener la integridad referencial entre eventos y sus tipos

### Requirement 2: Crear Eventos

**User Story:** Como líder de Casa de Paz, quiero crear eventos para mi grupo, para que los miembros conozcan las actividades programadas.

#### Acceptance Criteria

1. WHEN un Líder solicita crear un evento, THE Sistema_Calendario SHALL solicitar Casa_de_Paz, Tipo_Evento, título, fecha, hora, indicador de todo el día, y descripción
2. WHEN un Líder crea un evento, THE Sistema_Calendario SHALL asociar el evento únicamente a su Casa_de_Paz
3. WHEN un evento es creado, THE Sistema_Calendario SHALL registrar created_at, created_by, updated_at y updated_by
4. WHEN el campo todo_el_dia es verdadero, THE Sistema_Calendario SHALL permitir omitir la hora del evento
5. THE Sistema_Calendario SHALL validar que la fecha del evento no sea anterior a la fecha actual
6. THE Sistema_Calendario SHALL validar que todos los campos obligatorios estén completos antes de crear el evento

### Requirement 3: Editar Eventos

**User Story:** Como líder de Casa de Paz, quiero editar eventos existentes, para que pueda corregir información o actualizar detalles.

#### Acceptance Criteria

1. WHEN un Líder solicita editar un evento de su Casa_de_Paz, THE Sistema_Calendario SHALL permitir modificar Tipo_Evento, título, fecha, hora, todo_el_dia y descripción
2. WHEN un evento es editado, THE Sistema_Calendario SHALL actualizar updated_at y updated_by
3. WHEN un Líder intenta editar un evento de otra Casa_de_Paz, THE Sistema_Calendario SHALL denegar la operación
4. THE Sistema_Calendario SHALL preservar los campos de auditoría originales created_at y created_by

### Requirement 4: Eliminar Eventos

**User Story:** Como líder de Casa de Paz, quiero eliminar eventos cancelados, para que el calendario refleje solo actividades vigentes.

#### Acceptance Criteria

1. WHEN un Líder solicita eliminar un evento de su Casa_de_Paz, THE Sistema_Calendario SHALL realizar eliminación lógica estableciendo deleted_at y deleted_by
2. WHEN un evento es eliminado, THE Sistema_Calendario SHALL excluirlo de las vistas de calendario
3. WHEN un Líder intenta eliminar un evento de otra Casa_de_Paz, THE Sistema_Calendario SHALL denegar la operación
4. THE Sistema_Calendario SHALL preservar los datos del evento eliminado en la base de datos

### Requirement 5: Listar Eventos

**User Story:** Como líder o sublíder, quiero ver una lista de eventos de mi Casa de Paz, para que pueda revisar las actividades programadas.

#### Acceptance Criteria

1. WHEN un Líder o Sublíder solicita listar eventos, THE Sistema_Calendario SHALL mostrar únicamente eventos de su Casa_de_Paz
2. THE Sistema_Calendario SHALL excluir eventos con deleted_at no nulo de la lista
3. THE Sistema_Calendario SHALL ordenar eventos por fecha de forma ascendente
4. FOR EACH evento listado, THE Sistema_Calendario SHALL mostrar Tipo_Evento, título, fecha, hora y descripción

### Requirement 6: Vista Mensual de Calendario

**User Story:** Como usuario, quiero ver eventos en una vista mensual, para que pueda visualizar las actividades del mes completo.

#### Acceptance Criteria

1. WHEN un usuario accede a la Vista_Calendario mensual, THE Sistema_Calendario SHALL mostrar todos los días del mes actual
2. FOR EACH día con eventos, THE Sistema_Calendario SHALL mostrar los eventos asociados con su icono y título
3. THE Sistema_Calendario SHALL permitir navegar entre meses anteriores y posteriores
4. THE Sistema_Calendario SHALL resaltar el día actual en la vista mensual
5. WHEN un usuario selecciona un evento en la vista, THE Sistema_Calendario SHALL mostrar los detalles completos del evento

### Requirement 7: Vista Semanal de Calendario

**User Story:** Como usuario, quiero ver eventos en una vista semanal, para que pueda enfocarme en las actividades de la semana.

#### Acceptance Criteria

1. WHEN un usuario accede a la Vista_Calendario semanal, THE Sistema_Calendario SHALL mostrar los siete días de la semana actual
2. FOR EACH día con eventos, THE Sistema_Calendario SHALL mostrar los eventos con hora, icono y título
3. THE Sistema_Calendario SHALL permitir navegar entre semanas anteriores y posteriores
4. THE Sistema_Calendario SHALL ordenar eventos del día por hora de inicio

### Requirement 8: Filtrar Eventos por Tipo

**User Story:** Como usuario, quiero filtrar eventos por tipo, para que pueda enfocarme en categorías específicas de actividades.

#### Acceptance Criteria

1. WHEN un usuario aplica un filtro de Tipo_Evento, THE Sistema_Calendario SHALL mostrar únicamente eventos del tipo seleccionado
2. THE Sistema_Calendario SHALL permitir seleccionar múltiples tipos de evento simultáneamente
3. WHEN ningún filtro está activo, THE Sistema_Calendario SHALL mostrar todos los tipos de eventos
4. THE Sistema_Calendario SHALL mantener los filtros activos al navegar entre meses o semanas

### Requirement 9: Mostrar Cumpleaños Automáticamente

**User Story:** Como usuario, quiero ver cumpleaños de miembros en el calendario, para que pueda felicitarlos en su día especial.

#### Acceptance Criteria

1. FOR EACH persona con nacimiento_fecha definido en su Casa_de_Paz, THE Sistema_Calendario SHALL generar un Cumpleaños_Automático en la fecha correspondiente del año actual
2. THE Sistema_Calendario SHALL mostrar Cumpleaños_Automático con el Tipo_Evento "Cumpleaños" y el icono correspondiente
3. THE Sistema_Calendario SHALL incluir el nombre de la persona en el título del Cumpleaños_Automático
4. WHEN la fecha de nacimiento es 29 de febrero y el año actual no es bisiesto, THE Sistema_Calendario SHALL mostrar el cumpleaños el 28 de febrero
5. THE Sistema_Calendario SHALL actualizar Cumpleaños_Automático cuando nacimiento_fecha es modificado

### Requirement 10: Notificar Eventos Próximos

**User Story:** Como usuario, quiero recibir notificaciones de eventos próximos, para que no olvide actividades importantes.

#### Acceptance Criteria

1. WHEN un evento está programado para el día siguiente, THE Sistema_Calendario SHALL enviar una Notificación_Evento al Líder y Sublíder
2. THE Notificación_Evento SHALL incluir el tipo, título, fecha y hora del evento
3. THE Sistema_Calendario SHALL enviar notificaciones una única vez por evento
4. THE Sistema_Calendario SHALL enviar notificaciones a las 08:00 horas del día anterior al evento

### Requirement 11: Notificar Cumpleaños del Día

**User Story:** Como líder, quiero recibir notificaciones de cumpleaños del día, para que pueda felicitar a los miembros de mi Casa de Paz.

#### Acceptance Criteria

1. WHEN es el cumpleaños de una persona, THE Sistema_Calendario SHALL enviar una Notificación_Evento al Líder y Sublíder
2. THE Notificación_Evento SHALL incluir el nombre de la persona que cumple años
3. THE Sistema_Calendario SHALL enviar notificaciones de cumpleaños a las 08:00 horas del día correspondiente
4. THE Sistema_Calendario SHALL enviar una notificación por cada persona que cumple años en el día

### Requirement 12: Permisos de Líder

**User Story:** Como líder de Casa de Paz, quiero tener control completo sobre los eventos de mi grupo, para que pueda gestionar todas las actividades.

#### Acceptance Criteria

1. WHEN un usuario tiene rol de Líder, THE Sistema_Calendario SHALL permitir crear eventos de cualquier Tipo_Evento
2. WHEN un usuario tiene rol de Líder, THE Sistema_Calendario SHALL permitir editar todos los eventos de su Casa_de_Paz
3. WHEN un usuario tiene rol de Líder, THE Sistema_Calendario SHALL permitir eliminar todos los eventos de su Casa_de_Paz
4. THE Sistema_Calendario SHALL restringir operaciones del Líder únicamente a eventos de su Casa_de_Paz

### Requirement 13: Permisos de Sublíder

**User Story:** Como sublíder, quiero ver eventos y crear ciertos tipos específicos, para que pueda colaborar con la gestión de actividades.

#### Acceptance Criteria

1. WHEN un usuario tiene rol de Sublíder, THE Sistema_Calendario SHALL permitir visualizar todos los eventos de su Casa_de_Paz
2. WHEN un usuario tiene rol de Sublíder, THE Sistema_Calendario SHALL permitir crear eventos de tipo RMS, AVIVATE, HOMBRES, DEBORAS y MOS
3. WHEN un usuario tiene rol de Sublíder, THE Sistema_Calendario SHALL denegar la creación de eventos tipo Reuniones y Mega Fiesta de Casa de Paz
4. WHEN un usuario tiene rol de Sublíder, THE Sistema_Calendario SHALL denegar la edición y eliminación de eventos
5. THE Sistema_Calendario SHALL restringir operaciones del Sublíder únicamente a eventos de su Casa_de_Paz

### Requirement 14: Integración con Módulo de Navegación

**User Story:** Como usuario, quiero acceder al calendario desde el menú principal, para que pueda navegar fácilmente al módulo.

#### Acceptance Criteria

1. THE Sistema_Calendario SHALL agregar una opción "Calendario" en el sidebar de navegación
2. THE Sistema_Calendario SHALL mostrar un icono de calendario junto al texto del menú
3. WHEN un usuario selecciona la opción Calendario, THE Sistema_Calendario SHALL navegar a la vista mensual por defecto
4. THE Sistema_Calendario SHALL resaltar la opción Calendario en el menú cuando el usuario está en el módulo

### Requirement 15: Persistencia de Datos

**User Story:** Como administrador del sistema, quiero que los eventos se almacenen correctamente en la base de datos, para que la información persista de forma confiable.

#### Acceptance Criteria

1. THE Sistema_Calendario SHALL almacenar eventos en la tabla "evento" con los campos: id, casa_de_paz_id, tipo_evento_id, titulo, fecha_evento, hora_evento, todo_el_dia, descripcion
2. THE Sistema_Calendario SHALL almacenar campos de auditoría: created_at, updated_at, created_by, updated_by, deleted_at, deleted_by
3. THE Sistema_Calendario SHALL almacenar tipos de evento en la tabla "tipo_evento" con los campos: id, nombre, icono, descripcion, color
4. THE Sistema_Calendario SHALL establecer relación de clave foránea entre evento.tipo_evento_id y tipo_evento.id
5. THE Sistema_Calendario SHALL establecer relación de clave foránea entre evento.casa_de_paz_id y la tabla casas_de_paz
6. THE Sistema_Calendario SHALL utilizar tipo de dato DATE para fecha_evento y TIME para hora_evento
