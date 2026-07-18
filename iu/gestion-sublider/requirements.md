# Requisitos: Gestión de Sublíderes

## 1. Visión General

### 1.1 Propósito
Implementar un sistema completo de gestión de sublíderes que permita a los líderes de Casa de Paz delegar responsabilidades de reporte a miembros de confianza, manteniendo control y visibilidad sobre las actividades.

### 1.2 Alcance
- Asignación y remoción de sublíderes
- Sistema de permisos granular (habilitar/deshabilitar acceso)
- Vista simplificada para sublíderes (solo 2 módulos: Nuevo Reporte y Personas)
- Sistema de códigos de Casa de Paz en el header (F1, VN7, etc.)
- Selector de Casa de Paz para sublíderes con múltiples asignaciones
- Sistema de notificaciones específicas por Casa de Paz al líder correspondiente
- Autenticación y autorización basada en roles
- Soporte para sublíderes en múltiples Casas de Paz (misma red o diferentes redes)

### 1.3 Usuarios Objetivo
- **Líder de Casa de Paz**: Usuario principal que gestiona sublíderes de su Casa de Paz
- **Sublíder**: Miembro designado con permisos limitados para crear reportes y gestionar personas en una o más Casas de Paz

---

## 2. Requisitos Funcionales

### RF-001: Asignación de Sublíderes
**Prioridad**: Alta  
**Como** líder de Casa de Paz  
**Quiero** asignar a un miembro como sublíder  
**Para** delegar la responsabilidad de crear reportes semanales y gestionar personas

**Criterios de Aceptación**:
- El líder puede seleccionar cualquier miembro activo de su Casa de Paz
- Un sublíder puede ser asignado a múltiples Casas de Paz (misma red o diferentes redes)
- Al asignar un sublíder, se debe especificar:
  - Fecha de inicio del rol
  - Estado inicial (activo/inactivo)
  - Permisos de acceso (habilitado/deshabilitado)
- El sistema debe crear automáticamente credenciales de acceso para el sublíder (solo la primera vez)
- Si el miembro ya es sublíder de otra Casa de Paz, se reutilizan las credenciales existentes
- Se debe registrar en el historial quién asignó al sublíder y cuándo

**Reglas de Negocio**:
- Un miembro puede ser sublíder de múltiples Casas de Paz simultáneamente
- El líder principal no puede asignarse a sí mismo como sublíder de su propia Casa de Paz
- Solo miembros con estado SSVA activo pueden ser sublíderes
- La asignación debe quedar registrada en `sub_lider_casa_de_paz` con `casa_de_paz_id` específico
- Cada asignación es independiente (puede estar activo en una Casa de Paz e inactivo en otra)

---

### RF-002: Remoción de Sublíderes
**Prioridad**: Alta  
**Como** líder de Casa de Paz  
**Quiero** remover a un sublíder de su rol  
**Para** revocar sus permisos cuando ya no sea necesario

**Criterios de Aceptación**:
- El líder puede remover al sublíder activo en cualquier momento
- Al remover, se debe especificar:
  - Fecha de fin del rol
  - Motivo de remoción (opcional)
- El acceso del sublíder se desactiva inmediatamente
- El historial de reportes creados por el sublíder se mantiene
- Se registra quién removió al sublíder y cuándo

**Reglas de Negocio**:
- Solo se puede remover al sublíder activo actual
- La remoción es un soft delete (se marca `fecha_fin` y `estado_sub_lider_id`)
- El sublíder removido no puede acceder al sistema después de la remoción
- Los reportes creados por el sublíder permanecen visibles para el líder

---

### RF-003: Gestión de Permisos de Sublíder
**Prioridad**: Alta  
**Como** líder de Casa de Paz  
**Quiero** habilitar o deshabilitar el acceso del sublíder  
**Para** controlar cuándo puede crear reportes sin removerlo del rol

**Criterios de Aceptación**:
- El líder puede cambiar el estado de acceso del sublíder (habilitado/deshabilitado)
- Cuando está deshabilitado:
  - El sublíder no puede iniciar sesión
  - Se muestra mensaje: "Tu acceso ha sido temporalmente deshabilitado. Contacta al líder."
- Cuando está habilitado:
  - El sublíder puede iniciar sesión y crear reportes
- El cambio de estado es inmediato
- Se registra cada cambio de estado con fecha y usuario que lo realizó

**Reglas de Negocio**:
- Solo el líder principal puede cambiar el estado de acceso
- El estado se almacena en `estado_sub_lider` (activo/inactivo/suspendido)
- Los cambios de estado se registran en el historial

---

### RF-004: Creación de Credenciales para Sublíder
**Prioridad**: Alta  
**Como** sistema  
**Quiero** generar credenciales automáticas para el sublíder  
**Para** que pueda acceder a su vista dedicada

**Criterios de Aceptación**:
- Al asignar un sublíder, el sistema genera:
  - Username: `sublider.{primer_nombre}.{primer_apellido}` (lowercase, sin espacios)
  - Email: Si el miembro tiene email, se usa; si no, se genera: `sublider.{id}@casadepaz.local`
  - Password temporal: Se genera aleatoria (8 caracteres, incluye mayúsculas, minúsculas, números)
- Se crea registro en tabla `usuario` con:
  - `persona_id`: ID del miembro
  - `is_active`: true
  - `requiere_cambio_password`: true
- Se asigna rol `SUBLIDER_CDP` en `usuario_rol_sistema` con:
  - `casa_de_paz_id`: ID de la Casa de Paz
  - `fecha_inicio`: Fecha actual
- Las credenciales se muestran al líder una sola vez (debe copiarlas)
- El sublíder debe cambiar su password en el primer login

**Reglas de Negocio**:
- Si el username ya existe, se agrega un número secuencial: `sublider.juan.perez.2`
- El email debe ser único en la tabla `usuario`
- El password temporal debe cumplir política de seguridad (mínimo 8 caracteres)
- El rol `SUBLIDER_CDP` debe existir en `rol_sistema`

---

### RF-005: Vista de Sublíder - Sin Dashboard
**Prioridad**: Alta  
**Como** sublíder  
**Quiero** acceder solo a los módulos necesarios  
**Para** realizar mis tareas sin distracciones

**Criterios de Aceptación**:
- El sublíder NO tiene dashboard
- Al iniciar sesión, el sublíder ve directamente el módulo "Nuevo Reporte"
- La navegación lateral muestra solo:
  - Nuevo Reporte (módulo principal)
  - Personas (módulo secundario)
  - Cerrar Sesión
- No tiene acceso a:
  - Dashboard
  - Módulo de Evangelismo
  - Módulo de Gestión de Sublíderes
  - Historial de Asistencias
  - Estadísticas o KPIs
- El header muestra:
  - Selector de Casa de Paz (si tiene múltiples asignaciones)
  - Código de la Casa de Paz actual (ej: F1, VN7)
  - Nombre del líder de la Casa de Paz actual
  - Icono de usuario con opción de cerrar sesión

**Reglas de Negocio**:
- El sublíder solo ve datos de la Casa de Paz seleccionada actualmente
- Si solo tiene una Casa de Paz asignada, no se muestra el selector
- El código de Casa de Paz se obtiene de `casa_de_paz.codigo`
- La Casa de Paz por defecto es la primera asignada (orden alfabético por código)

---

### RF-005B: Selector de Casa de Paz en Header (Sublíder)
**Prioridad**: Alta  
**Como** sublíder asignado a múltiples Casas de Paz  
**Quiero** cambiar entre mis Casas de Paz asignadas  
**Para** crear reportes y gestionar personas de cada una

**Criterios de Aceptación**:
- En el header, se muestra el código de la Casa de Paz actual (ej: "F1", "VN7")
- Si el sublíder tiene múltiples asignaciones, el código es clickeable
- Al hacer clic, se despliega un dropdown con todas sus Casas de Paz:
  - Código de Casa de Paz
  - Nombre de la Red
  - Nombre del líder
  - Estado de acceso (habilitado/deshabilitado)
- Al seleccionar una Casa de Paz:
  - Se actualiza el contexto global
  - Se recarga la vista actual con datos de la nueva Casa de Paz
  - El código en el header se actualiza
- Las Casas de Paz deshabilitadas se muestran en gris con tooltip "Acceso deshabilitado"
- No se puede seleccionar una Casa de Paz deshabilitada

**Reglas de Negocio**:
- El selector solo aparece si el sublíder tiene 2 o más asignaciones activas
- Las Casas de Paz se ordenan por código (alfabéticamente)
- El cambio de Casa de Paz es instantáneo (sin recarga de página)
- La Casa de Paz seleccionada se guarda en localStorage
- Al cerrar sesión, se limpia la selección

---

### RF-006: Vista de Sublíder - Módulo Personas
**Prioridad**: Alta  
**Como** sublíder  
**Quiero** gestionar personas de la Casa de Paz  
**Para** agregar nuevos miembros y actualizar su información

**Criterios de Aceptación**:
- El módulo "Personas" es idéntico al del líder, incluyendo:
  - Lista de personas de la Casa de Paz actual
  - Botón "Agregar Persona"
  - Búsqueda por nombre
  - Ver detalle de persona
  - Cambiar estado SSVA
- El sublíder puede:
  - Ver todas las personas de la Casa de Paz seleccionada
  - Agregar nuevas personas
  - Ver detalles (información personal, SSVA, faltas consecutivas)
  - Cambiar estado SSVA de personas
- El sublíder NO puede:
  - Eliminar personas
  - Ver personas de otras Casas de Paz (solo la seleccionada)
- Todas las acciones quedan registradas con `created_by` = ID del usuario sublíder

**Reglas de Negocio**:
- El sublíder solo ve personas de la Casa de Paz seleccionada en el header
- Las personas agregadas por el sublíder se asocian a la Casa de Paz actual
- El líder puede ver quién agregó cada persona mediante `created_by`
- Los cambios de SSVA quedan auditados

---

### RF-007: Vista de Sublíder - Crear Reporte
**Prioridad**: Alta  
**Como** sublíder  
**Quiero** crear reportes de reunión  
**Para** registrar las actividades de la Casa de Paz cuando el líder no está presente

**Criterios de Aceptación**:
- El formulario de reporte es idéntico al del líder, incluyendo:
  - Fecha de reunión
  - Tema (dropdown con libros y temas)
  - Quien enseñó la palabra (texto libre)
  - Finanzas (ofrendas y diezmos)
  - Evangelismo (salida evangelística y personas evangelizadas)
  - Asistencia (regulares, nuevos, niños)
  - Narración
- Al guardar el reporte:
  - Se marca con `created_by` = ID del usuario sublíder
  - Se asocia a la Casa de Paz seleccionada en el header (`casa_de_paz_id`)
  - Se crea una notificación SOLO para el líder de esa Casa de Paz específica
  - Se muestra mensaje de éxito
  - Se redirige a "Nuevo Reporte" (limpio para crear otro)
- El sublíder puede seleccionar personas de la lista de miembros de la Casa de Paz actual
- El sublíder puede seleccionar temas de la lista disponible

**Reglas de Negocio**:
- El sublíder solo puede crear reportes si su acceso está habilitado para esa Casa de Paz
- No puede crear reportes con fecha futura
- No puede crear reportes duplicados (misma fecha para la misma Casa de Paz)
- El reporte se guarda en `casa_de_paz_reporte` con `casa_de_paz_id` de la Casa de Paz seleccionada
- La notificación se envía SOLO al líder de la Casa de Paz donde se creó el reporte

---

### RF-008: Sistema de Notificaciones para Líder (Específico por Casa de Paz)
**Prioridad**: Alta  
**Como** líder de Casa de Paz  
**Quiero** recibir notificaciones cuando el sublíder crea un reporte en MI Casa de Paz  
**Para** estar informado de las actividades específicas de mi Casa de Paz

**Criterios de Aceptación**:
- Cuando el sublíder crea un reporte, se genera una notificación que incluye:
  - Tipo: "Reporte creado por sublíder"
  - Mensaje: "{Nombre del sublíder} creó un reporte para {Código Casa de Paz} - Reunión del {fecha}"
  - Código de Casa de Paz (ej: F1, VN7)
  - Fecha y hora de creación
  - Estado: no leída
  - Link al reporte
- La notificación se envía SOLO al líder de la Casa de Paz donde se creó el reporte
- Si el sublíder crea reportes en múltiples Casas de Paz, cada líder recibe solo la notificación de su Casa de Paz
- El líder ve un indicador de notificaciones no leídas en el header
- Al hacer clic en el indicador, se muestra lista de notificaciones
- Al hacer clic en una notificación:
  - Se marca como leída
  - Se redirige al detalle del reporte
- Las notificaciones se ordenan por fecha (más recientes primero)
- El líder puede marcar todas como leídas

**Reglas de Negocio**:
- Las notificaciones se almacenan en tabla `notificacion` con `casa_de_paz_id`
- Solo el líder de la Casa de Paz específica recibe la notificación
- Las notificaciones persisten hasta que el líder las elimine
- Se muestran máximo 10 notificaciones en el dropdown
- La notificación incluye el código de Casa de Paz para identificación rápida

---

### RF-008B: Código de Casa de Paz en Header (Líder)
**Prioridad**: Media  
**Como** líder de Casa de Paz  
**Quiero** ver el código de mi Casa de Paz en el header  
**Para** identificar rápidamente en qué Casa de Paz estoy trabajando

**Criterios de Aceptación**:
- En el header del líder, se muestra el código de su Casa de Paz (ej: "F1", "VN7")
- El código se obtiene de `casa_de_paz.codigo`
- El código es estático (no clickeable) ya que el líder solo gestiona una Casa de Paz
- El código se muestra junto al nombre de la Casa de Paz o Red
- El formato es: "{Código} - {Nombre Red}" (ej: "F1 - Fares")

**Reglas de Negocio**:
- El código se carga al iniciar sesión desde `usuario_rol_sistema.casa_de_paz_id`
- El código es visible en todas las vistas del líder
- Si el líder no tiene Casa de Paz asignada, no se muestra código

---

### RF-008: Visualización de Reportes del Sublíder (Líder)
**Prioridad**: Media  
**Como** líder de Casa de Paz  
**Quiero** ver todos los reportes incluyendo los creados por el sublíder  
**Para** tener visibilidad completa de las actividades

**Criterios de Aceptación**:
- En el historial de reportes, cada reporte muestra:
  - Fecha de reunión
  - Tema
  - Creado por: "Líder" o "{Nombre del sublíder}"
  - Fecha de creación
  - Botón "Ver Detalle"
- Los reportes del sublíder tienen un badge distintivo: "Creado por sublíder"
- El líder puede filtrar reportes por:
  - Todos
  - Solo míos
  - Solo del sublíder
- El líder puede ver el detalle completo de cualquier reporte
- El líder NO puede editar reportes del sublíder

**Reglas de Negocio**:
- Los reportes del sublíder cuentan para las estadísticas generales
- El líder puede ver quién creó cada reporte mediante `created_by`
- Los reportes se ordenan por fecha de reunión (más recientes primero)

---

### RF-009: Historial de Sublíderes
**Prioridad**: Baja  
**Como** líder de Casa de Paz  
**Quiero** ver el historial de sublíderes asignados  
**Para** tener registro de quiénes han tenido este rol

**Criterios de Aceptación**:
- En el módulo "Gestión de Sublíderes", hay una sección "Historial"
- El historial muestra:
  - Nombre del sublíder
  - Fecha de inicio
  - Fecha de fin (si aplica)
  - Estado (activo/inactivo/removido)
  - Cantidad de reportes creados
- Se puede filtrar por:
  - Todos
  - Solo activos
  - Solo removidos
- Se ordena por fecha de inicio (más recientes primero)

**Reglas de Negocio**:
- El historial incluye sublíderes actuales y pasados
- Los datos vienen de `sub_lider_casa_de_paz`
- Se hace soft delete (no se eliminan registros físicamente)

---

### RF-010: Cambio de Password para Sublíder
**Prioridad**: Media  
**Como** sublíder  
**Quiero** cambiar mi password temporal  
**Para** asegurar mi cuenta con una contraseña personal

**Criterios de Aceptación**:
- En el primer login, el sublíder es forzado a cambiar su password
- El formulario de cambio de password incluye:
  - Password actual
  - Nuevo password
  - Confirmar nuevo password
- El nuevo password debe cumplir:
  - Mínimo 8 caracteres
  - Al menos una mayúscula
  - Al menos una minúscula
  - Al menos un número
  - Al menos un carácter especial
- Después del cambio, se marca `requiere_cambio_password` = false
- Se actualiza `ultimo_cambio_password_at` con la fecha actual

**Reglas de Negocio**:
- El password no puede ser igual al username
- El password no puede contener el nombre o apellido del usuario
- El password anterior no puede ser reutilizado

---

## 3. Requisitos No Funcionales

### RNF-001: Seguridad
- Las contraseñas deben almacenarse hasheadas con bcrypt (salt rounds: 10)
- Las sesiones de sublíder deben expirar después de 8 horas de inactividad
- Los tokens JWT deben incluir el rol del usuario
- El acceso a endpoints debe validarse mediante guards de autorización

### RNF-002: Rendimiento
- La carga del dashboard del sublíder debe completarse en menos de 2 segundos
- Las notificaciones deben generarse en tiempo real (menos de 1 segundo)
- La lista de miembros para asignar sublíder debe cargarse en menos de 1 segundo

### RNF-003: Usabilidad
- El proceso de asignación de sublíder debe completarse en máximo 3 pasos
- Las credenciales generadas deben ser fáciles de copiar (botón "Copiar")
- Los mensajes de error deben ser claros y en español
- La interfaz del sublíder debe ser intuitiva y minimalista

### RNF-004: Auditabilidad
- Todas las acciones del sublíder deben quedar registradas con timestamp
- Los cambios de estado de sublíder deben quedar en el historial
- Las notificaciones deben persistir para auditoría futura

---

## 4. Restricciones y Supuestos

### Restricciones
- Un sublíder puede estar asignado a múltiples Casas de Paz simultáneamente
- El sublíder solo tiene acceso a 2 módulos: Nuevo Reporte y Personas
- El sublíder no puede acceder a módulos administrativos o estadísticas
- El sublíder no puede modificar reportes ya creados
- El líder no puede delegar la gestión de sublíderes
- Las notificaciones son específicas por Casa de Paz (no globales)

### Supuestos
- Los miembros tienen información básica completa (nombre, apellido)
- El líder tiene acceso a internet para recibir notificaciones
- El sublíder tiene un dispositivo con navegador web moderno
- La Casa de Paz tiene al menos un miembro además del líder
- El código de Casa de Paz es único por red (ej: F1, F2, VN7, VN8)
- Un sublíder puede pertenecer a Casas de Paz de diferentes redes

---

## 5. Dependencias

### Dependencias Técnicas
- Sistema de autenticación existente (JWT)
- Base de datos PostgreSQL con Prisma ORM
- Sistema de roles y permisos (RolSistema, UsuarioRolSistema)
- Módulo de Personas (para seleccionar miembros)

### Dependencias de Datos
- Tabla `persona` con miembros activos
- Tabla `casa_de_paz` con Casa de Paz activa
- Tabla `usuario` para credenciales
- Tabla `rol_sistema` con rol `SUBLIDER_CDP`
- Tabla `sub_lider_casa_de_paz` para asignaciones
- Tabla `estado_sub_lider` para estados

---

## 6. Casos de Uso Principales

### CU-001: Asignar Sublíder
**Actor**: Líder de Casa de Paz  
**Precondiciones**:
- El líder está autenticado
- Hay al menos un miembro disponible
- No hay sublíder activo actualmente

**Flujo Principal**:
1. El líder navega a "Gestión de Sublíderes"
2. El sistema muestra lista de miembros disponibles
3. El líder selecciona un miembro
4. El líder hace clic en "Asignar como Sublíder"
5. El sistema genera credenciales automáticamente
6. El sistema muestra las credenciales en un modal
7. El líder copia las credenciales
8. El líder confirma la asignación
9. El sistema crea el usuario y asigna el rol
10. El sistema muestra mensaje de éxito

**Flujo Alternativo**:
- 3a. No hay miembros disponibles → Mostrar mensaje "No hay miembros disponibles"
- 5a. Error al generar credenciales → Mostrar error y permitir reintentar

---

### CU-002: Sublíder Crea Reporte en Casa de Paz Específica
**Actor**: Sublíder  
**Precondiciones**:
- El sublíder está autenticado
- El sublíder tiene al menos una Casa de Paz asignada
- El acceso del sublíder está habilitado para la Casa de Paz seleccionada
- No existe reporte para la fecha seleccionada en esa Casa de Paz

**Flujo Principal**:
1. El sublíder inicia sesión
2. El sistema muestra el módulo "Nuevo Reporte"
3. Si tiene múltiples Casas de Paz, el sublíder selecciona una del dropdown en el header
4. El sistema actualiza el contexto a la Casa de Paz seleccionada
5. El sublíder completa todos los campos requeridos del formulario
6. El sublíder hace clic en "Guardar Reporte"
7. El sistema valida los datos
8. El sistema guarda el reporte asociado a la Casa de Paz seleccionada
9. El sistema genera notificación SOLO para el líder de esa Casa de Paz
10. El sistema muestra mensaje de éxito
11. El sistema limpia el formulario para crear otro reporte

**Flujo Alternativo**:
- 3a. Solo tiene una Casa de Paz → No se muestra selector, se usa la única asignada
- 3b. Acceso deshabilitado para la Casa de Paz seleccionada → Mostrar mensaje y no permitir crear reporte
- 7a. Datos inválidos → Mostrar errores de validación
- 7b. Reporte duplicado → Mostrar error "Ya existe un reporte para esta fecha en {Código Casa de Paz}"

---

### CU-003: Líder Recibe Notificación de su Casa de Paz
**Actor**: Líder de Casa de Paz  
**Precondiciones**:
- El líder está autenticado
- El sublíder creó un reporte en la Casa de Paz del líder

**Flujo Principal**:
1. El sistema detecta que el sublíder creó un reporte en una Casa de Paz específica
2. El sistema identifica al líder de esa Casa de Paz
3. El sistema crea una notificación en la base de datos con `casa_de_paz_id`
4. El sistema actualiza el contador de notificaciones en el header del líder
5. El líder hace clic en el icono de notificaciones
6. El sistema muestra la lista de notificaciones con código de Casa de Paz
7. El líder hace clic en una notificación
8. El sistema marca la notificación como leída
9. El sistema redirige al detalle del reporte

**Flujo Alternativo**:
- 6a. El líder hace clic en "Marcar todas como leídas" → Todas se marcan como leídas
- 1a. El sublíder crea reportes en múltiples Casas de Paz → Cada líder recibe solo la notificación de su Casa de Paz

---

## 7. Criterios de Éxito

### Métricas de Éxito
- El líder puede asignar un sublíder en menos de 2 minutos
- El sublíder puede crear su primer reporte en menos de 5 minutos
- Las notificaciones se generan en menos de 1 segundo
- El 100% de las acciones del sublíder quedan auditadas
- El sistema soporta al menos 50 Casas de Paz con sublíderes activos

### Criterios de Aceptación Global
- Todos los requisitos funcionales de prioridad Alta están implementados
- El sistema pasa todas las pruebas de seguridad
- La interfaz es responsive (mobile, tablet, desktop)
- No hay errores críticos en producción
- La documentación técnica está completa

---

## 8. Riesgos y Mitigaciones

### Riesgo 1: Conflicto de Reportes
**Descripción**: Líder y sublíder crean reporte para la misma fecha  
**Probabilidad**: Media  
**Impacto**: Alto  
**Mitigación**: Validar en backend que no exista reporte para la fecha antes de guardar

### Riesgo 2: Acceso No Autorizado
**Descripción**: Sublíder intenta acceder a módulos restringidos  
**Probabilidad**: Media  
**Impacto**: Alto  
**Mitigación**: Implementar guards de autorización en todos los endpoints y rutas

### Riesgo 3: Pérdida de Credenciales
**Descripción**: Líder no copia las credenciales del sublíder  
**Probabilidad**: Baja  
**Impacto**: Medio  
**Mitigación**: Permitir al líder regenerar credenciales desde el módulo de gestión

### Riesgo 4: Notificaciones No Recibidas
**Descripción**: Líder no ve las notificaciones del sublíder  
**Probabilidad**: Baja  
**Impacto**: Medio  
**Mitigación**: Implementar sistema de notificaciones persistente en base de datos

---

## 9. Glosario

- **Sublíder**: Miembro de la Casa de Paz designado por el líder para crear reportes
- **Líder Principal**: Usuario con rol LIDER_CDP que gestiona la Casa de Paz
- **Acceso Habilitado**: Estado que permite al sublíder iniciar sesión y crear reportes
- **Acceso Deshabilitado**: Estado que impide al sublíder iniciar sesión temporalmente
- **Notificación**: Mensaje informativo generado por el sistema para el líder
- **Reporte**: Registro de actividades de una reunión de Casa de Paz
- **Credenciales**: Username y password para acceder al sistema

---

## 10. Referencias

- Documentación Casa de Paz Vista Líder: `Documentacion_Casa_de_Paz_Vista_Lider.txt`
- Schema de Base de Datos: `backend/prisma/schema.prisma`
- Sistema de Autenticación: `backend/src/modules/auth/`
- Módulo de Personas: `backend/src/modules/personas/`
- Módulo de Casas de Paz: `backend/src/modules/casas-de-paz/`
