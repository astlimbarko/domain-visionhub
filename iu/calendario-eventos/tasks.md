# Plan de Implementación: Módulo de Calendario/Eventos

## Descripción General

Este plan implementa el módulo completo de Calendario/Eventos para VisionHub, incluyendo gestión de eventos ministeriales, cumpleaños automáticos, vistas de calendario mensual/semanal, sistema de notificaciones y control de permisos diferenciados entre líderes y sublíderes.

## Tareas de Implementación

- [x] 1. Configurar migraciones de base de datos y schema Prisma
  - Crear migración para tabla `tipo_evento` con campos: id, nombre, icono, descripcion, color y campos de auditoría
  - Crear migración para tabla `evento` con campos: id, casa_de_paz_id, tipo_evento_id, titulo, descripcion, fecha_evento, hora_evento, todo_el_dia, notificado y campos de auditoría
  - Agregar índices para optimizar consultas: idx_evento_calendario, idx_evento_notificado, idx_evento_fecha
  - Agregar constraints: chk_fecha_evento (fecha >= CURRENT_DATE), chk_hora_todo_dia (validación hora según todo_el_dia)
  - Actualizar schema.prisma con modelos TipoEvento y Evento incluyendo relaciones con CasaDePaz
  - Crear seed para insertar 8 tipos de evento predefinidos (RMS, AVIVATE, HOMBRES, DEBORAS, MOS, Reuniones, Mega Fiesta, Cumpleaños)
  - _Requisitos: 1.1, 1.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 2. Implementar módulo backend de Calendario
  - [x] 2.1 Crear estructura del módulo NestJS
    - Crear `calendario.module.ts` con imports de PrismaModule, NotificacionesModule, PersonasModule, ScheduleModule
    - Crear `calendario.controller.ts` con decoradores de autenticación y guards
    - Crear `calendario.service.ts` con inyección de PrismaService
    - Exportar CalendarioService para uso en otros módulos
    - _Requisitos: 15.1_

  - [x] 2.2 Crear DTOs de validación
    - Crear `dto/create-evento.dto.ts` con validaciones: casaDePazId, tipoEventoId, titulo (max 200), descripcion, fechaEvento, horaEvento (formato HH:MM), todoElDia
    - Crear `dto/update-evento.dto.ts` como PartialType de CreateEventoDto
    - Crear `dto/filter-eventos.dto.ts` con campos opcionales: casaDePazId, tipoEventoIds[], fechaDesde, fechaHasta
    - Aplicar decoradores de class-validator en todos los DTOs
    - _Requisitos: 2.1, 2.5, 2.6, 3.1_

  - [x] 2.3 Implementar endpoints de Tipos de Evento
    - GET /api/calendario/tipos-evento - Listar todos los tipos activos
    - GET /api/calendario/tipos-evento/:id - Obtener tipo específico
    - Implementar métodos en service: getTiposEvento(), getTipoEventoById()
    - Excluir tipos con deletedAt no nulo
    - _Requisitos: 1.3_

  - [x] 2.4 Implementar CRUD de Eventos
    - POST /api/calendario/eventos - Crear evento con validación de permisos por rol
    - PUT /api/calendario/eventos/:id - Editar evento (solo líderes)
    - DELETE /api/calendario/eventos/:id - Eliminación lógica (solo líderes)
    - GET /api/calendario/eventos/:id - Obtener evento específico
    - GET /api/calendario/eventos - Listar eventos con filtros
    - Implementar métodos en service: createEvento(), updateEvento(), deleteEvento(), getEventoById(), getEventos()
    - Aplicar guards de autenticación y autorización en todos los endpoints
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.5 Escribir property test para campos de auditoría
    - **Property 2: Campos de auditoría en creación**
    - **Valida: Requisitos 2.3**

  - [ ]* 2.6 Escribir property test para exclusión de eventos eliminados
    - **Property 9: Exclusión de eventos eliminados**
    - **Valida: Requisitos 4.2, 5.2**

  - [ ]* 2.7 Escribir property test para ordenamiento por fecha
    - **Property 12: Ordenamiento por fecha ascendente**
    - **Valida: Requisitos 5.3**

- [ ] 3. Implementar sistema de permisos y validaciones
  - [x] 3.1 Crear guards de autorización
    - Crear `guards/calendario.guard.ts` para validar pertenencia a casa de paz
    - Implementar verificación de rol (LIDER_CDP vs SUBLIDER_CDP)
    - Aplicar guard en endpoints de edición y eliminación
    - _Requisitos: 3.3, 4.3, 12.4, 13.5_

  - [x] 3.2 Implementar validaciones de permisos en service
    - Método validarPermisoCreacion(): verificar rol y tipo de evento permitido
    - Método validarPermisoEdicion(): solo líderes pueden editar
    - Método validarPermisoEliminacion(): solo líderes pueden eliminar
    - Método validarPermisoCasaDePaz(): verificar pertenencia a casa de paz
    - Lanzar excepciones apropiadas (ForbiddenException, UnauthorizedException)
    - _Requisitos: 12.1, 12.2, 12.3, 13.2, 13.3, 13.4_

  - [ ]* 3.3 Escribir property test para permisos de líder
    - **Property 28: Líder puede crear cualquier tipo de evento**
    - **Valida: Requisitos 12.1**

  - [ ]* 3.4 Escribir property test para permisos de sublíder
    - **Property 33: Sublíder puede crear tipos específicos**
    - **Property 34: Sublíder no puede crear tipos restringidos**
    - **Valida: Requisitos 13.2, 13.3**

- [ ] 4. Implementar integración con módulo de Personas para cumpleaños
  - [x] 4.1 Crear métodos de generación de cumpleaños
    - Método getCumpleanosMes(): consultar personas con nacimiento_fecha en casa de paz
    - Método generarEventoCumpleanos(): crear objeto CumpleanosEvento con datos de persona
    - Implementar lógica para 29 de febrero en años no bisiestos (mostrar 28 de febrero)
    - Método esAnioBisiesto(): validar si año es bisiesto
    - Método formatNombreCompleto(): concatenar nombres y apellidos
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [x] 4.2 Implementar endpoint de cumpleaños
    - GET /api/calendario/cumpleanos - Listar cumpleaños del mes con parámetros año, mes, casaDePazId
    - Combinar eventos regulares con cumpleaños en vistas de calendario
    - _Requisitos: 9.1_

  - [ ]* 4.3 Escribir property test para generación de cumpleaños
    - **Property 19: Generación de cumpleaños automáticos**
    - **Valida: Requisitos 9.1**

  - [ ]* 4.4 Escribir unit test para caso edge de 29 de febrero
    - Crear persona con cumpleaños 29 de febrero
    - Verificar que en año no bisiesto se muestra el 28 de febrero
    - _Requisitos: 9.4_

- [ ] 5. Implementar vistas de calendario
  - [x] 5.1 Crear endpoints de vistas
    - GET /api/calendario/mensual - Vista mensual con parámetros: año, mes, filtros (tipos de evento)
    - GET /api/calendario/semanal - Vista semanal con parámetros: año, semana, filtros
    - Implementar métodos en service: getEventosMensual(), getEventosSemanales()
    - Combinar eventos regulares con cumpleaños automáticos en ambas vistas
    - Aplicar filtros por tipo de evento cuando se especifiquen
    - _Requisitos: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_

  - [ ]* 5.2 Escribir property test para filtrado por tipo
    - **Property 17: Filtrado por tipo de evento**
    - **Valida: Requisitos 8.1**

- [x] 6. Checkpoint - Verificar funcionalidad backend
  - Ejecutar migraciones y seed de tipos de evento
  - Probar endpoints de CRUD con Postman/Insomnia
  - Verificar permisos de líder y sublíder
  - Verificar generación de cumpleaños
  - Asegurar que todos los tests pasen
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [ ] 7. Implementar sistema de notificaciones con job scheduler
  - [x] 7.1 Crear job de notificaciones
    - Crear `jobs/notificaciones-eventos.job.ts` con decorador @Cron('0 8 * * *')
    - Configurar timezone 'America/La_Paz' en el cron job
    - Método enviarNotificacionesEventos(): orquestar notificaciones de eventos y cumpleaños
    - Método notificarEventosProximos(): obtener eventos del día siguiente no notificados
    - Método notificarCumpleanosDelDia(): obtener cumpleaños del día actual
    - Método generarMensajeEvento(): formatear mensaje con tipo, título, fecha y hora
    - Implementar logging con Logger de NestJS
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4_

  - [x] 7.2 Crear métodos auxiliares en service
    - Método getEventosPendientesNotificacion(): consultar eventos con notificado=false
    - Método marcarComoNotificado(): actualizar campo notificado a true
    - Método getUsuariosCasaDePaz(): obtener líder y sublíderes activos de casa de paz
    - Método getCasasDePazActivas(): listar todas las casas de paz sin deletedAt
    - _Requisitos: 10.1, 11.1_

  - [x] 7.3 Integrar con módulo de Notificaciones
    - Llamar a notificacionesService.create() para cada notificación
    - Crear notificaciones tipo 'EVENTO_PROXIMO' con metadata del evento
    - Crear notificaciones tipo 'CUMPLEANOS' con metadata de la persona
    - Enviar notificación a cada usuario (líder y sublíderes) de la casa de paz
    - _Requisitos: 10.1, 10.2, 11.1, 11.2_

  - [ ]* 7.4 Escribir property test para notificaciones únicas
    - **Property 24: Notificación única por evento**
    - **Valida: Requisitos 10.3**

  - [ ]* 7.5 Escribir integration test para notificaciones
    - Crear evento para mañana
    - Ejecutar job de notificaciones
    - Verificar que se crearon notificaciones para líder y sublíderes
    - _Requisitos: 10.1, 10.2_

- [x] 8. Implementar tipos TypeScript para frontend
  - Crear `types/calendario.types.ts` con interfaces:
    - TipoEvento: id, nombre, icono, descripcion, color
    - Evento: id, casaDePazId, tipoEventoId, tipoEvento, titulo, descripcion, fechaEvento, horaEvento, todoElDia, createdAt, createdBy, updatedAt, updatedBy
    - EventoCalendario: extends Evento con esCumpleanos, personaNombre
    - CumpleanosEvento: id, personaId, personaNombre, fechaNacimiento, fechaEvento, edad, tipoEvento
    - DiaCalendario: fecha, esDelMesActual, esHoy, eventos
    - CreateEventoForm: tipoEventoId, titulo, descripcion, fechaEvento, horaEvento, todoElDia
    - UpdateEventoForm: Partial<CreateEventoForm>
  - _Requisitos: Todos_

- [ ] 9. Implementar servicio de API en frontend
  - [x] 9.1 Crear calendario.service.ts
    - Configurar axios con baseURL '/api/calendario'
    - Método getTiposEvento(): GET /tipos-evento
    - Método createEvento(): POST /eventos
    - Método updateEvento(): PUT /eventos/:id
    - Método deleteEvento(): DELETE /eventos/:id
    - Método getEventos(): GET /eventos con filtros
    - Método getEventosMensual(): GET /mensual con año, mes, filtros
    - Método getEventosSemanales(): GET /semanal con año, semana, filtros
    - Implementar manejo de errores con try-catch y mensajes específicos por código HTTP
    - _Requisitos: Todos_

  - [x] 9.2 Crear custom hooks con React Query
    - Hook useTiposEvento(): consultar tipos de evento con cache
    - Hook useEventosMensual(): consultar eventos de vista mensual
    - Hook useEventosSemanales(): consultar eventos de vista semanal
    - Hook useCreateEvento(): mutación para crear evento con invalidación de cache
    - Hook useUpdateEvento(): mutación para editar evento
    - Hook useDeleteEvento(): mutación para eliminar evento
    - _Requisitos: Todos_

- [x] 10. Implementar componentes de calendario
  - [x] 10.1 Crear componente CalendarioMensual
    - Renderizar grid de 7 columnas (días de la semana)
    - Generar días del mes incluyendo días de meses anterior/posterior para completar semanas
    - Mostrar eventos del día con icono y título
    - Resaltar día actual con clase CSS especial
    - Implementar navegación entre meses (botones anterior/siguiente)
    - Hacer eventos clickeables para abrir modal de detalles
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 10.2 Crear componente CalendarioSemanal
    - Renderizar grid con columna de horas (00:00 - 23:00) y 7 columnas de días
    - Generar días de la semana actual
    - Mostrar eventos con hora, icono y título posicionados según hora_evento
    - Manejar eventos de todo el día en sección especial
    - Implementar navegación entre semanas
    - Ordenar eventos del día por hora de inicio
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.3 Crear componente FiltroTipos
    - Obtener tipos de evento con useTiposEvento()
    - Renderizar botones/chips para cada tipo con icono y nombre
    - Aplicar color del tipo cuando está activo
    - Implementar toggle para activar/desactivar filtros
    - Permitir selección múltiple de tipos
    - Emitir cambios al componente padre mediante callback
    - _Requisitos: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.4 Crear componente EventoCard
    - Mostrar icono del tipo de evento
    - Mostrar título del evento
    - Mostrar fecha y hora (si no es todo el día)
    - Aplicar estilos diferenciados para cumpleaños
    - Hacer card clickeable para abrir modal
    - _Requisitos: 6.2, 7.2_

  - [x] 10.5 Escribir component tests para CalendarioMensual
    - Test: debe mostrar todos los días del mes actual
    - Test: debe resaltar el día actual
    - Test: debe mostrar eventos con icono y título
    - _Requisitos: 6.1, 6.2, 6.4_

  - [x] 10.6 Escribir component tests para FiltroTipos
    - Test: debe permitir seleccionar múltiples tipos
    - Test: debe aplicar color cuando filtro está activo
    - _Requisitos: 8.1, 8.2_

- [x] 11. Implementar formularios y modales de eventos
  - [x] 11.1 Crear componente EventoModal
    - Implementar modos: 'crear', 'editar', 'ver'
    - Mostrar EventoForm en modos crear/editar
    - Mostrar EventoDetalle en modo ver
    - Validar permisos: solo líderes pueden editar/eliminar
    - Sublíderes solo pueden crear tipos permitidos (RMS, AVIVATE, HOMBRES, DEBORAS, MOS)
    - Implementar botones de acción según permisos y modo
    - _Requisitos: 2.1, 3.1, 12.1, 12.2, 13.2, 13.3, 13.4_

  - [x] 11.2 Crear componente EventoForm
    - Usar react-hook-form con zod para validación
    - Campo select para tipo de evento (filtrar según rol si es sublíder)
    - Campo input para título (max 200 caracteres)
    - Campo textarea para descripción
    - Campo date picker para fecha (min: fecha actual)
    - Campo time picker para hora (solo si todo_el_dia es false)
    - Campo checkbox para todo_el_dia
    - Validar que fecha no sea anterior a hoy
    - Validar que hora sea requerida si todo_el_dia es false
    - Mostrar mensajes de error de validación
    - _Requisitos: 2.1, 2.4, 2.5, 2.6, 3.1_

  - [x] 11.3 Crear componente EventoDetalle
    - Mostrar icono y nombre del tipo de evento
    - Mostrar título del evento
    - Mostrar descripción
    - Mostrar fecha formateada
    - Mostrar hora (si no es todo el día)
    - Mostrar badge "Todo el día" si aplica
    - Mostrar información de auditoría (creado por, fecha)
    - _Requisitos: 5.4_

  - [x] 11.4 Integrar formularios con mutations
    - Llamar useCreateEvento() al enviar formulario de creación
    - Llamar useUpdateEvento() al enviar formulario de edición
    - Mostrar toast de éxito/error según resultado
    - Cerrar modal y refrescar calendario después de operación exitosa
    - Manejar errores de validación del backend
    - _Requisitos: 2.1, 3.1_

- [x] 12. Implementar página principal de Calendario
  - [x] 12.1 Crear componente CalendarioPage
    - Implementar estado para vista actual (mensual/semanal)
    - Implementar estado para fecha actual
    - Implementar estado para filtros activos
    - Renderizar CalendarioHeader con controles de navegación
    - Renderizar FiltroTipos
    - Renderizar CalendarioMensual o CalendarioSemanal según vista activa
    - Implementar botón flotante "+" para crear evento (solo si tiene permisos)
    - _Requisitos: 6.1, 7.1, 8.1_

  - [x] 12.2 Crear componente CalendarioHeader
    - Botones para cambiar entre vista mensual/semanal
    - Mostrar mes/año actual o semana actual según vista
    - Botones de navegación anterior/siguiente
    - Botón "Hoy" para volver a fecha actual
    - _Requisitos: 6.3, 7.3_

  - [x] 12.3 Agregar ruta en router
    - Agregar ruta /calendario en react-router-dom
    - Proteger ruta con guard de autenticación
    - Verificar que usuario tenga rol LIDER_CDP o SUBLIDER_CDP
    - _Requisitos: 14.3_

- [x] 13. Integrar módulo en navegación principal
  - Agregar opción "Calendario" en sidebar de navegación
  - Usar icono de calendario (lucide-react: Calendar)
  - Resaltar opción cuando ruta activa es /calendario
  - Mostrar opción solo para usuarios con rol LIDER_CDP o SUBLIDER_CDP
  - _Requisitos: 14.1, 14.2, 14.4_

- [x] 14. Agregar iconos de tipos de evento
  - Crear o descargar iconos PNG para cada tipo de evento
  - Guardar iconos en directorio `frontend/public/icons/`
  - Nombres de archivos: rms.png, avivate.png, hombres.png, deboras.png, mos.png, reuniones.png, mega-fiesta.png, cumpleanos.png
  - Actualizar seed de tipos de evento con rutas correctas
  - _Requisitos: 1.2_

- [x] 15. Implementar manejo de errores y validaciones
  - [x] 15.1 Crear clases de excepciones personalizadas en backend
    - EventoValidationError para errores de validación (400)
    - EventoAuthorizationError para errores de permisos (403)
    - EventoBusinessError para errores de lógica de negocio (400)
    - EventoNotFoundError para recursos no encontrados (404)
    - _Requisitos: Todos_

  - [x] 15.2 Implementar interceptor de errores en frontend
    - Capturar errores de axios
    - Mostrar mensajes de error apropiados según código HTTP
    - Mostrar toast con mensaje de error
    - Logging de errores en consola para debugging
    - _Requisitos: Todos_

- [-] 16. Checkpoint final - Pruebas de integración completas
  - Verificar flujo completo de creación de evento como líder
  - Verificar flujo completo de creación de evento como sublíder (con restricciones)
  - Verificar que sublíder no puede editar ni eliminar eventos
  - Verificar vista mensual con eventos y cumpleaños
  - Verificar vista semanal con eventos ordenados por hora
  - Verificar filtrado por tipo de evento
  - Verificar que job de notificaciones se ejecuta correctamente
  - Verificar que notificaciones se crean para eventos del día siguiente
  - Verificar que notificaciones de cumpleaños se crean correctamente
  - Asegurar que todos los tests pasen
  - Preguntar al usuario si hay ajustes finales necesarios

## Notas Importantes

- Las tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos que implementa para trazabilidad
- Los checkpoints permiten validar progreso incremental y resolver dudas
- Los property tests validan propiedades universales de corrección
- Los unit tests validan casos específicos y edge cases
- El sistema usa eliminación lógica (soft delete) para mantener historial
- Los permisos están diferenciados: líderes tienen control completo, sublíderes solo pueden ver y crear ciertos tipos
- El job scheduler se ejecuta diariamente a las 08:00 AM (timezone America/La_Paz)
- Los cumpleaños se generan automáticamente desde el módulo de personas
- El caso especial de 29 de febrero en años no bisiestos se maneja mostrando el 28 de febrero
