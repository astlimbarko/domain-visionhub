# Implementation Plan: Gestión de Sublíderes

## Overview

This implementation plan converts the feature design into a series of incremental coding tasks. Each task builds on previous steps, with all code integrated progressively. The plan covers database setup, backend modules, frontend components, and testing, ensuring complete functionality for managing sublíderes across multiple Casas de Paz with multi-tenancy support.

## Tasks

- [x] 1. Database setup and migrations
  - [x] 1.1 Create Notificacion table migration
    - Create Prisma migration for `notificacion` table with fields: id, usuarioId, casaDePazId, tipo, mensaje, metadata (Json), leida, leidaAt, createdAt
    - Add relations to Usuario and CasaDePaz models
    - Add index on [usuarioId, casaDePazId, leida]
    - _Requirements: RF-008_

  - [x] 1.2 Add SUBLIDER_CDP role to seed data
    - Create seed script to insert SUBLIDER_CDP role in rol_sistema table
    - Set scope to 'casa_de_paz'
    - _Requirements: RF-004.3_

  - [x] 1.3 Run migrations and verify schema
    - Execute `npx prisma migrate dev` to apply migrations
    - Verify tables and relations are created correctly
    - _Requirements: RF-001, RF-008_


- [x] 2. Backend - Sublíderes Module implementation
  - [x] 2.1 Create Sublíderes module structure
    - Generate NestJS module: `nest g module sublideres`
    - Generate service: `nest g service sublideres`
    - Generate controller: `nest g controller sublideres`
    - _Requirements: RF-001_

  - [x] 2.2 Create DTOs for Sublíderes operations
    - Create AsignarSubliderDto with validation decorators (personaId, casaDePazId, fechaInicio, estadoSubLiderId)
    - Create RemoverSubliderDto (fechaFin, motivo optional)
    - Create CambiarEstadoSubliderDto (estadoSubLiderId)
    - _Requirements: RF-001.3, RF-002.2, RF-003_

  - [ ]* 2.3 Write property test for AsignarSubliderDto validation
    - **Property 3: Assignment Required Fields**
    - **Validates: Requirements RF-001.3**

  - [x] 2.4 Implement credential generation service method
    - Create `generarCredenciales()` method that generates username (sublider.{nombre}.{apellido}), email, and password
    - Handle duplicate usernames with numeric suffix
    - Generate secure random password (12 chars, uppercase, lowercase, number, special)
    - _Requirements: RF-004.1_

  - [ ]* 2.5 Write property test for credential format validation
    - **Property 12: Credential Format Validation**
    - **Validates: Requirements RF-004.1**

  - [x] 2.6 Implement asignarSublider service method
    - Check if usuario exists for personaId (reuse credentials if exists)
    - Create usuario record if first assignment (isActive=true, requiereCambioPassword=true)
    - Create SubLiderCasaDePaz record with all required fields
    - Create UsuarioRolSistema record with SUBLIDER_CDP role and casaDePazId
    - Return sublider and credenciales (or null if reused)
    - _Requirements: RF-001.4, RF-001.5, RF-004.2, RF-004.3_

  - [ ]* 2.7 Write property test for credential reuse
    - **Property 4: Credential Generation on First Assignment**
    - **Validates: Requirements RF-001.4, RF-001.5**

  - [ ]* 2.8 Write property test for multiple Casa de Paz assignments
    - **Property 2: Multiple Casa de Paz Assignments**
    - **Validates: Requirements RF-001.2**


  - [x] 2.9 Implement removerSublider service method
    - Update SubLiderCasaDePaz record with fechaFin and estado
    - Update UsuarioRolSistema record with fechaFin
    - Do NOT delete reportes (preserve with created_by)
    - _Requirements: RF-002.2, RF-002.4_

  - [ ]* 2.10 Write property test for reporte preservation after removal
    - **Property 8: Reporte Preservation After Removal**
    - **Validates: Requirements RF-002.4**

  - [x] 2.11 Implement cambiarEstado service method
    - Update estado_sub_lider_id in SubLiderCasaDePaz record
    - Persist change immediately to database
    - _Requirements: RF-003.1, RF-003.4_

  - [ ]* 2.12 Write property test for state change persistence
    - **Property 9: State Change Persistence**
    - **Validates: Requirements RF-003.1, RF-003.4**

  - [x] 2.13 Implement query methods for Sublíderes
    - Create `obtenerMiembrosDisponibles(casaDePazId)` - returns active SSVA members
    - Create `obtenerSubliderActivo(casaDePazId)` - returns current active sublider or null
    - Create `obtenerHistorial(casaDePazId)` - returns all sublider assignments with filters
    - Create `obtenerAsignacionesActivas(personaId)` - returns all active Casa de Paz assignments for a sublider
    - _Requirements: RF-001.1, RF-009_

  - [ ]* 2.14 Write property test for active member selection
    - **Property 1: Active Member Selection**
    - **Validates: Requirements RF-001.1**

  - [x] 2.15 Implement Sublíderes controller endpoints
    - GET /api/sublideres/miembros-disponibles?casaDePazId={id}
    - POST /api/sublideres/asignar
    - POST /api/sublideres/:id/remover
    - PATCH /api/sublideres/:id/estado
    - GET /api/sublideres/activo?casaDePazId={id}
    - GET /api/sublideres/historial?casaDePazId={id}
    - GET /api/sublideres/mis-casas-de-paz
    - Add @UseGuards(JwtAuthGuard, RolesGuard) decorators
    - _Requirements: RF-001, RF-002, RF-003, RF-009_

  - [ ]* 2.16 Write unit tests for Sublíderes service edge cases
    - Test rejection when sublider already exists
    - Test usuario creation only on first assignment
    - Test credential reuse on second assignment
    - _Requirements: RF-001, RF-004_


- [x] 3. Backend - Notificaciones Module implementation
  - [x] 3.1 Create Notificaciones module structure
    - Generate NestJS module: `nest g module notificaciones`
    - Generate service: `nest g service notificaciones`
    - Generate controller: `nest g controller notificaciones`
    - _Requirements: RF-008_

  - [x] 3.2 Create DTOs for Notificaciones operations
    - Create CrearNotificacionDto (casaDePazId, tipo, mensaje, metadata optional)
    - _Requirements: RF-008_

  - [x] 3.3 Implement notificarLider service method
    - Find lider usuario for the specified casaDePazId
    - Create Notificacion record with usuarioId, casaDePazId, tipo, mensaje, metadata
    - Set leida=false by default
    - _Requirements: RF-008.3_

  - [ ]* 3.4 Write property test for targeted notification creation
    - **Property 20: Targeted Notification Creation**
    - **Validates: Requirements RF-007.4, RF-008.3**

  - [ ]* 3.5 Write property test for notification multi-tenancy isolation
    - **Property 24: Notification Multi-Tenancy Isolation**
    - **Validates: Requirements RF-008.4**

  - [x] 3.6 Implement query methods for Notificaciones
    - Create `obtenerNotificaciones(liderUsuarioId, casaDePazId)` - returns notifications ordered by createdAt DESC
    - Create `obtenerContador(liderUsuarioId, casaDePazId)` - returns count of unread notifications
    - Create `marcarLeida(notificacionId)` - updates leida=true and leidaAt
    - Create `marcarTodasLeidas(liderUsuarioId, casaDePazId)` - bulk update
    - _Requirements: RF-008.7, RF-008.8, RF-008.9_

  - [ ]* 3.7 Write property test for notification read state update
    - **Property 25: Notification Read State Update**
    - **Validates: Requirements RF-008.7**

  - [ ]* 3.8 Write property test for notification ordering
    - **Property 26: Notification Ordering**
    - **Validates: Requirements RF-008.8**

  - [ ]* 3.9 Write property test for bulk mark as read
    - **Property 27: Bulk Mark as Read**
    - **Validates: Requirements RF-008.9**

  - [x] 3.10 Implement Notificaciones controller endpoints
    - GET /api/notificaciones?casaDePazId={id}
    - PATCH /api/notificaciones/:id/leer
    - PATCH /api/notificaciones/leer-todas?casaDePazId={id}
    - GET /api/notificaciones/contador?casaDePazId={id}
    - Add @UseGuards(JwtAuthGuard, RolesGuard) decorators
    - _Requirements: RF-008_


- [x] 4. Backend - Auth Module extensions
  - [x] 4.1 Extend LoginResponseDto interface
    - Add casasDePaz array field for sublider users
    - Add CasaDePazAsignacion type (id, codigo, redNombre, liderNombre, estadoAcceso)
    - _Requirements: RF-005B_

  - [x] 4.2 Extend JwtStrategy.validate() method
    - Check if user has SUBLIDER_CDP role
    - If sublider, query SubLiderCasaDePaz records with fechaFin=null
    - Include casaDePaz, red, lider, and estado relations
    - Map to CasaDePazAsignacion format and add to user payload
    - _Requirements: RF-005B_

  - [x] 4.3 Create CasaDePazContextGuard
    - Implement CanActivate interface
    - Extract casaDePazId from request body or query
    - Validate user has active access to specified Casa de Paz
    - Throw ForbiddenException if no access or estado is not 'activo'
    - _Requirements: RF-005B.6, RF-007.7_

  - [ ]* 4.4 Write property test for disabled Casa de Paz access prevention
    - **Property 17: Disabled Casa de Paz Access Prevention**
    - **Validates: Requirements RF-005B.6, RF-007.7**

  - [x] 4.5 Implement password change endpoint
    - POST /api/auth/cambiar-password
    - Validate current password, new password, and confirmation
    - Check password policy (min 8 chars, uppercase, lowercase, number, special)
    - Update usuario with new hashed password
    - Set requiereCambioPassword=false and ultimo_cambio_password_at
    - _Requirements: RF-010.3, RF-010.4, RF-010.5_

  - [ ]* 4.6 Write property test for password policy validation
    - **Property 32: Password Policy Validation**
    - **Validates: Requirements RF-010.3**

  - [ ]* 4.7 Write property test for password change state update
    - **Property 33: Password Change State Update**
    - **Validates: Requirements RF-010.4, RF-010.5**

  - [x] 4.8 Implement forced password change guard
    - Create RequierePasswordChangeGuard
    - Check if user.requiereCambioPassword is true
    - Allow access only to /auth/cambiar-password endpoint
    - Reject other requests with 401 and message
    - _Requirements: RF-010.1_

  - [ ]* 4.9 Write property test for forced password change on first login
    - **Property 31: Forced Password Change on First Login**
    - **Validates: Requirements RF-010.1**

  - [x] 4.10 Extend login validation for disabled sublider access
    - Check if user has SUBLIDER_CDP role
    - Query SubLiderCasaDePaz records to check if all are inactivo or suspendido
    - Return 401 with message "Tu acceso ha sido temporalmente deshabilitado"
    - _Requirements: RF-003.2_

  - [ ]* 4.11 Write property test for disabled access prevention
    - **Property 10: Disabled Access Prevention**
    - **Validates: Requirements RF-003.2**

  - [ ]* 4.12 Write property test for enabled access permission
    - **Property 11: Enabled Access Permission**
    - **Validates: Requirements RF-003.3**


- [x] 5. Backend - Reportes Module extensions
  - [x] 5.1 Add casaDePazId validation to crear reporte endpoint
    - Apply @UseGuards(CasaDePazContextGuard) to POST /api/reportes
    - Ensure reporte is associated with correct casa_de_paz_id
    - _Requirements: RF-007.3_

  - [ ]* 5.2 Write property test for reporte Casa de Paz association
    - **Property 19: Reporte Casa de Paz Association**
    - **Validates: Requirements RF-007.3**

  - [x] 5.3 Implement duplicate reporte validation
    - Create `validarNoDuplicado(casaDePazId, fechaReunion)` method
    - Query CasaDePazReporte for existing record with same casa_de_paz_id and fechaReunion
    - Throw BadRequestException if duplicate found
    - _Requirements: RF-007.9_

  - [ ]* 5.4 Write property test for duplicate reporte prevention
    - **Property 23: Duplicate Reporte Prevention**
    - **Validates: Requirements RF-007.9**

  - [x] 5.5 Implement future date validation for reportes
    - Add validation in CrearReporteDto or service method
    - Check if fechaReunion is greater than current date
    - Throw BadRequestException if future date
    - _Requirements: RF-007.8_

  - [ ]* 5.6 Write property test for future date validation
    - **Property 22: Future Date Validation**
    - **Validates: Requirements RF-007.8**

  - [x] 5.7 Integrate notification creation on reporte creation
    - After creating reporte, check if created_by is a sublider
    - If sublider, call notificacionesService.notificarLider()
    - Pass casaDePazId, tipo='REPORTE_SUBLIDER', mensaje with sublider name and date
    - Include reporteId in metadata
    - _Requirements: RF-007, RF-008_

  - [x] 5.8 Add reporte filtering by creator
    - Extend GET /api/reportes endpoint with filter query param (all, lider, sublider)
    - Filter based on created_by field and role lookup
    - _Requirements: RF-008.12_

  - [ ]* 5.9 Write property test for reporte filtering by creator
    - **Property 28: Reporte Filtering by Creator**
    - **Validates: Requirements RF-008.12**


- [x] 6. Backend - Personas Module extensions
  - [x] 6.1 Add casaDePazId filtering to personas queries
    - Apply @UseGuards(CasaDePazContextGuard) to GET /api/personas
    - Filter personas by cdp_membresia.casa_de_paz_id matching request casaDePazId
    - _Requirements: RF-006.2, RF-006.6_

  - [ ]* 6.2 Write property test for Casa de Paz data isolation
    - **Property 18: Casa de Paz Data Isolation**
    - **Validates: Requirements RF-006.2, RF-006.6**

  - [x] 6.3 Add created_by audit field to persona creation
    - Ensure all persona creation includes created_by from request.user.userId
    - _Requirements: RF-006.7_

  - [ ]* 6.4 Write property test for comprehensive audit trail
    - **Property 5: Comprehensive Audit Trail**
    - **Validates: Requirements RF-001.6, RF-002.5, RF-003.5, RF-006.7, RF-007.2**

  - [x] 6.4 Implement persona selection filtering for reportes
    - When sublider creates reporte, available personas should only be from current Casa de Paz
    - Filter by casaDePazId in personas query
    - _Requirements: RF-007.6_

  - [ ]* 6.5 Write property test for persona selection filtering
    - **Property 21: Persona Selection Filtering**
    - **Validates: Requirements RF-007.6**

- [x] 7. Backend - Casas de Paz Module extensions
  - [x] 7.1 Add obtenerCodigo service method
    - Query CasaDePaz by id and return codigo field
    - _Requirements: RF-005B, RF-008B_

  - [x] 7.2 Add obtenerLider service method
    - Query CasaDePaz with lider relation
    - Return Usuario record of the lider
    - _Requirements: RF-008.3_

- [ ] 8. Backend - Authorization and security
  - [x] 8.1 Create RolesGuard for SUBLIDER_CDP role
    - Implement guard to check user has SUBLIDER_CDP role
    - Apply to sublider-specific endpoints
    - _Requirements: RF-005_

  - [x] 8.2 Implement restricted module access validation
    - Create guard to reject sublider access to: dashboard, evangelismo, gestion-sublideres, historial-asistencias, estadisticas
    - Return 403 Forbidden with clear message
    - _Requirements: RF-005.4_

  - [ ]* 8.3 Write property test for restricted module access
    - **Property 16: Restricted Module Access**
    - **Validates: Requirements RF-005.4**

  - [x] 8.4 Implement immediate access revocation on removal
    - Ensure that after removerSublider, login attempts fail
    - Update isActive or fechaFin in UsuarioRolSistema
    - _Requirements: RF-002.3_

  - [ ]* 8.5 Write property test for immediate access revocation
    - **Property 7: Immediate Access Revocation**
    - **Validates: Requirements RF-002.3**


- [ ] 9. Backend - Error handling and validation
  - [x] 9.1 Implement global exception filter
    - Create AllExceptionsFilter to handle all exceptions
    - Map Prisma errors (P2002 duplicate, P2025 not found) to HTTP status codes
    - Log errors with timestamp, path, method, status
    - Return consistent error response format
    - _Requirements: RNF-003_

  - [x] 9.2 Add validation error messages in Spanish
    - Configure class-validator to return Spanish messages
    - Add custom error messages to all DTOs
    - _Requirements: RNF-003_

  - [ ] 9.3 Implement audit logging for sublider actions
    - Create AuditLog model or use existing logging
    - Log all sublider operations: assign, remove, state change, reporte creation
    - Include userId, action, casaDePazId, metadata, ipAddress, userAgent
    - _Requirements: RNF-004_

- [ ] 10. Checkpoint - Backend complete
  - Ensure all backend tests pass
  - Verify all endpoints are accessible with correct guards
  - Test authentication and authorization flows
  - Ask the user if questions arise


- [x] 11. Frontend - Type definitions and interfaces
  - [x] 11.1 Create sublider types
    - Create types/sublider.types.ts with SubLider, Credenciales, CasaDePazAsignacion interfaces
    - _Requirements: RF-001, RF-004_

  - [x] 11.2 Create notificacion types
    - Create types/notificacion.types.ts with Notificacion interface
    - _Requirements: RF-008_

  - [x] 11.3 Extend auth types
    - Update LoginResponseDto to include casasDePaz array
    - _Requirements: RF-005B_

- [x] 12. Frontend - API services
  - [x] 12.1 Create SubLideresService
    - Implement methods: obtenerMiembrosDisponibles, asignar, remover, cambiarEstado, obtenerActivo, obtenerHistorial, obtenerMisCasasDePaz
    - Use axios for HTTP requests
    - _Requirements: RF-001, RF-002, RF-003, RF-009_

  - [x] 12.2 Create NotificacionesService
    - Implement methods: obtener, marcarLeida, marcarTodasLeidas, obtenerContador
    - Use axios for HTTP requests
    - _Requirements: RF-008_

  - [x] 12.3 Extend AuthService
    - Update login method to handle casasDePaz in response
    - Add cambiarPassword method
    - _Requirements: RF-005B, RF-010_

- [ ] 13. Frontend - Zustand stores
  - [x] 13.1 Create CasaDePazStore
    - Create store/casa-de-paz.store.ts with state: casaDePazActual, casasDePaz
    - Implement actions: setCasaDePaz, setCasasDePaz, cargarDesdeLocalStorage
    - Persist casaDePazActual to localStorage
    - _Requirements: RF-005B_

  - [x] 13.2 Extend AuthStore
    - Add casasDePaz field to user state
    - Update login action to populate casasDePaz
    - Call CasaDePazStore.setCasasDePaz if sublider
    - _Requirements: RF-005B_


- [x] 14. Frontend - GestionSublideres page (Líder)
  - [x] 14.1 Create GestionSublideres page component
    - Create pages/GestionSublideres.tsx
    - Implement state management for subliderActivo, historial, miembrosDisponibles
    - Add useEffect to load data on mount
    - _Requirements: RF-001, RF-002, RF-003, RF-009_

  - [x] 14.2 Create SubliderActivoCard component
    - Display current sublider info (name, email, fecha inicio, estado)
    - Add buttons: Remover, Cambiar Estado (Habilitar/Deshabilitar)
    - _Requirements: RF-002, RF-003_

  - [x] 14.3 Create BotonAsignarSublider component
    - Display when no active sublider
    - Opens modal to assign new sublider
    - _Requirements: RF-001_

  - [x] 14.4 Create ModalAsignarSublider component
    - Display list of available members
    - Allow selection and confirmation
    - Call sublideresService.asignar on submit
    - _Requirements: RF-001_

  - [x] 14.5 Create ModalCredenciales component
    - Display generated credentials (username, email, password)
    - Add "Copiar" buttons for each field
    - Show warning that credentials are shown only once
    - _Requirements: RF-004_

  - [x] 14.6 Create HistorialSublideresTable component
    - Display table with columns: Nombre, Fecha Inicio, Fecha Fin, Estado, Reportes Creados
    - Add filters: Todos, Solo activos, Solo removidos
    - Order by fechaInicio DESC
    - _Requirements: RF-009_

  - [ ]* 14.7 Write unit tests for GestionSublideres components
    - Test modal opening/closing
    - Test credential display and copy functionality
    - Test historial filtering
    - _Requirements: RF-001, RF-002, RF-003, RF-009_


- [ ] 15. Frontend - Sublíder Layout
  - [x] 15.1 Create SubliderLayout component
    - Create components/layout/SubliderLayout.tsx
    - Implement simplified sidebar with only: Nuevo Reporte, Personas, Cerrar Sesión
    - Add header with CasaDePazSelector
    - Redirect to /nuevo-reporte on mount if at root path
    - _Requirements: RF-005_

  - [x] 15.2 Configure routing for sublider layout
    - Add route protection based on SUBLIDER_CDP role
    - Apply SubliderLayout to sublider routes
    - Restrict access to dashboard, evangelismo, gestion-sublideres, historial-asistencias, estadisticas
    - _Requirements: RF-005.4_

  - [ ]* 15.3 Write unit tests for SubliderLayout
    - Test sidebar navigation items
    - Test redirect to Nuevo Reporte
    - Test restricted route access
    - _Requirements: RF-005_

- [ ] 16. Frontend - Casa de Paz Selector
  - [x] 16.1 Create CasaDePazSelector component
    - Create components/shared/CasaDePazSelector.tsx
    - Display static codigo if only one Casa de Paz
    - Display dropdown if multiple Casas de Paz
    - Show codigo, redNombre, liderNombre for each option
    - Disable selection of Casas de Paz with estadoAcceso !== 'activo'
    - Call onChange when selection changes
    - _Requirements: RF-005B_

  - [ ]* 16.2 Write unit tests for CasaDePazSelector
    - Test static display with one Casa de Paz
    - Test dropdown with multiple Casas de Paz
    - Test disabled state for inactive Casas de Paz
    - _Requirements: RF-005B_

  - [ ] 16.3 Integrate CasaDePazSelector in SubliderLayout header
    - Pass casasDePaz from authStore
    - Pass casaActual from casaDePazStore
    - Handle onChange to update casaDePazStore
    - _Requirements: RF-005B_


- [ ] 17. Frontend - Notification system (Líder)
  - [ ] 17.1 Create NotificacionesBell component
    - Create components/shared/NotificacionesBell.tsx
    - Display bell icon with badge showing unread count
    - Implement dropdown with notification list
    - Add polling every 30 seconds to refresh notifications
    - _Requirements: RF-008_

  - [ ] 17.2 Create NotificacionItem component
    - Display notification tipo, mensaje, createdAt
    - Show badge if not leida
    - Add click handler to mark as leida and navigate to reporte
    - _Requirements: RF-008_

  - [ ] 17.3 Integrate NotificacionesBell in Líder header
    - Add to header component for LIDER_CDP role
    - Pass casaDePazId from authStore
    - _Requirements: RF-008_

  - [ ]* 17.4 Write unit tests for notification components
    - Test bell icon with badge
    - Test notification list rendering
    - Test mark as read functionality
    - _Requirements: RF-008_

- [ ] 18. Frontend - Casa de Paz código display (Líder)
  - [ ] 18.1 Add Casa de Paz código to Líder header
    - Display static codigo from authStore.user.casaDePaz
    - Format as "{Código} - {Nombre Red}"
    - _Requirements: RF-008B_


- [ ] 19. Frontend - Nuevo Reporte page extensions (Sublíder)
  - [x] 19.1 Add casaDePazId to reporte creation
    - Get casaDePazId from casaDePazStore.casaDePazActual
    - Include in POST request body
    - _Requirements: RF-007.3_

  - [x] 19.2 Filter personas by current Casa de Paz
    - When loading personas for reporte, pass casaDePazId query param
    - Only show personas from selected Casa de Paz
    - _Requirements: RF-007.6_

  - [ ] 19.3 Add duplicate reporte validation feedback
    - Handle 400 error with message "Ya existe un reporte para esta fecha en {Código}"
    - Display error toast with clear message
    - _Requirements: RF-007.9_

  - [ ] 19.4 Add future date validation feedback
    - Handle 400 error for future fechaReunion
    - Display error toast
    - _Requirements: RF-007.8_

- [ ] 20. Frontend - Personas page extensions (Sublíder)
  - [x] 20.1 Add casaDePazId filtering to personas queries
    - Get casaDePazId from casaDePazStore.casaDePazActual
    - Pass as query param to GET /api/personas
    - _Requirements: RF-006.2_

  - [x] 20.2 Ensure persona creation includes casaDePazId
    - Include casaDePazId in POST request when creating persona
    - _Requirements: RF-006_


- [ ] 21. Frontend - Password change page
  - [x] 21.1 Create CambiarPassword page
    - Create pages/CambiarPassword.tsx
    - Implement form with fields: passwordActual, nuevoPassword, confirmarPassword
    - Add client-side validation for password policy
    - Display password requirements clearly
    - _Requirements: RF-010_

  - [x] 21.2 Implement password change logic
    - Call authService.cambiarPassword on submit
    - Handle success: show message and redirect to main page
    - Handle errors: display validation errors
    - _Requirements: RF-010_

  - [x] 21.3 Add forced password change redirect
    - Check user.requiereCambioPassword in AuthGuard
    - Redirect to /cambiar-password if true
    - Block access to other routes until password changed
    - _Requirements: RF-010.1_

  - [ ]* 21.4 Write unit tests for password change page
    - Test form validation
    - Test password policy enforcement
    - Test successful password change flow
    - _Requirements: RF-010_

- [ ] 22. Frontend - Error handling and user feedback
  - [ ] 22.1 Implement API error interceptor
    - Add axios response interceptor
    - Handle 401: logout and redirect to login (or redirect to cambiar-password if requiereCambioPassword)
    - Handle 403: show toast with error message
    - Handle 404: show toast with error message
    - Handle 409: show toast with error message
    - Handle 500+: show generic error toast
    - _Requirements: RNF-003_

  - [ ] 22.2 Add Spanish error messages
    - Configure all error messages in Spanish
    - Use clear, user-friendly language
    - _Requirements: RNF-003_

  - [ ] 22.3 Add loading states to all async operations
    - Show spinners during API calls
    - Disable buttons during submission
    - _Requirements: RNF-003_


- [ ] 23. Frontend - Reportes page extensions (Líder)
  - [ ] 23.1 Add "Creado por" badge to reporte list
    - Display "Líder" or "{Nombre del sublíder}" badge
    - Add visual distinction for sublider reportes
    - _Requirements: RF-008_

  - [ ] 23.2 Add reporte filtering by creator
    - Add filter dropdown: Todos, Solo míos, Solo del sublíder
    - Update query to backend with filter param
    - _Requirements: RF-008.12_

  - [ ] 23.3 Disable edit for sublider reportes
    - Check created_by field
    - Hide or disable edit button if created by sublider
    - Show tooltip: "No puedes editar reportes creados por el sublíder"
    - _Requirements: RF-008_

- [ ] 24. Checkpoint - Frontend complete
  - Ensure all frontend components render correctly
  - Test navigation and routing for both líder and sublíder
  - Verify Casa de Paz selector works with multiple assignments
  - Test notification system end-to-end
  - Ask the user if questions arise


- [ ] 25. Integration testing
  - [ ]* 25.1 Write integration test for complete sublíder lifecycle
    - Test: líder assigns sublíder → sublíder logs in → changes password → creates reporte → líder receives notification → líder removes sublíder → sublíder cannot login
    - _Requirements: RF-001, RF-002, RF-004, RF-007, RF-008, RF-010_

  - [ ]* 25.2 Write integration test for multi-Casa de Paz sublíder
    - Test: sublíder assigned to multiple Casas de Paz → logs in → selects Casa de Paz 1 → creates reporte → líder 1 receives notification → selects Casa de Paz 2 → creates reporte → líder 2 receives notification
    - _Requirements: RF-001.2, RF-005B, RF-007, RF-008.4_

  - [ ]* 25.3 Write integration test for disabled access
    - Test: líder disables sublíder access → sublíder cannot login → líder enables access → sublíder can login
    - _Requirements: RF-003_

  - [ ]* 25.4 Write integration test for credential reuse
    - Test: sublíder assigned to Casa de Paz 1 → credentials generated → sublíder assigned to Casa de Paz 2 → same credentials reused
    - _Requirements: RF-001.5, RF-004_

- [ ] 26. Performance optimization
  - [ ] 26.1 Add database indexes
    - Verify index on [usuarioId, casaDePazId, leida] for notificacion table
    - Add index on [personaId, fechaFin] for sub_lider_casa_de_paz table
    - Add index on [casa_de_paz_id, fechaReunion] for casa_de_paz_reporte table
    - _Requirements: RNF-002_

  - [ ] 26.2 Optimize notification polling
    - Implement debouncing for notification refresh
    - Consider WebSocket for real-time notifications (optional)
    - _Requirements: RNF-002_

  - [ ] 26.3 Add pagination to historial queries
    - Implement pagination for sublider historial
    - Implement pagination for notification list
    - _Requirements: RNF-002_


- [ ] 27. Security hardening
  - [ ] 27.1 Implement rate limiting for login endpoint
    - Add rate limiting middleware to prevent brute force attacks
    - Limit to 5 attempts per 15 minutes per IP
    - _Requirements: RNF-001_

  - [ ] 27.2 Add CSRF protection
    - Implement CSRF tokens for state-changing operations
    - _Requirements: RNF-001_

  - [ ] 27.3 Implement session timeout
    - Configure JWT expiration to 8 hours
    - Add refresh token mechanism
    - _Requirements: RNF-001_

  - [ ] 27.4 Add input sanitization
    - Sanitize all user inputs to prevent XSS
    - Validate all DTOs with class-validator
    - _Requirements: RNF-001_

- [ ] 28. Documentation
  - [ ] 28.1 Update API documentation
    - Document all new endpoints with Swagger/OpenAPI
    - Include request/response examples
    - Document authentication requirements
    - _Requirements: RNF-004_

  - [ ] 28.2 Create user guide for líderes
    - Document how to assign sublíderes
    - Document how to manage permissions
    - Document how to view notifications
    - _Requirements: RNF-003_

  - [ ] 28.3 Create user guide for sublíderes
    - Document login process and password change
    - Document how to create reportes
    - Document how to switch between Casas de Paz
    - _Requirements: RNF-003_


- [ ] 29. Final testing and validation
  - [ ] 29.1 Run all unit tests
    - Execute backend test suite: `npm run test` in backend directory
    - Execute frontend test suite: `npm run test` in frontend directory
    - Ensure all tests pass
    - _Requirements: All RF requirements_

  - [ ] 29.2 Run all property-based tests
    - Execute property tests with minimum 100 iterations
    - Verify all 33 properties pass
    - _Requirements: All RF requirements_

  - [ ] 29.3 Run all integration tests
    - Execute end-to-end test suite
    - Verify complete user flows work correctly
    - _Requirements: All RF requirements_

  - [ ] 29.4 Manual testing checklist
    - Test líder assigns sublíder and receives credentials
    - Test sublíder logs in and changes password
    - Test sublíder creates reporte in Casa de Paz 1
    - Test líder receives notification for Casa de Paz 1
    - Test sublíder assigned to multiple Casas de Paz
    - Test sublíder switches between Casas de Paz
    - Test líder disables sublíder access
    - Test sublíder cannot login when disabled
    - Test líder removes sublíder
    - Test sublíder cannot login after removal
    - Test reportes created by sublíder are preserved
    - _Requirements: All RF requirements_

  - [ ] 29.5 Verify test coverage
    - Check backend coverage is >= 80%
    - Check frontend coverage is >= 70%
    - _Requirements: RNF-004_

- [ ] 30. Final checkpoint - Complete feature
  - Ensure all tests pass (unit, property, integration)
  - Verify all acceptance criteria are met
  - Confirm all 33 properties are validated
  - Test complete user flows manually
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (33 total)
- Unit tests validate specific examples and edge cases
- Integration tests validate complete end-to-end flows
- All code should be written in TypeScript for both backend (NestJS) and frontend (React)
- The implementation follows a multi-tenancy pattern where sublíderes can be assigned to multiple Casas de Paz
- Notifications are specific to each Casa de Paz (not global)
- The sublíder has a simplified layout with only 2 modules: Nuevo Reporte and Personas
