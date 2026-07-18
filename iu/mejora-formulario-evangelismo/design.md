# Diseño Técnico: Mejora del Formulario de Evangelismo

## Arquitectura General

### Componentes Frontend
```
NuevoReporte.tsx
  └── SeccionEvangelismo.tsx (modificado)
      ├── BuscadorPersonasGlobal.tsx (nuevo)
      ├── FormularioEvangelizado.tsx (nuevo)
      └── ListaEvangelizados.tsx (existente, modificado)
```

### Servicios Backend
```
PersonasModule
  └── PersonasController
      └── buscarGlobal() (nuevo endpoint)

EvangelismoCdpModule (existente)
  └── Validaciones mejoradas
```

## Diseño de Base de Datos

### Tablas Existentes (sin cambios)
- `persona`: Almacena datos personales
- `evangelismo_cdp`: Almacena registros de evangelismo
- `tipo_evangelismo_cdp`: Tipos de evangelismo (Elite, 1+1, etc.)
- `ssva`: Estados SSVA (NC, RE, etc.)

### Relaciones
- `evangelismo_cdp.evangelizado_id` → `persona.id`
- `evangelismo_cdp.evangelizador_id` → `persona.id`
- `evangelismo_cdp.tipo_evangelismo_cdp_id` → `tipo_evangelismo_cdp.id`

## Diseño de API

### Nuevo Endpoint: Búsqueda Global de Personas

**GET** `/api/v1/personas/buscar-global`

**Query Parameters:**
- `q` (string, required): Término de búsqueda
- `limit` (number, optional): Límite de resultados (default: 10)

**Response:**
```typescript
{
  personas: [
    {
      id: number;
      primerNombre: string;
      segundoNombre?: string;
      primerApellido: string;
      segundoApellido?: string;
      apellidoCasada?: string;
      sexo: string;
      nacimientoFecha?: string;
      correoElectronico?: string;
      telefonos: [
        {
          numero: string;
          esPrincipal: boolean;
        }
      ];
      edad?: number;
    }
  ]
}
```

**Lógica de Búsqueda:**
- Buscar en: primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
- Buscar en teléfonos asociados
- Ordenar por relevancia (coincidencias exactas primero)
- Usar ILIKE para búsqueda case-insensitive
- Limitar resultados para performance

## Diseño de Componentes Frontend

### 1. BuscadorPersonasGlobal.tsx

**Props:**
```typescript
interface BuscadorPersonasGlobalProps {
  onPersonaSeleccionada: (persona: PersonaCompleta | null) => void;
  onNuevaPersona: () => void;
}
```

**Estado:**
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [resultados, setResultados] = useState<PersonaCompleta[]>([]);
const [loading, setLoading] = useState(false);
const [showDropdown, setShowDropdown] = useState(false);
```

**Funcionalidad:**
- Debounce de 300ms en búsqueda
- Mostrar spinner mientras carga
- Mostrar "No se encontraron resultados" si no hay coincidencias
- Botón "Agregar nueva persona" siempre visible
- Al seleccionar persona, llamar a `onPersonaSeleccionada`
- Al hacer clic en "Agregar nueva", llamar a `onNuevaPersona`

**UI:**
```
┌─────────────────────────────────────┐
│ 🔍 Buscar persona...                │
├─────────────────────────────────────┤
│ Juan Pérez - 70123456 - 35 años     │
│ María Pérez - 71234567 - 28 años    │
│ Pedro Pérez - 72345678 - 42 años    │
├─────────────────────────────────────┤
│ ➕ Agregar nueva persona            │
└─────────────────────────────────────┘
```

### 2. FormularioEvangelizado.tsx

**Props:**
```typescript
interface FormularioEvangelizadoProps {
  personaInicial?: PersonaCompleta;
  onGuardar: (data: EvangelizadoData) => void;
  onCancelar: () => void;
}
```

**Estado:**
```typescript
interface FormState {
  // Datos personales
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  apellidoCasada: string;
  telefono: string;
  direccion: string;
  sexo: 'M' | 'F';
  fechaNacimiento: string;
  
  // Datos de evangelismo
  ssvaId: number;
  tipoEvangelismoId: number;
  evangelizadorId: number;
  personaQueLoTrajoId?: number;
}
```

**Validaciones:**
```typescript
const validaciones = {
  primerNombre: (v) => v.trim().length > 0,
  primerApellido: (v) => v.trim().length > 0,
  telefono: (v) => /^\+?[0-9\s-]{8,}$/.test(v),
  direccion: (v) => v.trim().length > 0,
  sexo: (v) => ['M', 'F'].includes(v),
  fechaNacimiento: (v) => isValidDate(v) && isPastDate(v),
  ssvaId: (v) => v > 0,
  tipoEvangelismoId: (v) => v > 0,
  evangelizadorId: (v) => v > 0,
};
```

**Lógica Condicional:**
```typescript
// Mostrar "Apellido de casada" solo si sexo === 'F'
{sexo === 'F' && (
  <Input
    label="Apellido de casada (opcional)"
    value={apellidoCasada}
    onChange={setApellidoCasada}
  />
)}

// Mostrar "Persona que lo trajo" solo si tipo es Elite o 1+1
{(tipoEvangelismo === 'Elite' || tipoEvangelismo === '1+1') && (
  <BuscadorPersonas
    label="Persona que lo trajo *"
    onSelect={setPersonaQueLoTrajoId}
  />
)}
```

**Layout del Formulario:**
```
┌─────────────────────────────────────────────┐
│ Datos Personales                            │
├─────────────────────────────────────────────┤
│ Primer nombre *        Segundo nombre       │
│ [____________]         [____________]       │
│                                             │
│ Primer apellido *      Segundo apellido     │
│ [____________]         [____________]       │
│                                             │
│ Apellido de casada (solo si mujer)         │
│ [____________]                              │
│                                             │
│ Teléfono *             Sexo *               │
│ [____________]         [▼ Masculino]        │
│                                             │
│ Fecha de nacimiento *                       │
│ [____-__-__]                                │
│                                             │
│ Dirección *                                 │
│ [_________________________________]         │
├─────────────────────────────────────────────┤
│ Datos de Evangelismo                        │
├─────────────────────────────────────────────┤
│ SSVA *                                      │
│ [▼ Nuevo Creyente]                          │
│                                             │
│ Tipo de Evangelismo *                       │
│ [▼ Elite]                                   │
│                                             │
│ Persona que lo trajo * (si Elite o 1+1)    │
│ [🔍 Buscar persona...]                      │
│                                             │
│ Evangelizador *                             │
│ [🔍 Buscar persona...]                      │
├─────────────────────────────────────────────┤
│              [Cancelar]  [Guardar]          │
└─────────────────────────────────────────────┘
```

### 3. SeccionEvangelismo.tsx (Modificaciones)

**Estado Adicional:**
```typescript
const [mostrarBuscador, setMostrarBuscador] = useState(false);
const [mostrarFormulario, setMostrarFormulario] = useState(false);
const [personaSeleccionada, setPersonaSeleccionada] = useState<PersonaCompleta | null>(null);
```

**Flujo:**
```typescript
// Cuando se selecciona "Sí" en salida evangelística
const handleSalidaChange = (value: boolean) => {
  setSalioEvangelizar(value);
  if (value) {
    setMostrarBuscador(true);
  } else {
    setMostrarBuscador(false);
    setMostrarFormulario(false);
    setEvangelizados([]);
  }
};

// Cuando se selecciona una persona del buscador
const handlePersonaSeleccionada = (persona: PersonaCompleta | null) => {
  setPersonaSeleccionada(persona);
  setMostrarBuscador(false);
  setMostrarFormulario(true);
};

// Cuando se hace clic en "Agregar nueva persona"
const handleNuevaPersona = () => {
  setPersonaSeleccionada(null);
  setMostrarBuscador(false);
  setMostrarFormulario(true);
};

// Cuando se guarda el formulario
const handleGuardarEvangelizado = (data: EvangelizadoData) => {
  setEvangelizados([...evangelizados, data]);
  setMostrarFormulario(false);
  setMostrarBuscador(true); // Volver al buscador para agregar más
};
```

## Flujo de Datos

### Flujo 1: Persona Nueva
```
Usuario selecciona "Sí" 
  → Aparece BuscadorPersonasGlobal
  → Usuario escribe nombre
  → No hay resultados
  → Usuario hace clic en "Agregar nueva persona"
  → Aparece FormularioEvangelizado (vacío)
  → Usuario llena todos los campos
  → Usuario guarda
  → Se agrega a evangelizados[]
  → Vuelve a BuscadorPersonasGlobal
```

### Flujo 2: Persona Existente
```
Usuario selecciona "Sí"
  → Aparece BuscadorPersonasGlobal
  → Usuario escribe nombre
  → Aparecen resultados
  → Usuario selecciona persona
  → Aparece FormularioEvangelizado (con datos precargados)
  → Usuario completa datos de evangelismo
  → Usuario guarda
  → Se agrega a evangelizados[]
  → Vuelve a BuscadorPersonasGlobal
```

## Estructura de Datos

### PersonaCompleta
```typescript
interface PersonaCompleta {
  id?: number;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  apellidoCasada?: string;
  sexo: 'M' | 'F';
  nacimientoFecha?: string;
  correoElectronico?: string;
  telefonos: Telefono[];
  edad?: number;
}
```

### EvangelizadoData
```typescript
interface EvangelizadoData {
  // Si persona ya existe
  personaId?: number;
  
  // Datos personales (para persona nueva)
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  apellidoCasada?: string;
  telefono: string;
  direccion: string;
  sexo: 'M' | 'F';
  fechaNacimiento: string;
  
  // Datos de evangelismo
  ssvaId: number;
  tipoEvangelismoId: number;
  evangelizadorId: number;
  personaQueLoTrajoId?: number;
}
```

## Consideraciones de Performance

1. **Búsqueda con Debounce:** 300ms para evitar requests excesivos
2. **Límite de Resultados:** Máximo 10 resultados en búsqueda
3. **Índices en BD:** Asegurar índices en campos de búsqueda
4. **Caché de Tipos:** Cachear tipos de evangelismo y SSVA en frontend

## Consideraciones de UX

1. **Feedback Visual:** Mostrar spinners durante búsquedas
2. **Validación en Tiempo Real:** Validar campos mientras el usuario escribe
3. **Mensajes Claros:** Indicar campos requeridos con asterisco (*)
4. **Autocompletado Inteligente:** Precarga datos cuando se selecciona persona existente
5. **Confirmación:** Mostrar mensaje de éxito al agregar evangelizado

## Manejo de Errores

1. **Error de Búsqueda:** Mostrar mensaje "Error al buscar personas"
2. **Error de Guardado:** Mostrar mensaje específico del error
3. **Validación Fallida:** Resaltar campos con error en rojo
4. **Timeout:** Manejar timeouts en búsquedas largas

## Testing

### Casos de Prueba
1. Buscar persona existente y seleccionarla
2. Buscar persona que no existe y crear nueva
3. Validar campos requeridos
4. Validar formato de teléfono
5. Validar fecha de nacimiento
6. Campos condicionales (apellido de casada, persona que lo trajo)
7. Agregar múltiples evangelizados
8. Cancelar formulario
9. Búsqueda con caracteres especiales
10. Búsqueda con resultados múltiples
