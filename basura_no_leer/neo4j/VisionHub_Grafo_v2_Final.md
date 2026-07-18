# VisionHub - Grafo de Conocimiento v2.0 (Final)

## Resumen del Grafo

Este documento describe la estructura completa del grafo de conocimiento para VisionHub, el sistema de gestion eclesiastica de la Red Apostolica del Ap. Edgar Ortuño.

---

## 1. Nodos del Grafo

### 1.1 Organizacion (Tenant Raiz)

```
(:Cobertura {
  id: UUID,
  nombre: "Red Apostolica del Ap. Edgar Ortuno",
  sede: "Cochabamba, Bolivia",
  apostol: "Edgar Ortuño",
  estado: "activa",
  created_at: timestamp
})
```

**Descripcion:** Tenant raiz que representa toda la organizacion. Todas las iglesias pertenecen a esta cobertura.

---

### 1.2 Iglesias

```
(:Iglesia {
  id: UUID,
  nombre: "Centro de Vida Global 4 Anillo",
  ciudad: "Santa Cruz",
  tipo: "hija" | "madre_real",
  activa: true | false,
  created_at: timestamp
})
```

**Estructura jerarquica:**
- Iglesia madre real (Cochabamba) - No esta en el software aun
- Iglesia hija - Santa Cruz (4 Anillo) - Despliegue inicial
- Iglesia hija - Montero - Despliegue inicial

**Relaciones:**
- `(:Iglesia)-[:PERTENECE_A]->(:Cobertura)`
- `(:Iglesia)-[:ES_HIJA_DE]->(:Iglesia)` (hija -> madre)

---

### 1.3 Redes

```
(:Red {
  id: UUID,
  nombre: "Red 1",
  iglesia_id: UUID,
  created_at: timestamp
})
```

**Descripcion:** Agrupaciones de Casas de Paz dentro de una iglesia.

**Relaciones:**
- `(:Red)-[:PERTENECE_A]->(:Iglesia)`
- `(:Red)-[:CUENTA_CON]->(:CasaDePaz)`

---

### 1.4 Casas de Paz (CdP)

```
(:CasaDePaz {
  id: UUID,
  nombre: "CdP Vida Nueva",
  red_id: UUID,
  direccion: "Calle...",
  telefono: "+591...",
  capacidad: 15,
  created_at: timestamp
})
```

**Descripcion:** Unidades basicas de la iglesia donde se realizan reuniones semanales.

**Relaciones:**
- `(:CasaDePaz)-[:PERTENECE_A]->(:Red)`
- `(:CasaDePaz)-[:TIENE_LIDER]->(:Persona)`
- `(:CasaDePaz)-[:TIENE_REPRESENTANTE]->(:Persona)`
- `(:CasaDePaz)-[:MIEMBRO_DE]->(:Persona)`
- `(:CasaDePaz)-[:SIRVE_COMO_ANFITRION]->(:Persona)`

---

### 1.5 Personas

```
(:Persona {
  id: UUID,
  primer_nombre: "Juan",
  segundo_nombre: "Carlos",
  primer_apellido: "Lopez",
  segundo_apellido: "Mamani",
  apellido_casada: "De Lopez",  // Solo si estado_civil = casado
  ci: "12345678",
  ci_exp: "SC",
  fecha_nacimiento: date,
  genero: "M" | "F" | "O",
  telefono: "+591...",
  email: "juan@email.com",
  estado_civil: "soltero" | "casado" | "divorciado" | "viudo",
  grado_instruccion: "primaria" | "secundaria" | "universitario" | "tecnico" | "maestria" | "doctorado",
  ocupacion: "...",
  direccion: "...",
  foto_url: "...",
  notas: "...",
  iglesia_id: UUID,
  fecha_registro: timestamp,
  fecha_eliminacion: timestamp | null,
  eliminado_por: UUID | null
})
```

**Campos importantes:**
- `apellido_casada`: Solo se usa cuando `estado_civil = casado`
- `iglesia_id`: Para multi-tenancy por RLS
- Soft delete: `fecha_eliminacion` y `eliminado_por`

**Relaciones:**
- `(:Persona)-[:MIEMBRO_DE]->(:CasaDePaz)`
- `(:Persona)-[:TIENE_ESTADO]->(:Estado)`
- `(:Persona)-[:OCUPA_CARGO]->(:Cargo)`
- `(:Persona)-[:FAMILIAR_DE]->(:Persona)`
- `(:Persona)-[:PARTICIPA_EN]->(:Ministerio)`
- `(:Persona)-[:ASISTE_A]->(:InstanciaReunion)`
- `(:Persona)-[:CONTRIBUYE]->(:Ofrenda)`
- `(:Persona)-[:FUE_BAUTIZADA_EN]->(:EventoBautizo)`

---

### 1.6 Estados

```
(:Estado {
  id: UUID,
  nombre: "Nuevo Convertido",
  sigla: "NC",
  descripcion: "Persona que acepta a Jesus por primera vez.",
  orden: 2
})
```

**Catalogo de estados (6):**

| Sigla | Nombre | Descripcion |
|-------|--------|-------------|
| SIM | Evangelizado | Estado inicial, persona evangelizada que no avanza |
| NC | Nuevo Convertido | Acepta a Jesus por primera vez |
| CRE | Creyente | Asistente regular mayor de 12 anos |
| RE | Reconciliado | Persona que estuvo +3 meses fuera y retorna |
| DA | Discipulo Activo | Asiste al discipulado |
| DI | Discipulo Inactivo | Abandono 3 clases continuas |

**Transiciones:**
- `SIM -> NC` (ora de fe, acepta a Jesus)
- `NC -> CRE` (1 semana sin discipulado, solo >12 anos)
- `NC -> DA` (asiste a discipulado)
- `CRE -> DA` (asiste a discipulado)
- `DA -> DI` (3 clases continuas ausentes)
- `DI -> DA` (retoma asistencia)
- `RE -> DA` (asiste a discipulado)

---

### 1.7 Cargos

```
(:Cargo {
  id: UUID,
  nombre: "Pastor",
  tipo: "ministerial" | "funcional",
  subtipo: "ministerial_supremo" | "ministerial" | "vision_macro" | "nivel_red" | "nivel_cdp" | "funcional",
  permanente: true | false,
  orden: 4,
  descripcion: "Autoridad local de la iglesia..."
})
```

**Catalogo de cargos (20):**

#### Nivel Vision (Macro)
| Cargo | Tipo | Permanente | Descripcion |
|-------|------|------------|-------------|
| Lider de la Vision en Accion | funcional | Si | Cabeza administrativa del crecimiento |
| Encargado de Departamentos (Vision) | funcional | No | Supervisa 4 departamentos global |
| Encargado General de Ministerios (Vision) | funcional | No | Audita participacion por red |

#### Nivel Iglesia: 5 Ministerios (designados por apostol)
| Cargo | Tipo | Permanente | Descripcion |
|-------|------|------------|-------------|
| Apostol | ministerial | Si | Maxima autoridad de cobertura |
| Pastor | ministerial | Si | Autoridad local de la iglesia |
| Profeta | ministerial | Si | Uncion profetica |
| Evangelista | ministerial | Si | Evangeliza a escala mayor |
| Maestro | ministerial | Si | Ensenanza teologica |

#### Nivel Iglesia: Cargos Ministeriales inferiores
| Cargo | Tipo | Permanente | Descripcion |
|-------|------|------------|-------------|
| Ministro | ministerial | Si | Ejecuta tareas sobre redes |
| Anciano | ministerial | Si | Predica, puede ser lider de red |
| Diacono | ministerial | Si | Servicio constante, requisito: lider CdP |
| Mentor | ministerial | Si | Pendiente de definir |

#### Nivel Red
| Cargo | Tipo | Permanente | Descripcion |
|-------|------|------------|-------------|
| Lider de Red | funcional | No | Supervisa casas de paz |
| Encargado de Departamentos de Red | funcional | No | Obligatorio, supervisa representantes |
| Encargado de Ministerio de Red | funcional | No | Obligatorio, coordina personas |

#### Nivel CdP
| Cargo | Tipo | Permanente | Descripcion |
|-------|------|------------|-------------|
| Lider de CdP | funcional | No | Responsable de casa de paz |
| Sublider de CdP | funcional | No | Colaborador, puede llenar reportes |

#### Otros Funcionales
| Cargo | Tipo | Permanente | Descripcion |
|-------|------|------------|-------------|
| Lider de Departamento | funcional | No | Responsable depto especifico |
| Operador | funcional | No | Apoyo en departamentos |
| Contador/Contadora | funcional | No | Area administrativa-financiera |

---

### 1.8 Departamentos (4 activos)

```
(:Departamento {
  id: UUID,
  nombre: "Evangelismo",
  descripcion: "Alcanzar nuevas personas...",
  activo: true
})
```

| Departamento | Descripcion |
|--------------|-------------|
| Evangelismo | Alcanzar nuevas personas, registrar, dar seguimiento |
| Afirmacion | Confirmar llegada, acompanar al bautismo, integrar al RSLI |
| Discipulado | Cursos, ensenanza, acompanamiento, capacitacion |
| Envio | Evaluar, comisionar como lider de CdP, multiplicar |

**Relaciones:**
- `(:Departamento)-[:TIENE]->(:Criterio)`
- `(:Departamento)-[:SIRVE_A]->(:Iglesia)`

---

### 1.9 Ministerios (14 - nivel iglesia)

```
(:Ministerio {
  id: UUID,
  nombre: "Alabanza",
  nivel: "iglesia",
  descripcion: "Musica y canto...",
  nunca_se_cierra: true
})
```

**Catalogo:**

| Ministerio | Descripcion |
|------------|-------------|
| Alabanza | Musica y canto. Musicos y cantantes |
| Danza | Danzas reverentes. Jovenes |
| Comunicacion | Transmisiones, foto, video, RRSS |
| Ninos | Ensenar palabra a ninos -12 anos |
| Jovenes | Ministrar a jovenes |
| Protocolo | Coordinar servicios, tiempos |
| Ujieres | Recibir, orientar, limpieza |
| Parqueo | Organizar vehiculos |
| Cocina | Preparar alimentos |
| Evangelismo (campo) | Anunciar evangelio fuera |
| Sonido | Equipos de audio |
| Testimonios | Recopilar testimonios |
| Escuderos | Asistencia a pastores |
| Intercesion | Oracion e intercesion |

**Reglas:**
- Todos los ministerios son a nivel de iglesia
- Ninguno es a nivel de red
- Encargado de Ministerio de Red coordina PERSONAS de la red en ministerios

**Relaciones:**
- `(:Ministerio)-[:SIRVE_A]->(:Iglesia)`
- `(:Persona)-[:PARTICIPA_EN]->(:Ministerio)`

---

### 1.10 Tipos de Reunion

```
(:TipoReunion {
  id: UUID,
  tipo: "Casa de Paz",
  frecuencia: "semanal",
  lugar_default: "hogar",
  virtual_default: false,
  recauda: true
})
```

**Catalogo (8):**

| Tipo | Frecuencia | Lugar | Virtual | Recauda |
|------|------------|-------|---------|---------|
| Casa de Paz | semanal | hogar | No | Si |
| Servicio Central | semanal | iglesia | No | Si |
| Servicio Central Nocturno | semanal | iglesia | No | Si |
| Servicio de Jovenes | semanal | iglesia | No | Si |
| Discipulado | semanal | iglesia | No | No |
| Oracion | semanal | iglesia | No | No |
| Seminario | semanal | iglesia | No | No |
| Ayuno | semanal | iglesia | No | No |

**Relaciones:**
- `(:TipoReunion)-[:PROGRAMA]->(:Iglesia)`
- `(:TipoReunion)-[:TIENE_INSTANCIA]->(:InstanciaReunion)`

---

### 1.11 Instancias de Reunion

```
(:InstanciaReunion {
  id: UUID,
  fecha: date,
  hora_inicio: time,
  hora_fin: time,
  lugar: "Casa de Juan",
  notas: "Reunion especial",
  tipo_reunion_id: UUID,
  iglesia_id: UUID,
  created_at: timestamp
})
```

**Relaciones:**
- `(:InstanciaReunion)-[:REALIZADA_EN]->(:Iglesia)`
- `(:Persona)-[:ASISTE_A]->(:InstanciaReunion)`

---

### 1.12 Ofrendas

```
(:Ofrenda {
  id: UUID,
  fecha: date,
  monto: decimal,
  moneda: "BOB" | "USD" | "EUR",
  tipo: "diezmo" | "ofrenda" | "especial",
  instancia_reunion_id: UUID,
  persona_id: UUID,
  notas: "...",
  created_at: timestamp
})
```

**Reglas:**
- Cada registro de ofrenda tiene su propia moneda
- No se mezclan monedas en un mismo registro

**Relaciones:**
- `(:Ofrenda)-[:CONTRIBUYE]->(:InstanciaReunion)`
- `(:Persona)-[:CONTRIBUYE]->(:Ofrenda)`

---

### 1.13 Reportes

```
(:Reporte {
  id: UUID,
  tipo: "cdp" | "red" | "iglesia",
  periodo: "2024-Q1",
  contenido: {...},
  iglesia_id: UUID,
  created_at: timestamp
})
```

**Relaciones:**
- `(:Reporte)-[:RECIBE_INFORME]->(:Iglesia)`
- `(:Reporte)-[:CREA]->(:Persona)`

---

### 1.14 Vision

```
(:Vision {
  id: UUID,
  anio: 2024,
  descripcion: "Meta anual de crecimiento...",
  iglesia_id: UUID,
  created_at: timestamp
})
```

**Relaciones:**
- `(:Vision)-[:ESTABLECE_VISION]->(:Iglesia)`
- `(:Vision)-[:ADOPTA_VISION]->(:Red)`

---

### 1.15 Eventos Anuales

```
(:EventoAnual {
  id: UUID,
  nombre: "RMS",
  descripcion: "Congreso de jovenes"
})
```

**Catalogo (5):**

| Evento | Descripcion |
|--------|-------------|
| RMS | Congreso de jovenes |
| MOS | Movimiento Sobrenatural |
| Congreso de Mujeres | Encuentro de mujeres |
| Congreso de Hombres | Encuentro de hombres |
| Congreso de Ninos | Encuentro de ninos |

---

### 1.16 Eventos de Bautismo

```
(:EventoBautizo {
  id: UUID,
  fecha: date,
  lugar: "Rio Pirai",
  iglesia_id: UUID,
  created_at: timestamp
})
```

**Relaciones:**
- `(:EventoBautizo)-[:REALIZADA_EN]->(:Iglesia)`
- `(:Persona)-[:FUE_BAUTIZADA_EN]->(:EventoBautizo)`

---

### 1.17 Tipos de Relacion Familiar

```
(:TipoRelacion {
  id: UUID,
  nombre: "Esposo",
  inverso: "Esposa"
})
```

**Catalogo (8):**

| Relacion | Inverso |
|----------|---------|
| Esposo | Esposa |
| Esposa | Esposo |
| Padre | Hijo |
| Madre | Hijo |
| Hijo | Padre |
| Hermano | Hermano |
| Abuelo | Nieto |
| Nieto | Abuelo |

**Reglas:**
- Solo familiares directos (esposo, hijos, abuelos)
- No se incluyen suegros, cuñados, etc.
- Seguimiento manual (no inteligencia artificial)

**Relaciones:**
- `(:Persona)-[:FAMILIAR_DE]->(:Persona)`

---

### 1.18 Criterios (Configuracion por Iglesia)

```
(:Criterio {
  id: UUID,
  categoria: "cdp" | "estados",
  nombre: "VISITAS_PARA_MIEMBRO",
  valor: 2,
  descripcion: "Visitas consecutivas para ser miembro"
})
```

**Criterios de CdP:**

| Nombre | Valor | Descripcion |
|--------|-------|-------------|
| VISITAS_PARA_MIEMBRO | 2 | Visitas consecutivas para ser miembro |
| VISITAS_PARA_MIGRAR | 8 | Visitas consecutivas a otra CdP para migrar |
| INASISTENCIAS_PARA_INACTIVO | 12 | Inasistencias consecutivas para inactivar |
| MESES_PARA_RECONCILIADO | 3 | Meses fuera para ser Reconciliado |

**Criterios de Estados SSVA:**

| Nombre | Valor | Descripcion |
|--------|-------|-------------|
| CLASES_PARA_DI | 3 | Clases ausentes para Discipulo Inactivo |
| SEMANAS_NC_PARA_CRE | 1 | Semanas sin discipulado NC a CRE |
| ASISTENCIAS_PARA_DA | 1 | Asistencias para ser Discipulo Activo |
| DIAS_RE_PARA_DA | 1 | Dias como RE antes de DA |
| EDAD_MINIMA_CRE | 12 | Edad minima para ser Creyente |

**Relaciones:**
- `(:Departamento)-[:TIENE]->(:Criterio)`
- `(:Iglesia)-[:CONFIGURA]->(:Criterio)`

---

## 2. Diagrama de Relaciones

```
                                    ┌─────────────┐
                                    │  Cobertura  │
                                    │  (Tenant)   │
                                    └──────┬──────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                          ▼                ▼                ▼
                    ┌──────────┐     ┌──────────┐     ┌──────────┐
                    │ Iglesia  │     │ Iglesia  │     │ Iglesia  │
                    │ (Madre)  │◄────┤ (Hija 1) │     │ (Hija 2) │
                    │  inactiva│     │  activa  │     │  activa  │
                    └────┬─────┘     └────┬─────┘     └────┬─────┘
                         │                │                │
                         │                │                │
                         │         ┌──────┴──────┐         │
                         │         │             │         │
                         │         ▼             ▼         │
                         │    ┌─────────┐  ┌─────────┐     │
                         │    │  Red 1  │  │  Red 2  │     │
                         │    └────┬────┘  └────┬────┘     │
                         │         │            │          │
                         │    ┌────┴────┐  ┌────┴────┐     │
                         │    │         │  │         │     │
                         │    ▼         ▼  ▼         ▼     │
                         │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│
                         │ │CdP 1│ │CdP 2│ │CdP 3│ │CdP 4││
                         │ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘│
                         │    │       │       │       │    │
                         │    └───────┴───────┴───────┘    │
                         │              │                  │
                         │              ▼                  │
                         │        ┌──────────┐             │
                         │        │ Persona  │             │
                         │        │ (Miembro)│             │
                         │        └────┬─────┘             │
                         │             │                   │
                         │             │                   │
                    ┌────┴─────┐       │             ┌────┴─────┐
                    │Departamento│      │             │Ministerio │
                    │(4 activos)│      │             │(14 niveles│
                    └──────────┘      │             │ iglesia)  │
                                      │             └──────────┘
                                      │
                         ┌────────────┼────────────┐
                         │            │            │
                         ▼            ▼            ▼
                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                   │  Estado  │ │  Cargo   │ │ Familia  │
                   │ (6 tipos)│ │(20 cargos│ │(relacion)│
                   └──────────┘ └──────────┘ └──────────┘
```

---

## 3. Diagrama de Estados y Transiciones

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ESTADOS                             │
└─────────────────────────────────────────────────────────────────┘

                           ┌──────────────┐
                           │  SIM         │
                           │ Evangelizado │
                           └──────┬───────┘
                                  │
                                  │ oracion de fe
                                  │ acepta a Jesus
                                  ▼
                           ┌──────────────┐
                           │  NC          │
                           │ Nuevo        │
                           │ Convertido   │
                           └──────┬───────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    │ 1 semana sin discipulado  │ asiste a discipulado
                    │ (solo >12 anos)           │ (al menos 1 vez)
                    ▼                           ▼
             ┌──────────────┐           ┌──────────────┐
             │  CRE         │           │  DA          │
             │ Creyente     │──────────▶│ Discipulo    │
             └──────────────┘           │ Activo       │
                    │                   └──────┬───────┘
                    │                          │
                    │ asiste a discipulado     │ 3 clases continuas
                    │ (al menos 1 vez)        │ ausentes
                    ▼                          ▼
             ┌──────────────┐           ┌──────────────┐
             │  RE          │           │  DI          │
             │ Reconciliado │──────────▶│ Discipulo    │
             └──────────────┘   retoma  │ Inactivo     │
                           asistencia   └──────────────┘
```

---

## 4. Jerarquia de Cargos

```
┌─────────────────────────────────────────────────────────────────┐
│                 JERARQUIA DE CARGOS                             │
└─────────────────────────────────────────────────────────────────┘

NIVEL VISION (MACRO)
├── Lider de la Vision en Accion (permanente)
├── Encargado de Departamentos (Vision)
└── Encargado General de Ministerios (Vision)

NIVEL IGLESIA (5 Ministerios - designados por apostol)
├── Apostol
├── Pastor
├── Profeta
├── Evangelista
└── Maestro

NIVEL IGLESIA (Cargos Ministeriales)
├── Ministro
├── Anciano
├── Diacono
└── Mentor (pendiente)

NIVEL RED
├── Lider de Red
├── Encargado de Departamentos de Red (obligatorio)
└── Encargado de Ministerio de Red (obligatorio)

NIVEL CdP
├── Lider de CdP
└── Sublider de CdP

OTROS FUNCIONALES
├── Lider de Departamento
├── Operador
└── Contador/Contadora
```

---

## 5. Flujo de Alta de Usuarios

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUJO DE ALTA DE USUARIOS                          │
└─────────────────────────────────────────────────────────────────┘

1. Admin Tecnico
   │
   │ crea
   ▼
2. Pastor
   │
   │ crea
   ▼
3. Supervisor de la Vision en Accion
   │
   │ crea
   ▼
4. Redes / CdP
```

**Reglas:**
- Solo el admin tecnico crea el pastor
- Cada nivel crea al siguiente
- Supervisor solo opera en su propia iglesia
- Supervisor puede ser el mismo para ambas iglesias

---

## 6. Despliegue Inicial

```
┌─────────────────────────────────────────────────────────────────┐
│              DESPLIEGUE INICIAL - 2 IGLESIAS                    │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │   Red Apostolica    │
                    │   del Ap. Edgar     │
                    │   Ortuño (Cobertura)│
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
          ┌──────────────────┐  ┌──────────────────┐
          │  Centro de Vida  │  │  Centro de Vida  │
          │  Global 4 Anillo │  │  Global Montero  │
          │  (Santa Cruz)    │  │  (Montero)       │
          │  ACTIVA          │  │  ACTIVA          │
          └────────┬─────────┘  └────────┬─────────┘
                   │                     │
                   │                     │
            ┌──────┴──────┐        ┌─────┴──────┐
            │             │        │            │
            ▼             ▼        ▼            ▼
      ┌─────────┐   ┌─────────┐ ┌─────────┐ ┌─────────┐
      │  Red 1  │   │  Red 2  │ │  Red 1  │ │  Red 2  │
      └────┬────┘   └────┬────┘ └────┬────┘ └────┬────┘
           │              │          │            │
           ▼              ▼          ▼            ▼
      ┌─────────┐   ┌─────────┐ ┌─────────┐ ┌─────────┐
      │ CdP 1   │   │ CdP 1   │ │ CdP 1   │ │ CdP 1   │
      └─────────┘   └─────────┘ └─────────┘ └─────────┘
```

**Notas:**
- Cochabamba (madre real) NO se da de alta en software aun
- Ambas iglesias hijas comparten el mismo pastor
- Cada iglesia tiene su propio Supervisor de la Vision en Accion
- El Supervisor puede ser la misma persona en ambas iglesias

---

## 7. Modelo de Persona - Ejemplo

```
┌─────────────────────────────────────────────────────────────────┐
│              EJEMPLO DE PERSONA                                 │
└─────────────────────────────────────────────────────────────────┘

(:Persona {
  id: "uuid-1234",
  primer_nombre: "Maria",
  segundo_nombre: "Elena",
  primer_apellido: "Garcia",
  segundo_apellido: "Lopez",
  apellido_casada: "De Garcia",      // Solo si estado_civil = casado
  ci: "87654321",
  ci_exp: "CB",
  fecha_nacimiento: date("1985-03-15"),
  genero: "F",
  telefono: "+591 71234567",
  email: "maria@email.com",
  estado_civil: "casado",
  grado_instruccion: "universitario",
  ocupacion: "Ingeniera",
  direccion: "Av. Principal 123",
  foto_url: "https://...",
  notas: "Activa en ministerio de alabanza",
  iglesia_id: "uuid-iglesia-1",
  fecha_registro: datetime(),
  fecha_eliminacion: null,
  eliminado_por: null
})
```

**Reglas de apellido casada:**
- Solo se usa cuando `estado_civil = casado`
- Si esta casada pero el esposo no esta en el sistema, usar el apellido de nacimiento
- Si el esposo esta en el sistema, usar su apellido

---

## 8. Resumen de Datos Semilla

| Entidad | Cantidad |
|---------|----------|
| Cobertura | 1 |
| Iglesias | 3 (1 inactiva + 2 activas) |
| Cargos | 20 |
| Estados | 6 |
| Transiciones | 7 |
| Departamentos | 4 |
| Ministerios | 14 |
| Tipos de Reunion | 8 |
| Tipos Relacion Familiar | 8 |
| Eventos Anuales | 5 |
| Criterios | 9 |

---

## 9. Notas de Implementacion

### 9.1 Multi-Tenancy
- Cada persona tiene `iglesia_id` para RLS
- El Supervisor solo opera en su propia iglesia
- Los datos se filtran por `iglesia_id` en todas las consultas

### 9.2 Soft Delete
- `fecha_eliminacion` y `eliminado_por` para borrado logico
- Los registros nunca se eliminan fisicamente

### 9.3 Moneda
- Cada registro de ofrenda tiene su propia moneda
- No se mezclan monedas en un mismo registro
- Soporte para BOB, USD, EUR

### 9.4 Configuracion por Iglesia
- Los criterios (CdP y SSVA) son configurables por iglesia
- Cada iglesia puede tener diferentes valores

### 9.5 Familia
- Solo familiares directos (esposo, hijos, abuelos)
- Seguimiento manual (no inteligencia artificial)
- Se pregunta al miembro

### 9.6 Ministerios
- Todos los ministerios son a nivel de iglesia
- Ninguno es a nivel de red
- Encargado de Ministerio de Red coordina PERSONAS, no ministerios

---

## 10. Archivos Relacionados

- `schema.cypher` - Esquema completo de Neo4j
- `seed_catalogs.cypher` - Datos semilla (catalogos)
- `MANUAL.md` - Manual de uso de Neo4j

---

**Version:** 2.0
**Fecha:** 2026-07-14
**Autor:** VisionHub Team
