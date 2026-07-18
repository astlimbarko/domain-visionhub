# Implementation Tasks

## Task 1: Database Schema - Create Evangelismo CDP Tables

**Status:** completed

**Description:**
Create the database schema for evangelismo CDP system including tipo_evangelismo_cdpz and evangelismo_cdpz tables with proper relationships and indexes.

**Acceptance Criteria:**
- [ ] Migration file created for tipo_evangelismo_cdpz table
- [ ] Migration file created for evangelismo_cdpz table
- [ ] Foreign key relationships established (persona_id, tipo_evangelismo_id, casa_de_paz_id, reporte_id, evangelizador_id)
- [ ] Indexes created on foreign key columns
- [ ] Seed data added for tipo_evangelismo (Elite, 1+1)
- [ ] Migration runs successfully without errors
- [ ] Prisma schema updated with new models

**Files to Modify:**
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/[timestamp]_add_evangelismo_cdp_tables/migration.sql`
- `backend/prisma/seed.ts`

---

## Task 2: Backend - Create Evangelismo CDP Module

**Status:** completed

**Description:**
Create a new NestJS module for evangelismo-cdp with service, controller, and DTOs to handle evangelismo operations within Casa de Paz reports.

**Acceptance Criteria:**
- [ ] evangelismo-cdp.module.ts created and registered in app.module.ts
- [ ] evangelismo-cdp.service.ts created with business logic
- [ ] evangelismo-cdp.controller.ts created with REST endpoints
- [ ] DTOs created: CreateEvangelismoCdpDto, EvangelismoCdpDto, TipoEvangelismoDto
- [ ] Service methods handle transactions atomically
- [ ] Error handling implemented for all operations

**Files to Create:**
- `backend/src/modules/evangelismo-cdp/evangelismo-cdp.module.ts`
- `backend/src/modules/evangelismo-cdp/evangelismo-cdp.service.ts`
- `backend/src/modules/evangelismo-cdp/evangelismo-cdp.controller.ts`
- `backend/src/modules/evangelismo-cdp/dto/create-evangelismo-cdp.dto.ts`
- `backend/src/modules/evangelismo-cdp/dto/evangelismo-cdp.dto.ts`
- `backend/src/modules/evangelismo-cdp/dto/tipo-evangelismo.dto.ts`

**Files to Modify:**
- `backend/src/app.module.ts`

---

## Task 3: Backend - Implement API Endpoints

**Status:** completed

**Description:**
Implement REST API endpoints for evangelismo CDP operations including create, list, get tipos, and search personas.

**Acceptance Criteria:**
- [ ] POST /api/evangelismo-cdp endpoint implemented
- [ ] GET /api/evangelismo-cdp/tipos endpoint implemented
- [ ] GET /api/evangelismo-cdp?casaDePazId={id} endpoint implemented
- [ ] GET /api/personas/search?q={query}&casaDePazId={id} endpoint implemented
- [ ] Endpoints properly authenticated with JWT guards
- [ ] Role-based authorization implemented (lider, sublider)
- [ ] Request validation using class-validator
- [ ] Response transformation using interceptors

**Files to Modify:**
- `backend/src/modules/evangelismo-cdp/evangelismo-cdp.controller.ts`
- `backend/src/modules/evangelismo-cdp/evangelismo-cdp.service.ts`
- `backend/src/modules/personas/personas.controller.ts` (add search endpoint)
- `backend/src/modules/personas/personas.service.ts` (add search method)

---

## Task 4: Backend - Enhance Casa de Paz Service

**Status:** completed

**Description:**
Enhance casas-de-paz.service.ts to integrate evangelismo data when creating reports and implement hierarchical goal calculations.

**Acceptance Criteria:**
- [ ] createReporte method accepts evangelismo data array
- [ ] Transaction creates persona (if new), evangelismo_cdp, and reporte atomically
- [ ] getMetaEvangelismo method calculates church, CDP, and individual goals
- [ ] Progress percentages calculated correctly for each level
- [ ] Goal validation ensures CDP <= Church and Individual <= CDP
- [ ] Error handling for failed transactions with proper rollback

**Files to Modify:**
- `backend/src/modules/casas-de-paz/casas-de-paz.service.ts`
- `backend/src/modules/casas-de-paz/casas-de-paz.controller.ts`
- `backend/src/modules/casas-de-paz/dto/create-reporte.dto.ts`

---

## Task 5: Frontend - Create BuscadorPersonas Component

**Status:** completed

**Description:**
Create an intelligent search component with autocomplete for finding existing personas or triggering inline creation.

**Acceptance Criteria:**
- [ ] Component renders input field with search icon
- [ ] Debounced search triggers after 300ms of typing
- [ ] Dropdown displays matching results with highlighting
- [ ] "Agregar nuevo" option shown when no results found
- [ ] Loading state displayed during search
- [ ] Keyboard navigation supported (arrow keys, enter, escape)
- [ ] Accessible with proper ARIA attributes
- [ ] Responsive design for mobile

**Files to Create:**
- `frontend/src/components/evangelismo/BuscadorPersonas.tsx`
- `frontend/src/components/evangelismo/BuscadorPersonas.module.css`

---

## Task 6: Frontend - Create EvangelizadoForm Component

**Status:** completed

**Description:**
Create inline form for adding new personas with fields: nombre, apellidos, telefono, direccion, ssva.

**Acceptance Criteria:**
- [ ] Form displays all required fields (nombre, apellidos)
- [ ] Form displays optional fields (telefono, direccion)
- [ ] SSVA checkbox implemented
- [ ] Form validation using zod schema
- [ ] Error messages displayed for invalid fields
- [ ] Submit button disabled during submission
- [ ] Cancel button clears form and closes
- [ ] Responsive layout for mobile
- [ ] Accessible form labels and error announcements

**Files to Create:**
- `frontend/src/components/evangelismo/EvangelizadoForm.tsx`
- `frontend/src/components/evangelismo/EvangelizadoForm.module.css`

---

## Task 7: Frontend - Create TipoEvangelismoSelector Component

**Status:** completed

**Description:**
Create dropdown selector for evangelismo types (Elite, 1+1) with conditional field rendering based on selection.

**Acceptance Criteria:**
- [ ] Dropdown populated from API (GET /api/evangelismo-cdp/tipos)
- [ ] Selection triggers conditional field display
- [ ] Different fields shown for Elite vs 1+1
- [ ] Field configuration loaded from tipo_evangelismo.camposRequeridos
- [ ] Required fields validated before submission
- [ ] Clear visual indication of selected type
- [ ] Accessible with proper labels

**Files to Create:**
- `frontend/src/components/evangelismo/TipoEvangelismoSelector.tsx`
- `frontend/src/components/evangelismo/CamposCondicionales.tsx`

---

## Task 8: Frontend - Create SeccionEvangelismo Component

**Status:** completed

**Description:**
Create main section that integrates BuscadorPersonas, EvangelizadoForm, TipoEvangelismoSelector, and displays list of evangelizados in the report.

**Acceptance Criteria:**
- [ ] Component integrates all evangelismo subcomponents
- [ ] List displays added evangelizados with edit/delete actions
- [ ] Add button triggers new evangelizado entry
- [ ] State management handles multiple evangelizados
- [ ] Validation ensures at least one evangelizado before report submission
- [ ] Visual feedback for successful additions
- [ ] Responsive layout with proper spacing

**Files to Create:**
- `frontend/src/components/casas-de-paz/SeccionEvangelismo.tsx`
- `frontend/src/components/evangelismo/ListaEvangelizados.tsx`

---

## Task 9: Frontend - Integrate with NuevoReporte

**Status:** completed

**Description:**
Integrate SeccionEvangelismo into NuevoReporte.tsx and update report submission to include evangelismo data.

**Acceptance Criteria:**
- [ ] SeccionEvangelismo added to NuevoReporte form
- [ ] Report submission includes evangelismo array
- [ ] Form validation includes evangelismo section
- [ ] Success message confirms evangelismo records created
- [ ] Error handling displays specific evangelismo errors
- [ ] Loading state during submission
- [ ] Navigation after successful submission

**Files to Modify:**
- `frontend/src/pages/NuevoReporte.tsx`
- `frontend/src/services/casas-de-paz.service.ts`

---

## Task 10: Frontend - Create Evangelismo CDP Service

**Status:** completed

**Description:**
Create frontend service for evangelismo-cdp API calls with proper error handling and type safety.

**Acceptance Criteria:**
- [ ] Service methods for all evangelismo-cdp endpoints
- [ ] TypeScript interfaces for request/response types
- [ ] Error handling with user-friendly messages
- [ ] Request/response interceptors for auth tokens
- [ ] Proper HTTP status code handling

**Files to Create:**
- `frontend/src/services/evangelismo-cdp.service.ts`
- `frontend/src/types/evangelismo-cdp.types.ts`

---

## Task 11: Frontend - Remove Standalone Buttons

**Status:** completed

**Description:**
Remove "Agregar Evangelismo" and "Agregar Persona" buttons from their respective modules while preserving read/edit functionality.

**Acceptance Criteria:**
- [ ] "Agregar Evangelismo" button removed from Evangelismo.tsx
- [ ] "Agregar Persona" button removed from Personas.tsx
- [ ] List view and edit functionality preserved in both modules
- [ ] No console errors after button removal
- [ ] UI layout adjusts properly without buttons

**Files to Modify:**
- `frontend/src/pages/Evangelismo.tsx`
- `frontend/src/pages/Personas.tsx`

---

## Task 12: Frontend - Implement Responsive Mobile Menu

**Status:** completed

**Description:**
Create hamburger menu component for mobile navigation with smooth animations and proper accessibility.

**Acceptance Criteria:**
- [ ] Hamburger icon displayed on screens < 768px
- [ ] Menu slides in/out with smooth animation
- [ ] All navigation items accessible in mobile menu
- [ ] Menu closes on outside click
- [ ] Menu closes on navigation item click
- [ ] Focus trap implemented when menu open
- [ ] Accessible with keyboard navigation
- [ ] ARIA attributes for screen readers

**Files to Create:**
- `frontend/src/components/layout/HamburgerButton.tsx`
- `frontend/src/components/layout/MobileMenu.tsx`
- `frontend/src/components/layout/MobileMenu.module.css`

**Files to Modify:**
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Layout.tsx`

---

## Task 13: Frontend - Implement Hierarchical Goal Cards

**Status:** pending

**Description:**
Modify Meta de Evangelismo cards to display hierarchical goals (church, CDP, individual) with progress indicators.

**Acceptance Criteria:**
- [ ] Three separate cards for church, CDP, and individual goals
- [ ] Each card displays goal, actual, and progress percentage
- [ ] Progress bars with color coding (green >= 80%, yellow >= 50%, red < 50%)
- [ ] API call to GET /api/casas-de-paz/{id}/meta-evangelismo
- [ ] Real-time updates when evangelismo records added
- [ ] Responsive layout for mobile
- [ ] Loading skeleton while fetching data

**Files to Create:**
- `frontend/src/components/casas-de-paz/MetaEvangelismoCard.tsx`
- `frontend/src/components/casas-de-paz/MetaEvangelismoCard.module.css`

**Files to Modify:**
- `frontend/src/pages/Dashboard.tsx` (or wherever meta cards are displayed)

---

## Task 14: Frontend - Modify Timeline Graph

**Status:** completed

**Description:**
Remove "Conversiones" data series from timeline graph while preserving all other functionality.

**Acceptance Criteria:**
- [ ] "Conversiones" series removed from graph data
- [ ] Graph legend updated (no conversiones entry)
- [ ] All other data series remain functional
- [ ] Date range filtering still works
- [ ] Graph scales and axes adjust properly
- [ ] No visual artifacts from removal
- [ ] Responsive behavior maintained

**Files to Modify:**
- `frontend/src/components/dashboards/TimelineGraph.tsx` (or similar)
- `frontend/src/services/dashboards.service.ts` (if conversiones fetched separately)

---

## Task 15: Testing and Integration

**Status:** completed

**Description:**
Comprehensive testing of all components and integration points to ensure system works end-to-end.

**Acceptance Criteria:**
- [ ] All backend endpoints tested with Postman/Insomnia
- [ ] Database migrations run successfully
- [ ] Frontend components render without errors
- [ ] Complete flow: search → create person → select type → add evangelismo → submit report
- [ ] Hierarchical goals calculate correctly
- [ ] Mobile responsive design tested on multiple devices
- [ ] Browser compatibility tested (Chrome, Firefox, Safari, Edge)
- [ ] No console errors or warnings
- [ ] Performance acceptable (< 2s for report submission)

**Testing Checklist:**
- [ ] Create report with existing persona
- [ ] Create report with new persona inline
- [ ] Test both evangelismo types (Elite, 1+1)
- [ ] Test conditional fields display correctly
- [ ] Test goal calculations at all three levels
- [ ] Test mobile menu functionality
- [ ] Test timeline graph without conversiones
- [ ] Test error scenarios (network errors, validation errors)

---

## Implementation Order

1. Task 1: Database Schema
2. Task 2: Backend Module
3. Task 3: Backend API Endpoints
4. Task 4: Backend Casa de Paz Enhancement
5. Task 10: Frontend Service Layer
6. Task 5: BuscadorPersonas Component
7. Task 6: EvangelizadoForm Component
8. Task 7: TipoEvangelismoSelector Component
9. Task 8: SeccionEvangelismo Component
10. Task 9: Integration with NuevoReporte
11. Task 11: Remove Standalone Buttons
12. Task 12: Mobile Menu
13. Task 13: Hierarchical Goal Cards
14. Task 14: Timeline Graph Modification
15. Task 15: Testing and Integration
