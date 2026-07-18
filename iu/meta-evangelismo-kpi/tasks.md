# Implementation Plan: Meta de Evangelismo KPI

## Overview

This implementation replaces the "Conversiones" and "Tasa de Conversión" KPI cards with "Meta de Evangelismo" and "Tasa de Evangelismo" cards. The líder can set and edit evangelism goals, and the system calculates the evangelism rate as a percentage of the goal achieved.

The implementation follows a bottom-up approach: database schema → backend API → frontend UI → integration testing.

## Tasks

- [x] 1. Database schema extension
  - [x] 1.1 Create Prisma migration for meta_evangelismo field
    - Add meta_evangelismo column to casa_de_paz table (nullable integer)
    - Add column comment for documentation
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 Run migration and verify schema
    - Execute migration against development database
    - Verify existing records preserved with null meta values
    - _Requirements: 11.1_
  
  - [x] 1.3 Update Prisma schema model
    - Add metaEvangelismo field to CasaDePaz model
    - Configure field mapping with @map("meta_evangelismo")
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.4 Generate Prisma client types
    - Run prisma generate to update TypeScript types
    - Verify meta_evangelismo included in generated types
    - _Requirements: 10.1_

- [x] 2. Backend API implementation
  - [x] 2.1 Create UpdateMetaEvangelismoDto
    - Define DTO with validation decorators (@IsOptional, @IsInt, @Min)
    - Add Swagger API documentation annotations
    - _Requirements: 2.3, 10.1_
  
  - [x] 2.2 Implement updateMetaEvangelismo service method
    - Verify casa de paz exists (throw NotFoundException if not found)
    - Verify user is líder (throw ForbiddenException if not authorized)
    - Validate meta value (reject negative numbers)
    - Update meta_evangelismo field in database
    - Return updated casa de paz with relations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 9.1, 9.2, 9.3, 12.3_
  
  - [ ]* 2.3 Write property test for authorization (Property 1)
    - **Property 1: Authorization for Meta Updates**
    - **Validates: Requirements 2.1, 9.1, 9.2**
    - Generate random user/casa combinations with líder status
    - Verify requests succeed only when user is líder
  
  - [ ]* 2.4 Write property test for round-trip consistency (Property 2)
    - **Property 2: Meta Value Round-Trip**
    - **Validates: Requirements 2.2, 3.3, 4.3**
    - Generate random positive integers
    - Store and retrieve, verify values match
  
  - [ ]* 2.5 Write property test for invalid input rejection (Property 3)
    - **Property 3: Invalid Input Rejection**
    - **Validates: Requirements 2.3**
    - Generate invalid values (negative, non-integer, NaN, Infinity)
    - Verify all rejected with 400 error
  
  - [ ]* 2.6 Write unit tests for service method
    - Test null value clears existing meta (2.4)
    - Test error messages for each failure scenario
    - Test authorization for non-líder users
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2_
  
  - [x] 2.7 Add PATCH endpoint to controller
    - Create @Patch(':id/meta-evangelismo') endpoint
    - Add Swagger documentation (@ApiOperation, @ApiResponse)
    - Extract user from request, parse casaDePazId
    - Call updateMetaEvangelismo service method
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_
  
  - [ ]* 2.8 Write integration tests for PATCH endpoint
    - Test successful update by líder
    - Test rejection of sublíder update
    - Test 404 for non-existent casa de paz
    - Test 400 for invalid meta values
    - _Requirements: 2.1, 2.2, 2.3, 9.1, 9.2_
  
  - [x] 2.9 Verify GET endpoint includes meta_evangelismo
    - Confirm existing findOne method returns meta_evangelismo field
    - No code changes needed (Prisma auto-includes all fields)
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 2.10 Write property test for API response inclusion (Property 4)
    - **Property 4: Meta Field in API Response**
    - **Validates: Requirements 4.1**
    - Generate random casa de paz IDs
    - Verify response includes metaEvangelismo property

- [x] 3. Checkpoint - Backend complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 4. Frontend type definitions
  - [x] 4.1 Update CasaDePaz interface
    - Add metaEvangelismo?: number | null to type definition
    - Update in types/casa-de-paz.types.ts
    - _Requirements: 10.2, 10.3_
  
  - [x] 4.2 Update EvangelismoStats interface
    - Add meta_evangelismo?: number | null field
    - Add tasa_evangelismo?: number | null field (calculated)
    - Update in types/dashboard.types.ts
    - _Requirements: 10.2, 10.3_
  
  - [x] 4.3 Create API service method
    - Implement updateMetaEvangelismo in casas-de-paz.service.ts
    - Use PATCH /casas-de-paz/:id/meta-evangelismo endpoint
    - Return typed CasaDePaz response
    - _Requirements: 6.3_

- [x] 5. Frontend Meta de Evangelismo card
  - [x] 5.1 Create MetaEvangelismoCard component
    - Accept metaEvangelismo, isLider, onUpdate props
    - Display current meta or "Sin meta" when null
    - Show edit button only when isLider is true
    - Implement inline edit mode with input field
    - Add save/cancel buttons in edit mode
    - Handle loading and error states
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.4, 6.5, 6.6, 12.1, 12.4_
  
  - [ ]* 5.2 Write property test for meta display (Property 5)
    - **Property 5: Meta Display in UI**
    - **Validates: Requirements 5.3**
    - Generate random positive integers
    - Render component, verify displayed text matches value
  
  - [ ]* 5.3 Write property test for input validation (Property 6)
    - **Property 6: Input Validation in UI**
    - **Validates: Requirements 6.2**
    - Generate random positive integers
    - Verify input accepted and save button enabled
  
  - [ ]* 5.4 Write property test for UI update flow (Property 7)
    - **Property 7: UI Update Flow**
    - **Validates: Requirements 6.3, 6.4**
    - Generate random meta values
    - Submit value, verify API called and UI updated
  
  - [ ]* 5.5 Write unit tests for MetaEvangelismoCard
    - Test "Sin meta" display when null (5.2, 12.1)
    - Test edit button visible to líder (5.4)
    - Test edit button hidden from sublíder (5.5)
    - Test edit mode activation (6.1)
    - Test cancel without API call (6.6)
    - Test error message display (6.5)
    - _Requirements: 5.2, 5.4, 5.5, 6.1, 6.5, 6.6, 12.1_

- [x] 6. Frontend Tasa de Evangelismo card
  - [x] 6.1 Create TasaEvangelismoCard component
    - Accept evangelizados and metaEvangelismo props
    - Calculate tasa: (evangelizados / metaEvangelismo) * 100
    - Display "Sin meta" when meta is null or zero
    - Format tasa as "XX.XX%" with 2 decimal places
    - Handle null/undefined meta gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 12.1, 12.2, 12.4_
  
  - [ ]* 6.2 Write property test for tasa calculation (Property 8)
    - **Property 8: Tasa Calculation**
    - **Validates: Requirements 7.1**
    - Generate random meta and evangelizados values
    - Verify calculated tasa equals (evangelizados / meta) * 100
  
  - [ ]* 6.3 Write property test for tasa formatting (Property 9)
    - **Property 9: Tasa Formatting**
    - **Validates: Requirements 7.2, 8.3, 8.4**
    - Generate random tasa values
    - Verify format matches /^\d+\.\d{2}%$/
  
  - [ ]* 6.4 Write unit tests for TasaEvangelismoCard
    - Test "Sin meta" when meta is null (8.2, 12.1)
    - Test "Sin meta" when meta is zero (7.4)
    - Test percentage format with 2 decimals (8.4)
    - Test undefined treated as null (12.4)
    - _Requirements: 7.3, 7.4, 8.2, 8.4, 12.1, 12.2, 12.4_

- [x] 7. Checkpoint - Frontend components complete
  - Ensure all component tests pass, ask the user if questions arise.

- [x] 8. Evangelismo page integration
  - [x] 8.1 Update Evangelismo.tsx page
    - Fetch casa de paz data to get metaEvangelismo and líder status
    - Replace "Conversiones" card with MetaEvangelismoCard
    - Replace "Tasa de Conversión" card with TasaEvangelismoCard
    - Keep "Evangelizados" card in current position
    - Pass appropriate props to new cards
    - Implement onUpdate handler for meta changes
    - _Requirements: 5.1, 8.1, 11.3_
  
  - [x] 8.2 Add state management for meta editing
    - Add local state for isEditing, editValue, isSaving
    - Implement edit flow: edit → validate → save → refresh
    - Handle API errors with user feedback
    - Implement optimistic updates with rollback on error
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 8.3 Write integration tests for Evangelismo page
    - Test card replacement (Conversiones → Meta, Tasa Conversión → Tasa)
    - Test Evangelizados card remains in position (11.3)
    - Test líder can edit meta
    - Test sublíder cannot edit meta
    - Test meta update flow end-to-end
    - _Requirements: 5.1, 5.4, 5.5, 8.1, 11.3_

- [ ] 9. Backend property test for update overwrite (Property 10)
  - [ ]* 9.1 Write property test for value overwrite (Property 10)
    - **Property 10: Update Overwrites Previous Value**
    - **Validates: Requirements 3.2**
    - Generate two different meta values
    - Set first value, then second value
    - Verify stored value equals second value only

- [x] 10. Final integration and verification
  - [x] 10.1 Verify backward compatibility
    - Confirm existing casa_de_paz records have null meta (11.1)
    - Confirm all existing API endpoints work (11.2)
    - Confirm conversiones data unchanged in other modules (11.4)
    - _Requirements: 11.1, 11.2, 11.4_
  
  - [x] 10.2 End-to-end manual testing
    - Test complete líder workflow: set meta → view tasa → edit meta
    - Test sublíder view-only access
    - Test null meta handling throughout system
    - Test error scenarios and recovery
    - _Requirements: All requirements_
  
  - [x] 10.3 Code review and cleanup
    - Review all code for consistency and best practices
    - Remove any debug logging or commented code
    - Verify TypeScript types are correct
    - Ensure error messages are user-friendly

- [x] 11. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows a bottom-up approach to ensure each layer is solid before building on it
- Checkpoints ensure incremental validation and provide opportunities for user feedback
