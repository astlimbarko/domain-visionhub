# Implementation Plan: Eventos con Rango de Fechas

## Overview

Esta implementación extiende el sistema de calendario para soportar eventos con rangos de fechas y horas. Se añadirán dos campos opcionales (`fechaFin` y `horaFin`) manteniendo compatibilidad total con eventos existentes. La implementación incluye migración de base de datos, validación en backend, actualización de DTOs, lógica de consultas para intersección de rangos, actualización de formularios y visualización en frontend, y pruebas basadas en propiedades.

## Tasks

- [x] 1. Database migration and schema update
  - Create Prisma migration to add `fechaFin` and `horaFin` columns as nullable fields
  - Add index on `fecha_fin` for query optimization
  - Run migration and verify existing events remain unchanged
  - _Requirements: 1.1, 1.2, 1.5, 8.1, 8.2_

- [ ] 2. Update backend DTOs and validation
  - [x] 2.1 Update CreateEventoDto to include fechaFin and horaFin fields
    - Add `@IsDateString()` validation for `fechaFin` (optional)
    - Add `@Matches()` validation for `horaFin` in HH:MM format (optional)
    - Add API documentation with `@ApiProperty()`
    - _Requirements: 4.1, 4.2_
  
  - [x] 2.2 Update UpdateEventoDto to include fechaFin and horaFin fields
    - Ensure PartialType includes new optional fields
    - _Requirements: 4.3, 4.4_

- [ ] 3. Implement backend validation logic
  - [x] 3.1 Add date range validation in CalendarioService.createEvento
    - Validate `fechaFin >= fechaEvento` when fechaFin is provided
    - Throw EventoValidationError with descriptive message for invalid ranges
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 3.2 Add time range validation for same-day events
    - Validate `horaFin > horaEvento` when both are provided and it's the same day
    - Allow any time combination for multi-day events (fechaFin > fechaEvento)
    - Throw EventoValidationError with descriptive message for invalid time ranges
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 3.3 Add validation for todoElDia flag
    - Reject events with `todoElDia = true` if horaEvento or horaFin are provided
    - Throw EventoValidationError with descriptive message
    - _Requirements: 2.1_
  
  - [x] 3.4 Apply same validation logic in CalendarioService.updateEvento
    - Reuse validation functions from createEvento
    - _Requirements: 4.5_
  
  - [ ]* 3.5 Write property test for date range validation
    - **Property 1: Date Range Validation**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Generate random valid and invalid date ranges
    - Verify system accepts valid ranges and rejects invalid ones with correct error message
  
  - [ ]* 3.6 Write property test for time range validation (same-day events)
    - **Property 2: Time Range Validation for Same-Day Events**
    - **Validates: Requirements 3.1, 3.2**
    - Generate random time combinations for same-day events
    - Verify system accepts horaFin > horaEvento and rejects horaFin <= horaEvento
  
  - [ ]* 3.7 Write property test for time range flexibility (multi-day events)
    - **Property 3: Time Range Flexibility for Multi-Day Events**
    - **Validates: Requirements 3.3**
    - Generate random multi-day events with any time combinations
    - Verify system accepts all time combinations when fechaFin > fechaEvento
  
  - [ ]* 3.8 Write property test for optional end fields acceptance
    - **Property 4: Optional End Fields Acceptance**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Generate events with various combinations of null/present fechaFin and horaFin
    - Verify system accepts all combinations and stores null values correctly
  
  - [ ]* 3.9 Write property test for validation consistency between create and update
    - **Property 5: Validation Consistency Between Create and Update**
    - **Validates: Requirements 4.5**
    - Generate invalid date/time combinations
    - Verify same error messages for both create and update operations

- [x] 4. Checkpoint - Ensure backend validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement query logic for date range intersection
  - [x] 5.1 Update CalendarioService.getEventosMensual method
    - Modify WHERE clause to include OR conditions for range intersection
    - Include events that start in the month
    - Include events that end in the month
    - Include events that encompass the entire month
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 5.2 Implement expandirEventosMultiDia helper method
    - Generate one entry per day for multi-day events
    - Add metadata: `fechaMostrar`, `esMultiDia`, `esPrimerDia`, `esUltimoDia`
    - Handle events that partially overlap with query range
    - _Requirements: 5.1, 5.3_
  
  - [ ]* 5.3 Write property test for multi-day event display coverage
    - **Property 6: Multi-Day Event Display Coverage**
    - **Validates: Requirements 5.1, 5.3**
    - Generate random multi-day events
    - Verify events appear on all days within their range with correct metadata
  
  - [ ]* 5.4 Write property test for date range query intersection
    - **Property 7: Date Range Query Intersection**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Generate random events and query ranges
    - Verify all intersecting events are returned and non-intersecting events are excluded
  
  - [ ]* 5.5 Write unit tests for getEventosMensual
    - Test single-day event appears on correct date
    - Test multi-day event appears on all days of range
    - Test event starting before month and ending during month
    - Test event encompassing entire month
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Update frontend types
  - [x] 6.1 Update Evento interface in calendario.types.ts
    - Add `fechaFin?: string` field
    - Add `horaFin?: string` field
    - _Requirements: 1.1, 1.2_
  
  - [x] 6.2 Update EventoCalendario interface
    - Add metadata fields: `fechaMostrar`, `esMultiDia`, `esPrimerDia`, `esUltimoDia`, `fechaInicio`, `fechaFin`
    - _Requirements: 5.1, 5.3_
  
  - [x] 6.3 Update CreateEventoForm and UpdateEventoForm interfaces
    - Add `fechaFin?: Date` field
    - Add `horaFin?: string` field
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Update frontend form component
  - [x] 7.1 Add fechaFin DatePicker field to EventoFormModal
    - Add optional DatePicker after fechaEvento field
    - Disable dates before fechaEvento
    - Add label and proper styling
    - _Requirements: 4.1, 4.3_
  
  - [x] 7.2 Add horaFin input field to EventoFormModal
    - Add optional time input after horaEvento field
    - Use HH:MM format with validation
    - Add label and proper styling
    - _Requirements: 4.2, 4.4_
  
  - [x] 7.3 Implement real-time validation in form
    - Validate fechaFin >= fechaEvento
    - Validate horaFin > horaEvento for same-day events
    - Disable hora fields when todoElDia is checked
    - Show error messages below invalid fields
    - _Requirements: 2.1, 2.2, 3.1, 3.2_
  
  - [x] 7.4 Update form submission to include new fields
    - Include fechaFin and horaFin in API request payload
    - Handle API validation errors and display to user
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 7.5 Write unit tests for EventoFormModal
    - Test fechaFin and horaFin fields render correctly
    - Test date validation (fechaFin dates before fechaEvento are disabled)
    - Test time validation error for same-day events
    - Test time validation allows any combination for multi-day events
    - Test hora fields disabled when todoElDia is checked
    - Test form submission includes new fields
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Checkpoint - Ensure frontend form tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Update frontend calendar display
  - [x] 9.1 Update CalendarioMensual component to render multi-day events
    - Modify event rendering to show events on all days of their range
    - Apply different CSS classes based on esPrimerDia, esUltimoDia, esMultiDia
    - Show event title on first day, continuation indicator on other days
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 9.2 Add CSS styles for multi-day event visualization
    - Style for primer-dia (rounded left border, padding-left)
    - Style for ultimo-dia (rounded right border, padding-right)
    - Style for continuacion (no border radius, minimal padding)
    - Add continuation arrow indicator
    - _Requirements: 5.2, 5.3_
  
  - [x] 9.3 Add tooltip with duration information
    - Format and display fechaInicio, fechaFin, horaEvento, horaFin
    - Show "Todo el día" when no hours are provided
    - Show time range for same-day events with hours
    - Show full date-time range for multi-day events
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 9.4 Write property test for end fields display when present
    - **Property 8: End Fields Display When Present**
    - **Validates: Requirements 7.1, 7.2**
    - Generate events with fechaFin and horaFin
    - Verify these fields are included in API responses and displayed correctly
  
  - [ ]* 9.5 Write property test for end fields omission when absent
    - **Property 9: End Fields Omission When Absent**
    - **Validates: Requirements 1.3, 1.4, 7.3, 7.4**
    - Generate events without fechaFin and horaFin
    - Verify events are treated as single-day with no end time
  
  - [ ]* 9.6 Write unit tests for CalendarioMensual
    - Test single-day event displays on one day only
    - Test multi-day event displays on all days of range
    - Test different CSS classes applied to first, middle, and last day
    - Test tooltip shows correct duration information
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4_

- [ ] 10. Implement backward compatibility handling
  - [x] 10.1 Ensure null handling in backend queries
    - Treat null fechaFin as equal to fechaEvento in range calculations
    - Handle null values in expandirEventosMultiDia method
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 10.2 Ensure null handling in frontend display
    - Display events without fechaFin as single-day events
    - Display events without horaFin without end time
    - Handle null values in calendar rendering without errors
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ]* 10.3 Write property test for null handling in queries and display
    - **Property 10: Null Handling in Queries and Display**
    - **Validates: Requirements 8.3**
    - Generate events with various null combinations
    - Verify all operations handle nulls correctly without errors
  
  - [ ]* 10.4 Write property test for backward compatibility
    - **Property 11: Backward Compatibility with Existing Events**
    - **Validates: Requirements 1.5, 8.1, 8.2, 8.4**
    - Simulate existing events with null fechaFin and horaFin
    - Verify queries, updates, and display work correctly
    - Verify updating existing events to add fechaFin and horaFin works
  
  - [ ]* 10.5 Write unit tests for backward compatibility
    - Test existing events without fechaFin continue to work
    - Test updating existing event to add fechaFin
    - Test querying mix of old and new events
    - _Requirements: 1.5, 8.1, 8.2, 8.4_

- [x] 11. Final checkpoint and integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check library with minimum 100 iterations per property
- Backend uses NestJS with Prisma ORM and TypeScript
- Frontend uses React with TypeScript and Vitest for testing
- All 11 correctness properties from the design document are covered by property tests
- Validation logic is consistent between create and update operations
- Multi-day events are expanded to show on all days of their range
- Full backward compatibility maintained with existing single-day events
