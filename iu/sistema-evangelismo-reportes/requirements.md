# Requirements Document

## Introduction

This document specifies requirements for enhancing the evangelismo reporting system within Casa de Paz reports. The enhancement streamlines the workflow by removing standalone data entry buttons, implementing intelligent search with inline person creation, adding evangelismo type classification, and improving the goal tracking system with hierarchical goals at church, CDP, and individual levels.

## Glossary

- **Sistema**: The evangelismo reporting system
- **Reporte_CDP**: Casa de Paz report module
- **Módulo_Evangelismo**: The evangelismo management module
- **Módulo_Personas**: The person management module
- **Usuario**: A user of the system (leader or administrator)
- **Persona**: An individual person record in the database
- **Evangelismo**: An evangelism activity record
- **Tipo_Evangelismo**: The type/category of evangelism activity (Elite or 1+1)
- **SSVA**: A boolean attribute for evangelism records
- **Búsqueda_Inteligente**: Intelligent search component that searches existing records and allows inline creation
- **Meta_Evangelismo**: Evangelism goal tracking system
- **Iglesia**: Church organization level
- **CDP**: Casa de Paz (Peace House) organizational unit
- **Gráfico_Timeline**: Timeline visualization component
- **Menú_Hamburguesa**: Mobile navigation menu component

## Requirements

### Requirement 1: Remove Standalone Entry Buttons

**User Story:** As a system administrator, I want to remove standalone data entry buttons from evangelismo and personas modules, so that data entry is streamlined through the reporting workflow.

#### Acceptance Criteria

1. THE Sistema SHALL remove the "Agregar Evangelismo" button from Módulo_Evangelismo
2. THE Sistema SHALL remove the "Agregar Persona" button from Módulo_Personas
3. THE Sistema SHALL preserve all existing evangelismo and persona records after button removal
4. THE Sistema SHALL maintain read and edit functionality for existing records in both modules

### Requirement 2: Implement Intelligent Search in Reports

**User Story:** As a leader, I want to search for people when creating evangelismo records in Casa de Paz reports, so that I can quickly find existing people or add new ones inline.

#### Acceptance Criteria

1. WHEN a Usuario types in the evangelismo person field within Reporte_CDP, THE Búsqueda_Inteligente SHALL search for matching Persona records in the database
2. THE Búsqueda_Inteligente SHALL display matching results as the Usuario types
3. WHEN no matching Persona is found, THE Búsqueda_Inteligente SHALL display an option to create a new Persona inline
4. WHEN a Usuario selects an existing Persona, THE Sistema SHALL populate the evangelismo record with that Persona reference
5. WHEN a Usuario chooses to create a new Persona inline, THE Sistema SHALL display the inline person creation form

### Requirement 3: Inline Person Creation Form

**User Story:** As a leader, I want to add new people directly within the evangelismo report, so that I don't need to navigate to a separate module.

#### Acceptance Criteria

1. WHEN a Usuario initiates inline person creation, THE Sistema SHALL display a form with fields for Nombre, Apellidos, Teléfono, Dirección, and SSVA
2. THE Sistema SHALL validate that Nombre is not empty before allowing form submission
3. THE Sistema SHALL validate that Apellidos is not empty before allowing form submission
4. THE Sistema SHALL accept Teléfono as an optional field
5. THE Sistema SHALL accept Dirección as an optional field
6. THE Sistema SHALL display SSVA as a boolean checkbox
7. WHEN the form is submitted with valid data, THE Sistema SHALL create a new Persona record in the database
8. WHEN a new Persona is created, THE Sistema SHALL automatically associate it with the current evangelismo record

### Requirement 4: Evangelismo Type Selection

**User Story:** As a leader, I want to specify the type of evangelismo activity, so that activities are properly categorized.

#### Acceptance Criteria

1. THE Sistema SHALL display a combobox for selecting Tipo_Evangelismo
2. THE Sistema SHALL populate the combobox with options from the tipo_evangelismo_cdpz table
3. THE Sistema SHALL include "Elite" as a Tipo_Evangelismo option
4. THE Sistema SHALL include "1+1" as a Tipo_Evangelismo option
5. THE Sistema SHALL require Tipo_Evangelismo selection before allowing evangelismo record creation
6. WHEN a Tipo_Evangelismo is selected, THE Sistema SHALL store the selection with the evangelismo record

### Requirement 5: Conditional Field Display

**User Story:** As a leader, I want to see different form fields based on the evangelismo type I select, so that I only provide relevant information for each type.

#### Acceptance Criteria

1. WHEN a Usuario selects a Tipo_Evangelismo, THE Sistema SHALL display fields specific to that type
2. WHEN a Usuario changes the selected Tipo_Evangelismo, THE Sistema SHALL update the displayed fields accordingly
3. THE Sistema SHALL hide fields that are not applicable to the selected Tipo_Evangelismo
4. THE Sistema SHALL preserve field values when switching between types if the fields are common to both types

### Requirement 6: Database Schema for Evangelismo Records

**User Story:** As a system administrator, I want dedicated database tables for evangelismo records and types, so that data is properly structured and queryable.

#### Acceptance Criteria

1. THE Sistema SHALL create an evangelismo_cdpz table with columns for id, persona_id, tipo_evangelismo_id, casa_paz_id, fecha, and SSVA
2. THE Sistema SHALL create a tipo_evangelismo_cdpz table with columns for id and nombre
3. THE Sistema SHALL establish a foreign key relationship from evangelismo_cdpz.persona_id to the Persona table
4. THE Sistema SHALL establish a foreign key relationship from evangelismo_cdpz.tipo_evangelismo_id to tipo_evangelismo_cdpz
5. THE Sistema SHALL establish a foreign key relationship from evangelismo_cdpz.casa_paz_id to the casa_de_paz table
6. THE Sistema SHALL create database indexes on foreign key columns for query performance

### Requirement 7: Integration with Existing Modules

**User Story:** As a developer, I want the new evangelismo reporting to integrate seamlessly with existing modules, so that the system remains cohesive.

#### Acceptance Criteria

1. THE Sistema SHALL maintain compatibility with existing Módulo_Evangelismo read operations
2. THE Sistema SHALL maintain compatibility with existing Módulo_Personas read operations
3. WHEN an evangelismo record is created through Reporte_CDP, THE Sistema SHALL make it visible in Módulo_Evangelismo
4. WHEN a Persona is created inline, THE Sistema SHALL make it visible in Módulo_Personas
5. THE Sistema SHALL use existing evangelismo.service.ts and casas-de-paz.service.ts for backend operations

### Requirement 8: Responsive Mobile Navigation

**User Story:** As a mobile user, I want a hamburger menu for navigation, so that I can access all features on my mobile device.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768 pixels, THE Sistema SHALL display a Menú_Hamburguesa icon
2. WHEN a Usuario taps the Menú_Hamburguesa icon, THE Sistema SHALL expand the navigation menu
3. WHEN the navigation menu is expanded, THE Sistema SHALL display all navigation options
4. WHEN a Usuario taps outside the expanded menu, THE Sistema SHALL collapse the navigation menu
5. WHEN the viewport width is 768 pixels or greater, THE Sistema SHALL display the standard navigation layout

### Requirement 9: Hierarchical Goal System

**User Story:** As a church administrator, I want to set evangelismo goals at church, CDP, and individual levels, so that I can track progress at different organizational levels.

#### Acceptance Criteria

1. THE Sistema SHALL allow setting Meta_Evangelismo at the Iglesia level
2. THE Sistema SHALL allow setting Meta_Evangelismo at the CDP level
3. THE Sistema SHALL allow setting Meta_Evangelismo at the individual level
4. WHEN displaying Meta_Evangelismo cards, THE Sistema SHALL show goals for all three levels
5. THE Sistema SHALL calculate progress for each level based on evangelismo records associated with that level
6. WHEN a CDP-level goal is set, THE Sistema SHALL validate that it does not exceed the Iglesia-level goal
7. WHEN an individual-level goal is set, THE Sistema SHALL validate that it does not exceed the CDP-level goal

### Requirement 10: Timeline Graph Modification

**User Story:** As a leader, I want to view evangelismo timeline data without conversions, so that I can focus on evangelismo activities specifically.

#### Acceptance Criteria

1. THE Sistema SHALL remove the "Conversiones" data series from Gráfico_Timeline
2. THE Sistema SHALL maintain all other data series in Gráfico_Timeline
3. THE Sistema SHALL preserve the timeline date range functionality
4. THE Sistema SHALL maintain the visual styling and layout of Gráfico_Timeline after removing conversiones
