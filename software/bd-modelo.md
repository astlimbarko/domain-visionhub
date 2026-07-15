# Modelo de Base de Datos — VisionHub

## Stack

- **Plataforma:** Supabase
- **Motor:** PostgreSQL
- **IDs:** UUID en todas las tablas
- **Soft delete:** Nunca borrar fisicamente, usar `fecha_eliminacion` / `eliminado_por`
- **Auditoria:** Todas las tablas tienen campos de auditoria (ver `modulos.md`)
- **RLS:** Row-Level Security para multi-tenancy por `iglesia_id`

---

## Configuracion de Iglesias (Tenancy)

### Modelo de iglesia

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | — |
| nombre | VARCHAR(200) | Ej: "Centro de Vida Global 4 Anillo" |
| ciudad | VARCHAR(100) | Ej: "Santa Cruz" |
| iglesia_padre_id | UUID FK (self) | Null si es iglesia madre. FK a la iglesia que la fundo. |
| pastor_id | UUID FK (persona) | Un pastor puede tener varias iglesias |
| supervisor_id | UUID FK (persona) | Supervisor de la Vision en Accion. Puede ser misma persona en varias iglesias. |
| cobertura_id | UUID FK | — |
| activo | BOOLEAN | Por defecto true |
| fecha_creacion | TIMESTAMP | Auditoria |

### Jerarquia de ejemplo (despliegue inicial)

```
Centro de Vida Global (Cochabamba) — IGLESIA MADRE REAL — NO se da de alta aun
  └── Centro de Vida Global 4 Anillo (Santa Cruz) — IGLESIA HIJA — sede del despliegue
  └── Centro de Vida Global Montero — IGLESIA HIJA
```

### Reglas de visibilidad por rol

| Rol | Que ve en su dashboard | Quien lo crea |
|-----|------------------------|---------------|
| **Admin tecnico** | Todas las iglesias (acceso total). Da de alta al pastor. | Existe por defecto (es el desarrollador) |
| **Pastor** | Resumen de TODAS sus iglesias (madre + hijas). Puede cambiar entre iglesias. | Admin tecnico |
| **Supervisor** | Solo los datos de la iglesia que supervisa. Si supervisa 2 iglesias, cambia entre ellas. Tiene los mismos privilegios que el pastor pero ejecuta procesos (orden directa del pastor). | Pastor |
| **Lider de Red** | Solo su red dentro de su iglesia. | Pastor o Supervisor |
| **Lider de CdP** | Solo su casa de paz dentro de su iglesia. | Pastor o Supervisor |

### Multi-tenancy

- Cada fila de datos tiene `iglesia_id` como campo de tenant.
- RLS (Row-Level Security) en Supabase filtra automaticamente por `iglesia_id`.
- El pastor accede a multiples iglesias via un JOIN con la tabla `iglesia` y el filtro `pastor_id`.
- El supervisor accede a multiples iglesias via `supervisor_id`.
- Cada otra persona solo accede a su iglesia.

---

## Modelo de Persona (nombres)

### Estructura de campos

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|-------|
| primer_nombre | VARCHAR(100) | Si | Ej: "Maria" |
| segundo_nombre | VARCHAR(100) | No | Ej: "Elena" |
| primer_apellido | VARCHAR(100) | Si | Ej: "Lopez" |
| segundo_apellido | VARCHAR(100) | No | Ej: "Garcia" |
| apellido_casada | VARCHAR(100) | No | Ej: "de Perez" |

### Recomendacion: UN VARCHAR por nombre, NO separar

Usar un solo VARCHAR por campo (primer_nombre, segundo_nombre, etc.). NO separar en "nombre1", "nombre2" porque:

- En Bolivia la mayoria tiene 1 o 2 nombres. Rara vez mas.
- Si alguien tiene 3 nombres, el segundo campo puede contener los dos: "Elena Maria".
- Separar en 3+ campos agrega complejidad sin beneficio real.
- Los formularios de la iglesia piden "primer nombre", "segundo nombre" — el modelo sigue el formulario.

### Apellido de casada (Bolivia)

En Bolivia, cuando una mujer se casa legalmente, su nombre civil cambia:
- Soltera: "Maria Lopez Garcia"
- Casada: "Maria Lopez de Perez" (apellido del esposo con "de")
- Divorciada: vuelve a "Maria Lopez Garcia"

**Regla en el sistema:**
1. `apellido_casada` se llena solo cuando `estado_civil = casado`.
2. El sistema puede sugerir el valor: concatenar apellido del esposo + "de" + primer apellido de la mujer.
3. El usuario puede corregir si la persona no usa ese formato.
4. El campo NO modifica los otros campos de apellido.
5. Para documentos oficiales o impresos, se usa `apellido_casada` cuando `estado_civil = casado`.

### Vista de nombre completo

```
CASE
  WHEN apellido_casada IS NOT NULL AND estado_civil = 'casado'
    THEN primer_nombre || ' ' || COALESCE(segundo_nombre, '') || ' ' ||
         primer_apellido || ' ' || COALESCE(segundo_apellido, '') || ' ' || apellido_casada
  ELSE
    primer_nombre || ' ' || COALESCE(segundo_nombre, '') || ' ' ||
    primer_apellido || ' ' || COALESCE(segundo_apellido, '')
END
```

---

## Enum: Grado de Instruccion

```sql
CREATE TYPE grado_instruccion_enum AS ENUM (
  'SIN_INSTRUCCION',
  'PRIMARIA_INCOMPLETA',
  'PRIMARIA_COMPLETA',
  'SECUNDARIA_INCOMPLETA',
  'SECUNDARIA_COMPLETA',
  'TECNICO_MEDIO',
  'TECNICO_SUPERIOR',
  'LICENCIATURA_INGENIERIA',
  'DIPLOMADO',
  'MAESTRIA',
  'DOCTORADO'
);
```

---

## Relaciones Familiares

### Modelo

| Tabla | Campos | Descripcion |
|-------|--------|-------------|
| tipo_relacion | id, nombre, inverso | Define el tipo y su inverso (padre→hijo, esposo→esposa) |
| familia | persona_id, familiar_id, tipo_relacion_id | Relacion entre dos personas del sistema |
| referencia_familiar | persona_id, nombre_familiar, tipo_relacion_id | Texto libre cuando el familiar no esta en la BD |

### Reglas

- Las relaciones familiares se registran manualmente (el lider pregunta).
- No se usa IA para detectar familias.
- El tipo de relacion debe tener un inverso definido.

---

## Mapeo: Formulario de Membresia → BD

Fuente: formulario actual de la iglesia (presencial/online).

| Campo del formulario | Tabla | Campo BD | Notas |
|---------------------|-------|----------|-------|
| Primer nombre | persona | primer_nombre | Obligatorio |
| Segundo nombre | persona | segundo_nombre | Opcional |
| Primer apellido | persona | primer_apellido | Obligatorio |
| Segundo apellido | persona | segundo_apellido | Opcional |
| Apellido casada | persona | apellido_casada | Opcional, segun estado civil |
| Fecha de nacimiento | persona | fecha_nacimiento | Opcional |
| Lugar de nacimiento | persona_detalle | nacimiento_ciudad | Ciudad |
| CI | persona | ci | Unico en todo el sistema |
| Sexo | persona | sexo | M o F |
| Estado civil | persona_detalle | estado_civil | soltero, casado, viudo, divorciado |
| Grado de instruccion | persona_detalle | grado_instruccion | Enum |
| Ocupacion | persona_detalle | ocupacion | Texto libre |
| Telefono | telefono | numero | Modelo hibrido (asignacion + datos) |
| Direccion | direccion_asignacion + direccion | — | Modelo hibrido |
| Fecha de llegada | persona_llegada | fecha_ingreso_iglesia | — |
| Bautizo en esta iglesia | afirmacion | bautizo_en_esta_iglesia | Boolean |
| Fecha de bautizo | afirmacion | fecha_bautizo | Opcional |
| Iglesia donde se bautizo | afirmacion | iglesia_bautizado (FK) o iglesia_bautizado_txt | Si esta en BD o no |
| Motivo de llegada | persona_llegada | motivo_llegada_iglesia | — |
| Casa de paz | casa_de_paz_membresia | casa_de_paz_id | — |
| Cargo(s) en la iglesia | liderazgo_persona | nombre_liderazgo | Opcion multiple opcional |
| Fecha ultimo envio como lider | envio_cdp | fecha_ultimo_envio | Texto, revisar formato |
| Ministerio donde sirve | ministerio | — | Verificar asignacion ministerial |
| Es lider de ministerio? | ministerio | — | Verificar si es cargo o asignacion |

---

## Mapeo: Formulario Reporte CdP → BD

Fuente: formulario actual de reporte semanal de casa de paz.

| Campo del formulario | Tabla | Campo BD | Notas |
|---------------------|-------|----------|-------|
| Fecha de reunion | casa_de_paz_reporte | fecha_reunion | — |
| Tema | casa_de_paz_reporte | casa_de_paz_tema_id | FK a tabla de temas |
| Libro | casa_de_paz_reporte | casa_de_paz_libro_id | FK (1-7) |
| Quien enseno la palabra | casa_de_paz_reporte | disertador_id | FK a persona |
| Total ofrendas | finanzas_ingresos | cantidad | Solo cuando tipo_ingreso_id = "ofrenda" |
| Total diezmos | finanzas_ingresos | cantidad | Solo cuando tipo_ingreso_id = "diezmo" |
| Salio a evangelizar | casa_de_paz_reporte | salio_evangelizar | Boolean Si/No |
| Cantidad de evangelizados | evangelismo | — | Suma de registros evangelismo con fecha = fecha_reunion |
| Testimonios | casa_de_paz_reporte | testimonios | Texto |
| Comentarios | casa_de_paz_reporte | comentarios | Texto |

### Nota sobre ofrendas/diezmos del formulario

El formulario captura los totales de ofrenda y diezmo de la reunion. Estos montos se registran en la tabla `finanzas_ingresos` con su tipo correspondiente. La moneda se registra por cada ingreso.

---

## Mapeo: Estados SSVA → BD

| Estado | Sigla | Regla de transicion |
|--------|-------|---------------------|
| Evangelizado | SIM | Estado inicial. No avanza → se mantiene SIM |
| Nuevo Convertido | NC | Acepto a Jesus. 1 semana sin discipulado → CRE (solo >12 anos) |
| Reconciliado | RE | Retorno +3 meses. 1 vez en discipulado → DA |
| Discipulo Activo | DA | Asiste a discipulado. 3 clases ausentes → DI |
| Discipulo Inactivo | DI | Abandono. +3 meses → RE (volver a evaluar) |

### Regla de edad para CRE

La transicion NC → CRE (1 semana sin discipulado) aplica solo para **mayores de 12 anos**. Menores de 12 anos que no asisten se mantienen en NC.

---

## Mapeo: Formulario Evangelismo → BD

| Campo | Tabla | Campo BD | Notas |
|-------|-------|----------|-------|
| Persona evangelizada | evangelismo | persona_id | FK |
| Fecha | evangelismo | fecha | — |
| Domicilio | evangelismo | domicilio | Texto libre (normalizar despues) |
| Telefono | evangelismo | telefono_persona_id | FK a telefono |
| Escala | evangelismo | escala | casa_de_paz, red, iglesia, cobertura |

---

## Finanzas: Modelo de ingresos

| Campo | Tabla | Campo BD | Notas |
|-------|-------|----------|-------|
| Tipo de ingreso | finanzas_tipo_ingreso | id, nombre | ofrenda, diezmo, primicia, pacto |
| Monto | finanzas_ingresos | cantidad | Numerico |
| Moneda | finanzas_ingresos | moneda | BOB, USD, u otra |
| Persona (opcional) | finanzas_ingresos | persona_id | Null si es grupal |
| Reunion | finanzas_ingresos | tipo_reunion_id | FK a tipo de reunion |
| Fecha | finanzas_ingresos | fecha | — |

### Regla de moneda

Cada registro de ingreso tiene su propia moneda. No se permite mezclar monedas en un solo registro. En una misma reunion puede haber registros en BOB y registros en USD por separado.

---

## Conteo de familias

Para la iglesia es importante saber cuantas familias existen. Se considera "familia" a los **familiares directos**:

- Esposo/esposa
- Hijos
- Abuelos

**Regla:** Solo se toman en cuenta familiares directos. No se incluyen primos, tios, etc.

**Estado civil como indicador:** Saber cuantas parejas casadas hay es un indicador importante para la iglesia.

**Nota:** El modelo exacto de como rastrear y contar familias esta pendiente de disenho. Se recibiran ideas de Claude Code para definir la mejor implementacion.

---

## Pendientes de modelado

1. **Fecha ultimo envio como lider:** Definir si es DATE, TEXT o TIMESTAMP. El formulario actual pide "dia, mes o anio" — podria ser solo TEXT con formato flexible.
2. **Cantidad de evangelizados:** El formulario pide un numero, pero el conteo real se hace sumando registros de evangelismo con la misma fecha. Definir si el campo del formulario es solo informativo o se calcula.
3. **Moneda por defecto:** Definir si se requiere un tipo de moneda por defecto (probablemente BOB).
4. **Lecciones por curso:** La cantidad varia (12, 5, 10). Verificar si hay estandar o si se permite configurable.
