# Design Document

## High-Level Design

### System Architecture

The evangelismo reporting system enhancement integrates into the existing Casa de Paz reporting workflow. The architecture follows a three-tier pattern:

```
Frontend (React + TypeScript)
    ↓
Backend API (NestJS)
    ↓
Database (PostgreSQL via Prisma)
```

### Component Overview

#### Frontend Components
1. **BuscadorPersonas**: Intelligent search component with autocomplete
2. **EvangelizadoForm**: Inline person creation form
3. **TipoEvangelismoSelector**: Dropdown for evangelismo type selection
4. **SeccionEvangelismo**: Main section integrating all evangelismo components in NuevoReporte
5. **MetaEvangelismoCard**: Enhanced goal tracking cards with hierarchical display
6. **TimelineGraph**: Modified timeline without conversiones data series
7. **HamburgerMenu**: Mobile navigation component

#### Backend Modules
1. **evangelismo-cdp.module**: New module for Casa de Paz evangelismo operations
2. **evangelismo-cdp.service**: Business logic for evangelismo records
3. **evangelismo-cdp.controller**: REST API endpoints
4. **casas-de-paz.service**: Enhanced to integrate evangelismo data

### Database Schema

#### New Tables

**tipo_evangelismo_cdpz**
- id: INT (PK, auto-increment)
- nombre: VARCHAR(50) (Elite, 1+1)
- descripcion: TEXT (optional)
- campos_requeridos: JSON (conditional field configuration)
- created_at, updated_at, deleted_at
- created_by, updated_by, deleted_by

**evangelismo_cdpz**
- id: INT (PK, auto-increment)
- persona_id: INT (FK → persona.id)
- tipo_evangelismo_id: INT (FK → tipo_evangelismo_cdpz.id)
- casa_de_paz_id: INT (FK → casa_de_paz.id)
- reporte_id: INT (FK → casa_de_paz_reporte.id, optional)
- evangelizador_id: INT (FK → persona.id)
- fecha_evangelismo: DATE
- ssva: BOOLEAN
- datos_adicionales: JSON (type-specific fields)
- observaciones: TEXT
- created_at, updated_at, deleted_at
- created_by, updated_by, deleted_by

#### Modified Tables

**casa_de_paz**
- Add: meta_evangelismo_iglesia: INT (church-level goal)
- Add: meta_evangelismo_cdp: INT (CDP-level goal)
- Existing: meta_evangelismo: INT (renamed to meta_evangelismo_individual)

### Data Flow

#### Person Search Flow
```
User types → BuscadorPersonas
    ↓
Debounced API call → GET /api/personas/search?q={query}&casaDePazId={id}
    ↓
Display results with autocomplete
    ↓
User selects existing OR clicks "Agregar nuevo"
    ↓
If new: Show EvangelizadoForm inline
```

#### Evangelismo Record Creation Flow
```
User fills form in SeccionEvangelismo
    ↓
Select tipo_evangelismo → Load conditional fields
    ↓
Fill required fields based on type
    ↓
Submit reporte → POST /api/casas-de-paz/reportes
    ↓
Backend creates:
  1. Persona (if new)
  2. evangelismo_cdpz record
  3. casa_de_paz_reporte record
    ↓
Transaction committed atomically
```

#### Hierarchical Goal Calculation Flow
```
GET /api/casas-de-paz/{id}/meta-evangelismo
    ↓
Backend calculates:
  - Church-level: SUM(all CDPs in church)
  - CDP-level: SUM(individual goals in CDP)
  - Individual: Direct from meta_evangelismo_individual
    ↓
Return progress percentages for each level
```

## Low-Level Design

### API Endpoints

#### Evangelismo CDP Module

**POST /api/evangelismo-cdp**
```typescript
Request Body: {
  personaId?: number;
  personaNueva?: {
    nombre: string;
    apellidos: string;
    telefono?: string;
    direccion?: string;
  };
  tipoEvangelismoId: number;
  casaDePazId: number;
  reporteId?: number;
  evangelizadorId: number;
  fechaEvangelismo: string;
  ssva: boolean;
  datosAdicionales?: Record<string, any>;
  observaciones?: string;
}

Response: {
  id: number;
  persona: PersonaDto;
  tipoEvangelismo: TipoEvangelismoDto;
  fechaEvangelismo: string;
  ssva: boolean;
}
```

**GET /api/evangelismo-cdp/tipos**
```typescript
Response: TipoEvangelismoDto[] = [{
  id: number;
  nombre: string;
  descripcion: string;
  camposRequeridos: {
    fieldName: string;
    type: string;
    required: boolean;
    label: string;
  }[];
}]
```

**GET /api/evangelismo-cdp?casaDePazId={id}&periodo={periodo}**
```typescript
Response: {
  total: number;
  data: EvangelismoCdpDto[];
}
```

**GET /api/personas/search?q={query}&casaDePazId={id}**
```typescript
Response: PersonaDto[] = [{
  id: number;
  nombreCompleto: string;
  telefono?: string;
  edad?: number;
}]
```

**GET /api/casas-de-paz/{id}/meta-evangelismo**
```typescript
Response: {
  iglesia: {
    meta: number;
    actual: number;
    progreso: number; // percentage
  };
  cdp: {
    meta: number;
    actual: number;
    progreso: number;
  };
  individual: {
    meta: number;
    actual: number;
    progreso: number;
  };
}
```

### Frontend Component Specifications

#### BuscadorPersonas Component

**Props:**
```typescript
interface BuscadorPersonasProps {
  casaDePazId: number;
  onSelect: (persona: PersonaDto | null) => void;
  onCreateNew: () => void;
  placeholder?: string;
  disabled?: boolean;
}
```

**State:**
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [results, setResults] = useState<PersonaDto[]>([]);
const [loading, setLoading] = useState(false);
const [showDropdown, setShowDropdown] = useState(false);
```

**Key Functions:**
```typescript
const debouncedSearch = useMemo(
  () => debounce(async (query: string) => {
    if (query.length < 2) return;
    setLoading(true);
    const data = await personasService.search(query, casaDePazId);
    setResults(data);
    setLoading(false);
  }, 300),
  [casaDePazId]
);
```

#### EvangelizadoForm Component

**Props:**
```typescript
interface EvangelizadoFormProps {
  onSubmit: (data: PersonaNuevaDto) => void;
  onCancel: () => void;
  loading?: boolean;
}
```

**Validation:**
```typescript
const schema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  apellidos: z.string().min(1, 'Apellidos requeridos'),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  ssva: z.boolean().default(false),
});
```

#### TipoEvangelismoSelector Component

**Props:**
