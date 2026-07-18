# Design Document: Eventos con Rango de Fechas

## Overview

Esta funcionalidad extiende el sistema de calendario existente para soportar eventos con rangos de fechas y horas. Actualmente, el sistema solo permite eventos de un solo día (`fechaEvento`) con hora de inicio opcional (`horaEvento`). Esta mejora añade dos campos opcionales: `fechaFin` y `horaFin`, permitiendo representar eventos que duran múltiples días (como retiros espirituales) y eventos con duración específica (como reuniones programadas).

El diseño mantiene compatibilidad total con eventos existentes, tratando la ausencia de `fechaFin` como eventos de un solo día y la ausencia de `horaFin` como eventos sin hora de finalización definida.

## Architecture

### Database Layer (Prisma)

Se modificará el modelo `Evento` en el esquema de Prisma para añadir dos campos opcionales:

```prisma
model Evento {
  // ... campos existentes ...
  fechaEvento   DateTime  @map("fecha_evento") @db.Date
  horaEvento    DateTime? @map("hora_evento") @db.Time
  fechaFin      DateTime? @map("fecha_fin") @db.Date      // NUEVO
  horaFin       DateTime? @map("hora_fin") @db.Time       // NUEVO
  todoElDia     Boolean   @default(false) @map("todo_el_dia")
  // ... resto de campos ...
}
```

### Backend Layer (NestJS)

- **DTOs**: Se actualizarán `CreateEventoDto` y `UpdateEventoDto` para incluir los nuevos campos opcionales
- **Validación**: Se implementará lógica de validación en el servicio para garantizar rangos válidos
- **Queries**: Se modificarán las consultas de eventos para manejar correctamente la intersección de rangos

### Frontend Layer (React)

- **Formularios**: Se actualizará el formulario de eventos para incluir campos de fecha y hora de fin
- **Calendario**: Se modificará la visualización del calendario para mostrar eventos multi-día
- **Tipos**: Se actualizarán las interfaces TypeScript para reflejar los nuevos campos


## Components and Interfaces

### 1. Database Migration (Prisma)

**Migration File**: `add_evento_fecha_fin_hora_fin.migration.sql`

La migración añadirá dos columnas opcionales a la tabla `evento`:

```sql
ALTER TABLE evento 
ADD COLUMN fecha_fin DATE NULL,
ADD COLUMN hora_fin TIME NULL;

-- Índice para mejorar consultas de rango
CREATE INDEX idx_evento_fecha_fin ON evento(fecha_fin) WHERE deleted_at IS NULL;
```

**Características**:
- Ambos campos son `NULL` por defecto, manteniendo compatibilidad con eventos existentes
- No se requiere migración de datos existentes (los eventos actuales funcionarán sin cambios)
- Se añade índice en `fecha_fin` para optimizar consultas de rango

### 2. Backend DTOs

**CreateEventoDto** (actualizado):

```typescript
export class CreateEventoDto {
  @ApiProperty({ description: 'ID de la casa de paz' })
  @IsInt()
  @IsNotEmpty()
  casaDePazId: number;

  @ApiProperty({ description: 'ID del tipo de evento' })
  @IsInt()
  @IsNotEmpty()
  tipoEventoId: number;

  @ApiProperty({ description: 'Título del evento', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @ApiProperty({ description: 'Descripción del evento', required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ description: 'Fecha de inicio del evento (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  fechaEvento: string;

  @ApiProperty({ description: 'Fecha de fin del evento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @ApiProperty({ 
    description: 'Hora de inicio en formato HH:MM (24 horas)', 
    required: false,
    example: '19:00' 
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaEvento debe estar en formato HH:MM (24 horas)',
  })
  horaEvento?: string;

  @ApiProperty({ 
    description: 'Hora de fin en formato HH:MM (24 horas)', 
    required: false,
    example: '21:00' 
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaFin debe estar en formato HH:MM (24 horas)',
  })
  horaFin?: string;

  @ApiProperty({ 
    description: 'Indica si el evento es de todo el día', 
    required: false,
    default: false 
  })
  @IsBoolean()
  @IsOptional()
  todoElDia?: boolean;
}
```

**UpdateEventoDto**: Hereda de `PartialType(OmitType(CreateEventoDto, ['casaDePazId']))`, por lo que automáticamente incluirá los nuevos campos opcionales.


### 3. Backend Service Logic

**CalendarioService** - Método `createEvento` (actualizado):

```typescript
async createEvento(dto: CreateEventoDto, userId: number, userRoles: string[], casaDePazId: number) {
  // Validación de fecha de inicio no anterior a hoy
  const fechaInicio = new Date(dto.fechaEvento);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  if (fechaInicio < hoy) {
    throw new EventoValidationError('La fecha de inicio no puede ser anterior a la fecha actual');
  }

  // Validación de rango de fechas
  if (dto.fechaFin) {
    const fechaFin = new Date(dto.fechaFin);
    if (fechaFin < fechaInicio) {
      throw new EventoValidationError('La fecha de fin debe ser posterior o igual a la fecha de inicio');
    }
  }

  // Validación de rango de horas para eventos del mismo día
  if (dto.horaEvento && dto.horaFin) {
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : fechaInicio;
    
    // Si es el mismo día, validar que hora fin > hora inicio
    if (fechaFin.getTime() === fechaInicio.getTime()) {
      const horaInicio = this.parseTimeString(dto.horaEvento);
      const horaFin = this.parseTimeString(dto.horaFin);
      
      if (horaFin <= horaInicio) {
        throw new EventoValidationError(
          'Para eventos del mismo día, la hora de fin debe ser posterior a la hora de inicio'
        );
      }
    }
  }

  // Validación de todo el día
  if (dto.todoElDia && (dto.horaEvento || dto.horaFin)) {
    throw new EventoValidationError(
      'Cuando el evento es de todo el día, no se deben proporcionar horas'
    );
  }

  // Validar permisos y tipo de evento
  await this.validarPermisoCreacion(userId, dto.tipoEventoId, userRoles);
  const tipoEvento = await this.prisma.tipoEvento.findFirst({
    where: { id: dto.tipoEventoId, deletedAt: null },
  });

  if (!tipoEvento) {
    throw new EventoNotFoundError(`Tipo de evento con ID ${dto.tipoEventoId} no encontrado`);
  }

  // Crear el evento
  const evento = await this.prisma.evento.create({
    data: {
      casaDePazId: casaDePazId,
      tipoEventoId: dto.tipoEventoId,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      fechaEvento: fechaInicio,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      horaEvento: dto.horaEvento ? this.parseTimeString(dto.horaEvento) : null,
      horaFin: dto.horaFin ? this.parseTimeString(dto.horaFin) : null,
      todoElDia: dto.todoElDia || false,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      tipoEvento: {
        select: {
          id: true,
          nombre: true,
          icono: true,
          descripcion: true,
          color: true,
        },
      },
    },
  });

  return evento;
}
```

**CalendarioService** - Método `updateEvento` (actualizado):

Se aplicarán las mismas validaciones que en `createEvento`, asegurando consistencia en las reglas de negocio.


### 4. Query Logic for Date Range Intersection

**CalendarioService** - Método `getEventosMensual` (actualizado):

```typescript
async getEventosMensual(año: number, mes: number, casaDePazId: number, filtros?: number[]) {
  // Calcular primer y último día del mes
  const primerDia = new Date(año, mes - 1, 1);
  const ultimoDia = new Date(año, mes, 0);

  // Query para eventos que intersectan con el mes
  const whereClause: any = {
    casaDePazId: casaDePazId,
    deletedAt: null,
    OR: [
      // Eventos que inician en el mes
      {
        fechaEvento: {
          gte: primerDia,
          lte: ultimoDia,
        },
      },
      // Eventos multi-día que terminan en el mes
      {
        fechaFin: {
          gte: primerDia,
          lte: ultimoDia,
        },
      },
      // Eventos multi-día que abarcan todo el mes
      {
        AND: [
          { fechaEvento: { lt: primerDia } },
          { fechaFin: { gt: ultimoDia } },
        ],
      },
    ],
  };

  if (filtros?.length) {
    whereClause.tipoEventoId = { in: filtros };
  }

  const eventos = await this.prisma.evento.findMany({
    where: whereClause,
    include: {
      tipoEvento: true,
    },
    orderBy: [
      { fechaEvento: 'asc' },
      { horaEvento: 'asc' },
    ],
  });

  // Expandir eventos multi-día a todos los días del rango
  return this.expandirEventosMultiDia(eventos, primerDia, ultimoDia);
}
```

**Método auxiliar para expandir eventos multi-día**:

```typescript
private expandirEventosMultiDia(eventos: any[], rangoInicio: Date, rangoFin: Date): EventoCalendario[] {
  const resultado: EventoCalendario[] = [];

  for (const evento of eventos) {
    const fechaInicio = new Date(evento.fechaEvento);
    const fechaFin = evento.fechaFin ? new Date(evento.fechaFin) : fechaInicio;

    // Determinar el rango efectivo dentro del rango de consulta
    const inicioEfectivo = fechaInicio > rangoInicio ? fechaInicio : rangoInicio;
    const finEfectivo = fechaFin < rangoFin ? fechaFin : rangoFin;

    // Generar una entrada por cada día del rango
    const diasDuracion = Math.ceil((finEfectivo.getTime() - inicioEfectivo.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    for (let i = 0; i < diasDuracion; i++) {
      const diaActual = new Date(inicioEfectivo);
      diaActual.setDate(diaActual.getDate() + i);

      resultado.push({
        ...evento,
        fechaMostrar: diaActual,
        esMultiDia: fechaFin.getTime() !== fechaInicio.getTime(),
        esPrimerDia: diaActual.getTime() === fechaInicio.getTime(),
        esUltimoDia: diaActual.getTime() === fechaFin.getTime(),
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
      });
    }
  }

  return resultado;
}
```


### 5. Frontend Types

**calendario.types.ts** (actualizado):

```typescript
export interface Evento {
  id: number;
  casaDePazId: number;
  tipoEventoId: number;
  titulo: string;
  descripcion?: string;
  fechaEvento: string;      // ISO date string
  fechaFin?: string;         // ISO date string (NUEVO)
  horaEvento?: string;       // HH:MM format
  horaFin?: string;          // HH:MM format (NUEVO)
  todoElDia: boolean;
  notificado: boolean;
  tipoEvento: TipoEvento;
  createdAt: string;
  updatedAt: string;
}

export interface EventoCalendario extends Evento {
  fechaMostrar: Date;        // Fecha específica para mostrar en calendario
  esMultiDia: boolean;       // Indica si el evento dura más de un día
  esPrimerDia: boolean;      // Indica si es el primer día del evento
  esUltimoDia: boolean;      // Indica si es el último día del evento
  fechaInicio: Date;         // Fecha de inicio original
  fechaFin: Date;            // Fecha de fin (puede ser igual a inicio)
}

export interface CreateEventoForm {
  tipoEventoId: number;
  titulo: string;
  descripcion?: string;
  fechaEvento: Date;
  fechaFin?: Date;           // NUEVO
  horaEvento?: string;
  horaFin?: string;          // NUEVO
  todoElDia?: boolean;
}

export interface UpdateEventoForm {
  tipoEventoId?: number;
  titulo?: string;
  descripcion?: string;
  fechaEvento?: Date;
  fechaFin?: Date;           // NUEVO
  horaEvento?: string;
  horaFin?: string;          // NUEVO
  todoElDia?: boolean;
}
```

### 6. Frontend Form Component

**EventoFormModal** (actualizado):

El formulario se actualizará para incluir:

1. **Campo de Fecha de Fin**: DatePicker opcional que aparece después del campo de fecha de inicio
2. **Campo de Hora de Fin**: Input de tiempo opcional que aparece después del campo de hora de inicio
3. **Validación en tiempo real**: 
   - Deshabilitar fechas de fin anteriores a la fecha de inicio
   - Validar que hora de fin > hora de inicio cuando es el mismo día
   - Deshabilitar campos de hora cuando "Todo el día" está marcado

```typescript
// Validación de rango de fechas
const validarRangoFechas = (fechaInicio: Date, fechaFin?: Date): boolean => {
  if (!fechaFin) return true;
  return fechaFin >= fechaInicio;
};

// Validación de rango de horas
const validarRangoHoras = (
  fechaInicio: Date, 
  fechaFin: Date | undefined,
  horaInicio: string | undefined, 
  horaFin: string | undefined
): boolean => {
  if (!horaInicio || !horaFin) return true;
  
  // Si es el mismo día, validar horas
  if (!fechaFin || fechaInicio.toDateString() === fechaFin.toDateString()) {
    const [hi, mi] = horaInicio.split(':').map(Number);
    const [hf, mf] = horaFin.split(':').map(Number);
    return (hf * 60 + mf) > (hi * 60 + mi);
  }
  
  return true;
};
```


### 7. Frontend Calendar Display

**CalendarioMensual Component** (actualizado):

La visualización del calendario se actualizará para:

1. **Mostrar eventos multi-día**: Los eventos que duran varios días aparecerán en cada día del rango
2. **Indicadores visuales**: 
   - Barra continua para eventos multi-día
   - Indicador de inicio (borde izquierdo redondeado)
   - Indicador de continuación (barra recta)
   - Indicador de fin (borde derecho redondeado)
3. **Información de duración**: Tooltip mostrando fecha/hora de inicio y fin

```typescript
// Renderizado de evento en el calendario
const renderEvento = (evento: EventoCalendario) => {
  const clases = [
    'evento-item',
    evento.esMultiDia ? 'multi-dia' : 'un-dia',
    evento.esPrimerDia ? 'primer-dia' : '',
    evento.esUltimoDia ? 'ultimo-dia' : '',
    !evento.esPrimerDia && !evento.esUltimoDia ? 'continuacion' : '',
  ].filter(Boolean).join(' ');

  const formatearDuracion = () => {
    if (!evento.esMultiDia) {
      if (evento.horaEvento && evento.horaFin) {
        return `${evento.horaEvento} - ${evento.horaFin}`;
      }
      return evento.horaEvento || 'Todo el día';
    }
    
    // Evento multi-día
    const inicio = `${formatearFecha(evento.fechaInicio)}${evento.horaEvento ? ' ' + evento.horaEvento : ''}`;
    const fin = `${formatearFecha(evento.fechaFin)}${evento.horaFin ? ' ' + evento.horaFin : ''}`;
    return `${inicio} - ${fin}`;
  };

  return (
    <div className={clases} style={{ backgroundColor: evento.tipoEvento.color }}>
      {evento.esPrimerDia && (
        <span className="evento-titulo">{evento.titulo}</span>
      )}
      {!evento.esPrimerDia && evento.esMultiDia && (
        <span className="evento-continuacion">↔ {evento.titulo}</span>
      )}
      <Tooltip content={formatearDuracion()} />
    </div>
  );
};
```

**Estilos CSS para eventos multi-día**:

```css
.evento-item.multi-dia {
  position: relative;
  margin: 2px 0;
}

.evento-item.primer-dia {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  padding-left: 8px;
}

.evento-item.ultimo-dia {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  padding-right: 8px;
}

.evento-item.continuacion {
  border-radius: 0;
  padding-left: 4px;
  padding-right: 4px;
}

.evento-continuacion::before {
  content: '↔';
  margin-right: 4px;
  opacity: 0.7;
}
```


## Data Models

### Prisma Schema Changes

```prisma
model Evento {
  id            Int       @id @default(autoincrement())
  casaDePazId   Int       @map("casa_de_paz_id")
  tipoEventoId  Int       @map("tipo_evento_id")
  titulo        String    @db.VarChar(200)
  descripcion   String?   @db.Text
  fechaEvento   DateTime  @map("fecha_evento") @db.Date
  fechaFin      DateTime? @map("fecha_fin") @db.Date        // NUEVO CAMPO
  horaEvento    DateTime? @map("hora_evento") @db.Time
  horaFin       DateTime? @map("hora_fin") @db.Time         // NUEVO CAMPO
  todoElDia     Boolean   @default(false) @map("todo_el_dia")
  notificado    Boolean   @default(false)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  createdBy     Int       @map("created_by")
  updatedBy     Int       @map("updated_by")
  deletedAt     DateTime? @map("deleted_at")
  deletedBy     Int?      @map("deleted_by")
  
  // Relations
  casaDePaz     CasaDePaz  @relation(fields: [casaDePazId], references: [id])
  tipoEvento    TipoEvento @relation(fields: [tipoEventoId], references: [id])
  
  @@index([casaDePazId])
  @@index([tipoEventoId])
  @@index([fechaEvento])
  @@index([fechaFin])                                       // NUEVO ÍNDICE
  @@index([deletedAt])
  @@index([notificado])
  @@index([casaDePazId, fechaEvento, deletedAt], name: "idx_evento_calendario")
  @@map("evento")
}
```

### Database Constraints

- `fechaFin` debe ser NULL o >= `fechaEvento` (validado en aplicación)
- `horaFin` debe ser NULL o > `horaEvento` cuando `fechaFin` = `fechaEvento` (validado en aplicación)
- Si `todoElDia` = true, entonces `horaEvento` y `horaFin` deben ser NULL (validado en aplicación)

### Data Migration Strategy

**Fase 1: Migración de Esquema**
```sql
-- Añadir columnas sin afectar datos existentes
ALTER TABLE evento 
ADD COLUMN fecha_fin DATE NULL,
ADD COLUMN hora_fin TIME NULL;

-- Crear índice para optimizar consultas
CREATE INDEX idx_evento_fecha_fin ON evento(fecha_fin) WHERE deleted_at IS NULL;
```

**Fase 2: Verificación**
- Todos los eventos existentes tendrán `fechaFin` = NULL y `horaFin` = NULL
- El sistema los tratará automáticamente como eventos de un solo día
- No se requiere transformación de datos

**Fase 3: Validación Post-Migración**
```sql
-- Verificar que no hay datos inconsistentes
SELECT COUNT(*) FROM evento 
WHERE fecha_fin IS NOT NULL AND fecha_fin < fecha_evento;
-- Debe retornar 0

-- Verificar eventos existentes
SELECT COUNT(*) FROM evento WHERE fecha_fin IS NULL;
-- Debe retornar el total de eventos existentes
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Date Range Validation

*For any* evento creation or update request, when `fechaFin` is provided, the system should accept the request if and only if `fechaFin` >= `fechaEvento`, and should reject with a descriptive error message when `fechaFin` < `fechaEvento`.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Time Range Validation for Same-Day Events

*For any* evento creation or update request where both `horaEvento` and `horaFin` are provided AND (`fechaFin` is NULL OR `fechaFin` equals `fechaEvento`), the system should accept the request if and only if `horaFin` > `horaEvento`, and should reject with a descriptive error message otherwise.

**Validates: Requirements 3.1, 3.2**

### Property 3: Time Range Flexibility for Multi-Day Events

*For any* evento creation or update request where `fechaFin` > `fechaEvento`, the system should accept any combination of `horaEvento` and `horaFin` values (including cases where `horaFin` <= `horaEvento`).

**Validates: Requirements 3.3**

### Property 4: Optional End Fields Acceptance

*For any* evento creation or update request, the system should accept requests where `fechaFin` and/or `horaFin` are omitted (NULL), and should successfully create or update the evento with these fields set to NULL.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 5: Validation Consistency Between Create and Update

*For any* invalid date/time range combination, if the system rejects it during evento creation with a specific error message, then the system should also reject the same invalid combination during evento update with the same error message.

**Validates: Requirements 4.5**

### Property 6: Multi-Day Event Display Coverage

*For any* evento where `fechaFin` is provided and `fechaFin` > `fechaEvento`, when querying events for a calendar view that includes any date in the range [`fechaEvento`, `fechaFin`], the system should return the evento with appropriate metadata indicating which day of the range is being displayed (`esPrimerDia`, `esUltimoDia`, `esMultiDia`).

**Validates: Requirements 5.1, 5.3**

### Property 7: Date Range Query Intersection

*For any* query with date range [`queryInicio`, `queryFin`], the system should return all eventos where the evento's date range [`fechaEvento`, `fechaFin` OR `fechaEvento`] intersects with the query range, including:
- Single-day events (`fechaFin` is NULL) where `fechaEvento` is within [`queryInicio`, `queryFin`]
- Multi-day events that start before, during, or end within the query range
- Multi-day events that completely encompass the query range

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 8: End Fields Display When Present

*For any* evento where `fechaFin` and/or `horaFin` are not NULL, when retrieving evento details, the system should include these fields in the response with their actual values.

**Validates: Requirements 7.1, 7.2**

### Property 9: End Fields Omission When Absent

*For any* evento where `fechaFin` is NULL, the system should treat and display the evento as a single-day event (with duration from `fechaEvento` to `fechaEvento`). For any evento where `horaFin` is NULL, the system should treat and display the evento as having no defined end time.

**Validates: Requirements 1.3, 1.4, 7.3, 7.4**

### Property 10: Null Handling in Queries and Display

*For any* evento with NULL values for `fechaFin` and/or `horaFin`, all query operations (filtering, sorting, range intersection) and display operations should handle these NULL values correctly without errors, treating NULL `fechaFin` as equal to `fechaEvento` for range calculations.

**Validates: Requirements 8.3**

### Property 11: Backward Compatibility with Existing Events

*For any* evento that existed before the schema migration (having NULL `fechaFin` and NULL `horaFin`), the system should continue to function correctly, allowing queries, updates, and display operations without errors, and should allow updating these eventos to add `fechaFin` and `horaFin` values.

**Validates: Requirements 1.5, 8.1, 8.2, 8.4**


## Error Handling

### Validation Errors

**EventoValidationError** (HTTP 400):

1. **Fecha de fin anterior a fecha de inicio**
   - Mensaje: `"La fecha de fin debe ser posterior o igual a la fecha de inicio"`
   - Ocurre cuando: `fechaFin < fechaEvento`

2. **Hora de fin inválida para evento del mismo día**
   - Mensaje: `"Para eventos del mismo día, la hora de fin debe ser posterior a la hora de inicio"`
   - Ocurre cuando: `fechaFin === fechaEvento` AND `horaFin <= horaEvento`

3. **Horas proporcionadas con evento de todo el día**
   - Mensaje: `"Cuando el evento es de todo el día, no se deben proporcionar horas"`
   - Ocurre cuando: `todoElDia === true` AND (`horaEvento` OR `horaFin` están presentes)

4. **Fecha de inicio anterior a hoy**
   - Mensaje: `"La fecha de inicio no puede ser anterior a la fecha actual"`
   - Ocurre cuando: `fechaEvento < hoy`

### Database Errors

**Manejo de errores de Prisma**:

1. **Constraint violations**: Capturar y transformar en mensajes amigables
2. **Connection errors**: Reintentar con backoff exponencial
3. **Timeout errors**: Retornar error 503 (Service Unavailable)

### Frontend Error Handling

**Validación en tiempo real**:

1. **Deshabilitar fechas inválidas**: El DatePicker de `fechaFin` deshabilitará fechas anteriores a `fechaEvento`
2. **Validación de horas**: Mostrar mensaje de error inmediato si `horaFin <= horaEvento` en el mismo día
3. **Feedback visual**: Bordes rojos y mensajes de error debajo de campos inválidos

**Manejo de errores de API**:

```typescript
try {
  await calendarioService.createEvento(formData);
  toast.success('Evento creado exitosamente');
  onClose();
} catch (error: any) {
  if (error.message.includes('fecha de fin')) {
    setFieldError('fechaFin', error.message);
  } else if (error.message.includes('hora de fin')) {
    setFieldError('horaFin', error.message);
  } else {
    toast.error(error.message || 'Error al crear evento');
  }
}
```

### Edge Cases

1. **Evento que cruza cambio de horario (DST)**: Manejar correctamente usando UTC para fechas
2. **Evento de 29 de febrero en año no bisiesto**: Validar en backend
3. **Evento con duración de varios meses**: Optimizar renderizado en calendario para no generar miles de entradas
4. **Actualización parcial**: Permitir actualizar solo `fechaFin` sin cambiar `fechaEvento`


## Testing Strategy

### Dual Testing Approach

Esta funcionalidad requiere tanto pruebas unitarias como pruebas basadas en propiedades para garantizar correctitud completa:

- **Unit tests**: Verifican casos específicos, ejemplos concretos y casos límite
- **Property tests**: Verifican propiedades universales a través de múltiples entradas generadas aleatoriamente
- Ambos tipos son complementarios y necesarios para cobertura integral

### Property-Based Testing

**Framework**: Utilizaremos `fast-check` para TypeScript/JavaScript, que es la biblioteca estándar para property-based testing en el ecosistema Node.js.

**Configuración**: Cada prueba de propiedad ejecutará un mínimo de 100 iteraciones con datos generados aleatoriamente.

**Generadores personalizados**:

```typescript
// Generador de fechas válidas
const fechaArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') });

// Generador de horas en formato HH:MM
const horaArb = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

// Generador de rangos de fechas válidos
const rangoFechasValidoArb = fc.tuple(fechaArb, fechaArb)
  .filter(([inicio, fin]) => fin >= inicio)
  .map(([inicio, fin]) => ({ fechaEvento: inicio, fechaFin: fin }));

// Generador de rangos de fechas inválidos
const rangoFechasInvalidoArb = fc.tuple(fechaArb, fechaArb)
  .filter(([inicio, fin]) => fin < inicio)
  .map(([inicio, fin]) => ({ fechaEvento: inicio, fechaFin: fin }));
```

### Property Tests Implementation

**Test 1: Date Range Validation** (Property 1)
```typescript
describe('Property 1: Date Range Validation', () => {
  it('should accept valid date ranges and reject invalid ones', async () => {
    // Feature: eventos-rango-fechas, Property 1: Date range validation
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(rangoFechasValidoArb, rangoFechasInvalidoArb),
        async (rango) => {
          const esValido = rango.fechaFin >= rango.fechaEvento;
          const dto = { ...baseEventoDto, ...rango };
          
          if (esValido) {
            const resultado = await calendarioService.createEvento(dto, userId, roles, casaDePazId);
            expect(resultado).toBeDefined();
            expect(resultado.fechaFin).toEqual(rango.fechaFin);
          } else {
            await expect(
              calendarioService.createEvento(dto, userId, roles, casaDePazId)
            ).rejects.toThrow('fecha de fin debe ser posterior o igual');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Test 2: Time Range Validation for Same-Day Events** (Property 2)
```typescript
describe('Property 2: Time Range Validation for Same-Day Events', () => {
  it('should validate time ranges correctly for same-day events', async () => {
    // Feature: eventos-rango-fechas, Property 2: Time range validation for same-day events
    await fc.assert(
      fc.asyncProperty(
        fechaArb,
        horaArb,
        horaArb,
        async (fecha, horaInicio, horaFin) => {
          const dto = {
            ...baseEventoDto,
            fechaEvento: fecha,
            fechaFin: fecha, // Mismo día
            horaEvento: horaInicio,
            horaFin: horaFin,
          };
          
          const esValido = horaFin > horaInicio;
          
          if (esValido) {
            const resultado = await calendarioService.createEvento(dto, userId, roles, casaDePazId);
            expect(resultado).toBeDefined();
          } else {
            await expect(
              calendarioService.createEvento(dto, userId, roles, casaDePazId)
            ).rejects.toThrow('hora de fin debe ser posterior');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Test 3: Date Range Query Intersection** (Property 7)
```typescript
describe('Property 7: Date Range Query Intersection', () => {
  it('should return all events that intersect with query range', async () => {
    // Feature: eventos-rango-fechas, Property 7: Date range query intersection
    await fc.assert(
      fc.asyncProperty(
        fc.array(rangoFechasValidoArb, { minLength: 5, maxLength: 20 }),
        rangoFechasValidoArb,
        async (eventos, queryRange) => {
          // Crear eventos en la base de datos
          const eventosCreados = await Promise.all(
            eventos.map(e => calendarioService.createEvento(
              { ...baseEventoDto, ...e }, userId, roles, casaDePazId
            ))
          );
          
          // Consultar eventos en el rango
          const resultado = await calendarioService.getEventos({
            fechaDesde: queryRange.fechaEvento,
            fechaHasta: queryRange.fechaFin,
            casaDePazId,
          });
          
          // Verificar que todos los eventos que intersectan están incluidos
          for (const evento of eventosCreados) {
            const eventoInicio = new Date(evento.fechaEvento);
            const eventoFin = evento.fechaFin ? new Date(evento.fechaFin) : eventoInicio;
            const queryInicio = queryRange.fechaEvento;
            const queryFin = queryRange.fechaFin;
            
            const intersecta = !(eventoFin < queryInicio || eventoInicio > queryFin);
            
            if (intersecta) {
              expect(resultado.some(r => r.id === evento.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```


### Unit Testing

**Backend Unit Tests** (Jest):

```typescript
describe('CalendarioService - Eventos con Rango de Fechas', () => {
  describe('createEvento', () => {
    it('should create single-day event without fechaFin', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
        horaEvento: '19:00',
      };
      
      const resultado = await service.createEvento(dto, userId, roles, casaDePazId);
      
      expect(resultado.fechaEvento).toEqual(new Date('2024-06-15'));
      expect(resultado.fechaFin).toBeNull();
    });

    it('should create multi-day event with fechaFin', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Retiro Espiritual',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-17',
      };
      
      const resultado = await service.createEvento(dto, userId, roles, casaDePazId);
      
      expect(resultado.fechaEvento).toEqual(new Date('2024-06-15'));
      expect(resultado.fechaFin).toEqual(new Date('2024-06-17'));
    });

    it('should reject event with fechaFin before fechaEvento', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Evento Inválido',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-10',
      };
      
      await expect(
        service.createEvento(dto, userId, roles, casaDePazId)
      ).rejects.toThrow('fecha de fin debe ser posterior o igual');
    });

    it('should accept same-day event with valid time range', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-15',
        horaEvento: '19:00',
        horaFin: '21:00',
      };
      
      const resultado = await service.createEvento(dto, userId, roles, casaDePazId);
      
      expect(resultado.horaEvento).toBeDefined();
      expect(resultado.horaFin).toBeDefined();
    });

    it('should reject same-day event with horaFin <= horaEvento', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-15',
        horaEvento: '19:00',
        horaFin: '18:00',
      };
      
      await expect(
        service.createEvento(dto, userId, roles, casaDePazId)
      ).rejects.toThrow('hora de fin debe ser posterior');
    });

    it('should allow any time combination for multi-day events', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Retiro',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-17',
        horaEvento: '20:00',
        horaFin: '10:00', // Hora fin menor que hora inicio, pero en días diferentes
      };
      
      const resultado = await service.createEvento(dto, userId, roles, casaDePazId);
      
      expect(resultado).toBeDefined();
    });

    it('should reject event with hours when todoElDia is true', async () => {
      const dto = {
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Evento Todo el Día',
        fechaEvento: '2024-06-15',
        horaEvento: '19:00',
        todoElDia: true,
      };
      
      await expect(
        service.createEvento(dto, userId, roles, casaDePazId)
      ).rejects.toThrow('no se deben proporcionar horas');
    });
  });

  describe('getEventosMensual', () => {
    it('should return single-day event on its date', async () => {
      // Crear evento de un día
      await service.createEvento({
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
      }, userId, roles, casaDePazId);
      
      const eventos = await service.getEventosMensual(2024, 6, casaDePazId);
      
      const eventoEnFecha = eventos.filter(e => 
        e.fechaMostrar.getDate() === 15 && e.titulo === 'Reunión'
      );
      
      expect(eventoEnFecha).toHaveLength(1);
    });

    it('should return multi-day event on all days of range', async () => {
      // Crear evento de 3 días
      await service.createEvento({
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Retiro',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-17',
      }, userId, roles, casaDePazId);
      
      const eventos = await service.getEventosMensual(2024, 6, casaDePazId);
      
      const retiros = eventos.filter(e => e.titulo === 'Retiro');
      
      expect(retiros).toHaveLength(3); // Debe aparecer en 15, 16 y 17
      expect(retiros[0].esPrimerDia).toBe(true);
      expect(retiros[1].esPrimerDia).toBe(false);
      expect(retiros[1].esUltimoDia).toBe(false);
      expect(retiros[2].esUltimoDia).toBe(true);
    });

    it('should include event that starts before month and ends during month', async () => {
      await service.createEvento({
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Evento Largo',
        fechaEvento: '2024-05-28',
        fechaFin: '2024-06-05',
      }, userId, roles, casaDePazId);
      
      const eventos = await service.getEventosMensual(2024, 6, casaDePazId);
      
      const eventosLargos = eventos.filter(e => e.titulo === 'Evento Largo');
      
      expect(eventosLargos.length).toBeGreaterThan(0);
      expect(eventosLargos[0].fechaMostrar.getMonth()).toBe(5); // Junio (0-indexed)
    });

    it('should include event that encompasses entire month', async () => {
      await service.createEvento({
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Evento Muy Largo',
        fechaEvento: '2024-05-01',
        fechaFin: '2024-07-31',
      }, userId, roles, casaDePazId);
      
      const eventos = await service.getEventosMensual(2024, 6, casaDePazId);
      
      const eventosLargos = eventos.filter(e => e.titulo === 'Evento Muy Largo');
      
      expect(eventosLargos.length).toBe(30); // Todos los días de junio
    });
  });

  describe('updateEvento', () => {
    it('should allow adding fechaFin to existing event', async () => {
      const evento = await service.createEvento({
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
      }, userId, roles, casaDePazId);
      
      const actualizado = await service.updateEvento(
        evento.id,
        { fechaFin: '2024-06-17' },
        userId,
        roles,
        casaDePazId
      );
      
      expect(actualizado.fechaFin).toEqual(new Date('2024-06-17'));
    });

    it('should apply same validations as create', async () => {
      const evento = await service.createEvento({
        casaDePazId: 1,
        tipoEventoId: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
      }, userId, roles, casaDePazId);
      
      await expect(
        service.updateEvento(
          evento.id,
          { fechaFin: '2024-06-10' }, // Fecha inválida
          userId,
          roles,
          casaDePazId
        )
      ).rejects.toThrow('fecha de fin debe ser posterior o igual');
    });
  });
});
```


**Frontend Unit Tests** (Vitest + React Testing Library):

```typescript
describe('EventoFormModal', () => {
  it('should render fecha fin field', () => {
    render(<EventoFormModal open={true} onClose={jest.fn()} />);
    
    expect(screen.getByLabelText(/fecha de fin/i)).toBeInTheDocument();
  });

  it('should render hora fin field', () => {
    render(<EventoFormModal open={true} onClose={jest.fn()} />);
    
    expect(screen.getByLabelText(/hora de fin/i)).toBeInTheDocument();
  });

  it('should disable fecha fin dates before fecha inicio', async () => {
    render(<EventoFormModal open={true} onClose={jest.fn()} />);
    
    const fechaInicio = screen.getByLabelText(/fecha de inicio/i);
    await userEvent.type(fechaInicio, '2024-06-15');
    
    const fechaFin = screen.getByLabelText(/fecha de fin/i);
    // Verificar que fechas anteriores están deshabilitadas
    // (implementación específica depende del componente DatePicker usado)
  });

  it('should show error when hora fin <= hora inicio on same day', async () => {
    render(<EventoFormModal open={true} onClose={jest.fn()} />);
    
    await userEvent.type(screen.getByLabelText(/fecha de inicio/i), '2024-06-15');
    await userEvent.type(screen.getByLabelText(/fecha de fin/i), '2024-06-15');
    await userEvent.type(screen.getByLabelText(/hora de inicio/i), '19:00');
    await userEvent.type(screen.getByLabelText(/hora de fin/i), '18:00');
    
    expect(screen.getByText(/hora de fin debe ser posterior/i)).toBeInTheDocument();
  });

  it('should allow hora fin <= hora inicio for multi-day events', async () => {
    render(<EventoFormModal open={true} onClose={jest.fn()} />);
    
    await userEvent.type(screen.getByLabelText(/fecha de inicio/i), '2024-06-15');
    await userEvent.type(screen.getByLabelText(/fecha de fin/i), '2024-06-17');
    await userEvent.type(screen.getByLabelText(/hora de inicio/i), '20:00');
    await userEvent.type(screen.getByLabelText(/hora de fin/i), '10:00');
    
    expect(screen.queryByText(/hora de fin debe ser posterior/i)).not.toBeInTheDocument();
  });

  it('should disable hora fields when todo el dia is checked', async () => {
    render(<EventoFormModal open={true} onClose={jest.fn()} />);
    
    const todoElDia = screen.getByLabelText(/todo el día/i);
    await userEvent.click(todoElDia);
    
    expect(screen.getByLabelText(/hora de inicio/i)).toBeDisabled();
    expect(screen.getByLabelText(/hora de fin/i)).toBeDisabled();
  });

  it('should submit form with fecha fin and hora fin', async () => {
    const onSubmit = jest.fn();
    render(<EventoFormModal open={true} onClose={jest.fn()} onSubmit={onSubmit} />);
    
    await userEvent.type(screen.getByLabelText(/título/i), 'Retiro');
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), '1');
    await userEvent.type(screen.getByLabelText(/fecha de inicio/i), '2024-06-15');
    await userEvent.type(screen.getByLabelText(/fecha de fin/i), '2024-06-17');
    await userEvent.type(screen.getByLabelText(/hora de inicio/i), '09:00');
    await userEvent.type(screen.getByLabelText(/hora de fin/i), '18:00');
    
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Retiro',
        fechaEvento: expect.any(Date),
        fechaFin: expect.any(Date),
        horaEvento: '09:00',
        horaFin: '18:00',
      })
    );
  });
});

describe('CalendarioMensual', () => {
  it('should display single-day event on one day only', async () => {
    const eventos = [
      {
        id: 1,
        titulo: 'Reunión',
        fechaEvento: '2024-06-15',
        fechaFin: null,
        tipoEvento: { color: '#blue' },
      },
    ];
    
    render(<CalendarioMensual eventos={eventos} año={2024} mes={6} />);
    
    const eventosEnCalendario = screen.getAllByText('Reunión');
    expect(eventosEnCalendario).toHaveLength(1);
  });

  it('should display multi-day event on all days of range', async () => {
    const eventos = [
      {
        id: 1,
        titulo: 'Retiro',
        fechaEvento: '2024-06-15',
        fechaFin: '2024-06-17',
        esMultiDia: true,
        tipoEvento: { color: '#blue' },
      },
    ];
    
    // Mock del servicio para expandir eventos
    jest.spyOn(calendarioService, 'getEventosMensual').mockResolvedValue([
      { ...eventos[0], fechaMostrar: new Date('2024-06-15'), esPrimerDia: true, esUltimoDia: false },
      { ...eventos[0], fechaMostrar: new Date('2024-06-16'), esPrimerDia: false, esUltimoDia: false },
      { ...eventos[0], fechaMostrar: new Date('2024-06-17'), esPrimerDia: false, esUltimoDia: true },
    ]);
    
    render(<CalendarioMensual año={2024} mes={6} />);
    
    await waitFor(() => {
      const eventosEnCalendario = screen.getAllByText(/Retiro/);
      expect(eventosEnCalendario).toHaveLength(3);
    });
  });

  it('should apply different styles to first, middle, and last day of multi-day event', async () => {
    const eventos = [
      { id: 1, titulo: 'Retiro', fechaMostrar: new Date('2024-06-15'), esPrimerDia: true, esUltimoDia: false, esMultiDia: true },
      { id: 1, titulo: 'Retiro', fechaMostrar: new Date('2024-06-16'), esPrimerDia: false, esUltimoDia: false, esMultiDia: true },
      { id: 1, titulo: 'Retiro', fechaMostrar: new Date('2024-06-17'), esPrimerDia: false, esUltimoDia: true, esMultiDia: true },
    ];
    
    render(<CalendarioMensual eventos={eventos} año={2024} mes={6} />);
    
    const primerDia = screen.getAllByText('Retiro')[0];
    const ultimoDia = screen.getAllByText(/Retiro/)[2];
    
    expect(primerDia.className).toContain('primer-dia');
    expect(ultimoDia.className).toContain('ultimo-dia');
  });
});
```

### Integration Tests

```typescript
describe('Eventos con Rango de Fechas - Integration', () => {
  it('should create, query, and display multi-day event end-to-end', async () => {
    // 1. Crear evento multi-día
    const createDto = {
      casaDePazId: 1,
      tipoEventoId: 1,
      titulo: 'Retiro Espiritual',
      fechaEvento: '2024-06-15',
      fechaFin: '2024-06-17',
      horaEvento: '09:00',
      horaFin: '18:00',
    };
    
    const response = await request(app.getHttpServer())
      .post('/calendario/eventos')
      .set('Authorization', `Bearer ${token}`)
      .send(createDto)
      .expect(201);
    
    expect(response.body.fechaFin).toBe('2024-06-17');
    
    // 2. Consultar eventos del mes
    const eventosResponse = await request(app.getHttpServer())
      .get('/calendario/mensual')
      .query({ año: 2024, mes: 6 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    const retiros = eventosResponse.body.filter(e => e.titulo === 'Retiro Espiritual');
    
    // 3. Verificar que aparece en los 3 días
    expect(retiros).toHaveLength(3);
    expect(retiros[0].esPrimerDia).toBe(true);
    expect(retiros[2].esUltimoDia).toBe(true);
  });
});
```

### Test Coverage Goals

- **Backend**: Mínimo 90% de cobertura en lógica de validación y queries
- **Frontend**: Mínimo 80% de cobertura en componentes de formulario y calendario
- **Property tests**: 100 iteraciones por propiedad (11 propiedades = 1,100 casos generados)
- **Integration tests**: Cobertura de flujos completos end-to-end

