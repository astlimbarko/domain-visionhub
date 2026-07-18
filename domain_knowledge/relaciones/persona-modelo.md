# Modelo de Persona y Datos de Contacto

## Persona

La persona es la entidad central del sistema. Cada persona pertenece a una iglesia.

### Datos basicos

| Campo | Descripcion |
|-------|-------------|
| Primer nombre | Obligatorio |
| Segundo nombre | Opcional |
| Primer apellido | Obligatorio |
| Segundo apellido | Opcional |
| Apellido casada | Opcional |
| Sexo | M o F |
| Fecha de nacimiento | Opcional |
| CI (documento de identidad) | Unico en todo el sistema |
| Correo electronico | Solo para contacto, NO es usuario de autenticacion. Minusculas, sin espacios |
| Iglesia | FK - define a que iglesia pertenece |

### Campo oculto

Se usa para ocultar personas de alto rango en busquedas normales. Por defecto, las busquedas filtran `oculto = false`.

### Persona detalle

Extension de persona para no sobrecargar la tabla principal:

| Campo | Descripcion | Uso |
|-------|-------------|-----|
| Lugar de nacimiento | Ciudad de nacimiento | Informativo |
| Estado civil | soltero(a), casado(a), viudo(a), divorciado(a) | Informativo — sirve para saber parejas casadas en la iglesia (indicador importante). Si es casada y no tiene marido en el sistema, se usa su apellido de nacimiento por omision. |
| Grado de instruccion | Ver enum abajo | Informativo — para censos y saber poblaciones dentro de la iglesia |
| Ocupacion | Texto libre | Informativo |

### Grado de instruccion

SIN_INSTRUCCION, PRIMARIA_INCOMPLETA, PRIMARIA_COMPLETA, SECUNDARIA_INCOMPLETA, SECUNDARIA_COMPLETA, TECNICO_MEDIO, TECNICO_SUPERIOR, LICENCIATURA/INGENIERIA, DIPLOMADO, MAESTRIA, DOCTORADO.

## Direccion (modelo hibrido)

Las direcciones se manejan con un modelo de dos tablas para garantizar integridad en la base de datos.

### Asignacion de direccion

Relaciona una direccion con una unica entidad del sistema. Permite multiples direcciones por entidad.

| Campo | Descripcion |
|-------|-------------|
| Persona | FK (una sola entidad por registro) |
| Iglesia | FK |
| Casa de paz | FK |
| Es principal | Boolean - una sola direccion principal por entidad |
| Activo | Boolean - permite historial sin eliminar datos |

Regla: solo una FK debe tener valor (persona, iglesia o casa_de_paz).

### Datos fisicos de la direccion

| Campo | Descripcion |
|-------|-------------|
| Ciudad | Ciudad |
| Zona | Zona o barrio |
| Anillo | Exclusivo de Santa Cruz de la Sierra |
| Calle | Calle |
| Numero | Numero de domicilio |
| Referencia | Punto de referencia |
| URL GPS | Para integracion con mapas |
| Observaciones | Notas adicionales |

## Telefono (modelo hibrido)

Mismo modelo que direcciones: una tabla de asignacion y una de datos.

### Asignacion de telefono

| Campo | Descripcion |
|-------|-------------|
| Persona | FK |
| Iglesia | FK |
| Casa de paz | FK |
| Tipo de telefono | FK (celular_personal, celular_trabajo, fijo, whatsapp, otro) |
| Numero | Texto del numero |
| Es principal | Boolean |
| Activo | Boolean |

Regla: solo una FK debe tener valor (persona, iglesia o casa_de_paz).

## Persona e ingreso a la iglesia

Datos sobre como llego una persona a la iglesia:

| Campo | Descripcion |
|-------|-------------|
| Persona | FK |
| Motivo de llegada | Decision propia, invitacion de alguien, evento, campana, otro |
| Fecha de ingreso | Fecha en que llego |
| Invitado por (persona) | FK si es alguien que esta en la BD |
| Invitado por (texto) | Si el invitador no esta en la BD |
| Iglesia | FK |
| Comentarios | Notas |

### Apellido de casada (Bolivia)

En Bolivia, cuando una mujer se casa, su nombre legal cambia: agrega el apellido del esposo. Ejemplo: "Maria Lopez" se cas con "Juan Perez" → "Maria Lopez de Perez". Cuando se divorcia, vuelve a su nombre de soltera.

**Como manejarlo:** El campo `apellido_casada` es opcional. Se llena cuando `estado_civil = casado`. El sistema debe sugerir el apellido casada automaticamente: concatenar apellido del esposo con "de" + apellido de la mujer. El lider puede corregirlo si la persona no usa ese formato.

**Regla:** El sistema NO debe cambiar el nombre completo de la persona. Solo se usa el `apellido_casada` para documentos o impresos cuando es necesario.

## Familia y relaciones

### Tracking familiar (proceso manual)

Las relaciones familiares se registran de forma manual. El lider de casa de paz pregunta a los nuevos miembros si tienen familiares en la iglesia. No se usa IA para detectar familias. El proceso es:

1. Al ingresar un miembro nuevo, el lider pregunta: "Tiene familiares en la iglesia?"
2. Si la respuesta es si, el lider registra el nombre del familiar y la relacion.
3. Si el familiar no esta en el sistema, se guarda como referencia en texto libre.

### Familia

Registra relaciones familiares entre personas que estan en el sistema.

| Campo | Descripcion |
|-------|-------------|
| Persona | FK |
| Familiar | FK (otra persona) |
| Tipo de relacion | FK (padre, hijo, esposo, hermano, etc.) |

### Tipo de relacion

Define el tipo y su inverso (padre -> hijo, esposo -> esposa, hermano -> hermano).

### Referencia familiar

Almacena referencias en texto libre cuando el familiar no esta registrado en el sistema.

| Campo | Descripcion |
|-------|-------------|
| Persona | FK |
| Nombre del familiar | Texto |
| Tipo de relacion | FK |

## Documentos relacionados

- [Jerarquia](jerarquia.md)
- [Entidades](entidades.md)
