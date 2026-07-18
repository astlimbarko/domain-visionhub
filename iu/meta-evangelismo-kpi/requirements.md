# Requirements Document

## Introduction

This feature modifies the Evangelismo module to replace the existing "Conversiones" and "Tasa de Conversión" KPI cards with new "Meta de Evangelismo" and "Tasa de Evangelismo" cards. The líder will be able to set and edit an evangelism goal for their casa de paz, and the system will calculate the evangelism rate as a percentage of the goal achieved.

## Glossary

- **Evangelismo_Module**: The frontend module that displays evangelism statistics and KPI cards
- **Meta_de_Evangelismo**: The evangelism goal number set by the líder for their casa de paz
- **Tasa_de_Evangelismo**: The evangelism rate calculated as (evangelizados / meta) * 100
- **Líder**: User role with full permissions to manage their casa de paz, including setting goals
- **Sublíder**: User role with view-only permissions for casa de paz data
- **Casa_de_Paz**: A house of peace entity in the system
- **Evangelizados**: The count of people evangelized
- **Backend_API**: The NestJS backend service layer
- **Database**: The PostgreSQL database managed by Prisma ORM
- **KPI_Card**: A visual component displaying a key performance indicator

## Requirements

### Requirement 1: Database Schema Extension

**User Story:** As a system administrator, I want the casa de paz table to store evangelism goals, so that líderes can set and track their evangelism targets.

#### Acceptance Criteria

1. THE Database SHALL include a meta_evangelismo field in the casa_de_paz table
2. THE meta_evangelismo field SHALL be an integer type
3. THE meta_evangelismo field SHALL be nullable
4. THE meta_evangelismo field SHALL have a default value of null

### Requirement 2: Set Evangelism Goal

**User Story:** As a líder, I want to set an evangelism goal for my casa de paz, so that I can track progress toward my target.

#### Acceptance Criteria

1. WHEN a líder requests to set a meta de evangelismo, THE Backend_API SHALL validate the líder has permission for the casa de paz
2. WHEN a líder provides a valid positive integer, THE Backend_API SHALL store the value in the meta_evangelismo field
3. WHEN a líder provides an invalid value, THE Backend_API SHALL return a descriptive error message
4. THE Backend_API SHALL accept null values to clear an existing meta

### Requirement 3: Update Evangelism Goal

**User Story:** As a líder, I want to update my evangelism goal, so that I can adjust targets based on changing circumstances.

#### Acceptance Criteria

1. WHEN a líder requests to update an existing meta de evangelismo, THE Backend_API SHALL validate the líder has permission for the casa de paz
2. WHEN a líder provides a new valid value, THE Backend_API SHALL replace the existing meta_evangelismo value
3. THE Backend_API SHALL return the updated meta value after successful modification

### Requirement 4: Retrieve Evangelism Goal

**User Story:** As a líder or sublíder, I want to view the current evangelism goal, so that I can see the target for my casa de paz.

#### Acceptance Criteria

1. WHEN the Evangelismo_Module requests casa de paz data, THE Backend_API SHALL include the meta_evangelismo field in the response
2. WHEN the meta_evangelismo field is null, THE Backend_API SHALL return null in the response
3. WHEN the meta_evangelismo field has a value, THE Backend_API SHALL return the integer value in the response

### Requirement 5: Display Meta de Evangelismo Card

**User Story:** As a líder or sublíder, I want to see the evangelism goal on the Evangelismo page, so that I know the current target.

#### Acceptance Criteria

1. THE Evangelismo_Module SHALL display a "Meta de Evangelismo" KPI_Card in place of the "Conversiones" card
2. WHEN the meta_evangelismo value is null, THE Evangelismo_Module SHALL display "Sin meta" in the KPI_Card
3. WHEN the meta_evangelismo value exists, THE Evangelismo_Module SHALL display the numeric value in the KPI_Card
4. WHERE the user is a líder, THE Evangelismo_Module SHALL display an edit control on the KPI_Card
5. WHERE the user is a sublíder, THE Evangelismo_Module SHALL display the KPI_Card without edit controls

### Requirement 6: Edit Meta de Evangelismo

**User Story:** As a líder, I want to edit the evangelism goal directly from the Evangelismo page, so that I can quickly update targets without navigating elsewhere.

#### Acceptance Criteria

1. WHEN a líder clicks the edit control on the Meta de Evangelismo KPI_Card, THE Evangelismo_Module SHALL display an input interface
2. THE Evangelismo_Module SHALL accept positive integer values in the input interface
3. WHEN a líder submits a valid value, THE Evangelismo_Module SHALL send the update request to the Backend_API
4. WHEN the update succeeds, THE Evangelismo_Module SHALL display the new meta value in the KPI_Card
5. WHEN the update fails, THE Evangelismo_Module SHALL display an error message to the líder
6. THE Evangelismo_Module SHALL allow the líder to cancel the edit operation without saving changes

### Requirement 7: Calculate Tasa de Evangelismo

**User Story:** As a líder or sublíder, I want to see the evangelism rate as a percentage, so that I can understand progress toward the goal.

#### Acceptance Criteria

1. WHEN the meta_evangelismo value exists and is greater than zero, THE Evangelismo_Module SHALL calculate the tasa as (evangelizados / meta_evangelismo) * 100
2. THE Evangelismo_Module SHALL round the calculated percentage to two decimal places
3. WHEN the meta_evangelismo value is null, THE Evangelismo_Module SHALL not perform the calculation
4. WHEN the meta_evangelismo value is zero, THE Evangelismo_Module SHALL not perform the calculation

### Requirement 8: Display Tasa de Evangelismo Card

**User Story:** As a líder or sublíder, I want to see the evangelism rate on the Evangelismo page, so that I can track progress toward the goal.

#### Acceptance Criteria

1. THE Evangelismo_Module SHALL display a "Tasa de Evangelismo" KPI_Card in place of the "Tasa de Conversión" card
2. WHEN the meta_evangelismo value is null or zero, THE Evangelismo_Module SHALL display "Sin meta" in the KPI_Card
3. WHEN the meta_evangelismo value exists and is greater than zero, THE Evangelismo_Module SHALL display the calculated percentage with the "%" symbol
4. THE Evangelismo_Module SHALL display the percentage in the format "XX.XX%"

### Requirement 9: Authorization Control

**User Story:** As a system administrator, I want only líderes to edit evangelism goals, so that sublíderes cannot modify targets.

#### Acceptance Criteria

1. WHEN a sublíder attempts to update a meta de evangelismo, THE Backend_API SHALL reject the request with an authorization error
2. WHEN a líder attempts to update a meta de evangelismo for a casa de paz they do not manage, THE Backend_API SHALL reject the request with an authorization error
3. THE Backend_API SHALL verify user role and casa de paz ownership before processing update requests

### Requirement 10: Type Safety

**User Story:** As a developer, I want TypeScript types to include the meta_evangelismo field, so that the codebase maintains type safety.

#### Acceptance Criteria

1. THE Backend_API SHALL include meta_evangelismo in the Casa de Paz type definition
2. THE Evangelismo_Module SHALL include meta_evangelismo in the frontend Casa de Paz type definition
3. THE type definitions SHALL specify meta_evangelismo as a nullable number type

### Requirement 11: Backward Compatibility

**User Story:** As a system administrator, I want existing functionality to remain intact, so that other modules continue working after this change.

#### Acceptance Criteria

1. WHEN the meta_evangelismo field is added to the database, THE Database SHALL preserve all existing casa_de_paz records
2. THE Backend_API SHALL continue to serve all existing endpoints without breaking changes
3. THE Evangelismo_Module SHALL maintain the "Evangelizados" KPI_Card in its current position
4. THE system SHALL not modify or remove the conversiones data or functionality in other modules

### Requirement 12: Null Handling

**User Story:** As a developer, I want the system to handle null meta values gracefully, so that the application does not crash when no goal is set.

#### Acceptance Criteria

1. WHEN the meta_evangelismo value is null, THE Evangelismo_Module SHALL display "Sin meta" without errors
2. WHEN the meta_evangelismo value is null, THE Evangelismo_Module SHALL not attempt to calculate the tasa de evangelismo
3. THE Backend_API SHALL accept and return null values for meta_evangelismo without errors
4. THE Evangelismo_Module SHALL handle undefined meta_evangelismo values the same as null values
