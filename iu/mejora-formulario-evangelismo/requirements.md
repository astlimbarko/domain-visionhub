# Mejora del Formulario de Evangelismo en Agregar Reporte

## Objetivo
Mejorar el flujo de captura de datos de evangelismo en el módulo "Agregar nuevo reporte" con un buscador inteligente y formulario completo.

## Contexto
Actualmente, cuando se selecciona "Sí" en "¿Salida evangelística?", solo aparece un campo de búsqueda simple. Se requiere un flujo más completo que:
- Busque personas en toda la base de datos
- Autocomplete datos si la persona ya existe
- Capture información completa de evangelismo
- Maneje diferentes tipos de evangelismo con campos condicionales

## Requisitos Funcionales

### RF-001: Buscador Inteligente de Personas
**Prioridad:** Alta

Cuando el usuario selecciona "Sí" en "¿Salida evangelística?":
- Debe aparecer un buscador inteligente
- El buscador debe buscar en TODA la base de datos de personas (no solo de la Casa de Paz actual)
- Debe buscar por: nombre completo, teléfono, o cualquier combinación
- Debe mostrar resultados mientras el usuario escribe (búsqueda en tiempo real)
- Los resultados deben mostrar: Nombre completo, teléfono, edad (si disponible)

### RF-002: Autocompletado de Datos Existentes
**Prioridad:** Alta

Si la persona ya existe en la base de datos:
- Al seleccionarla del buscador, debe autocompletar todos los campos disponibles:
  - Primer nombre
  - Segundo nombre (si tiene)
  - Primer apellido
  - Segundo apellido (si tiene)
  - Apellido de casada (si es mujer y tiene)
  - Teléfono
  - Dirección
  - Sexo
  - Fecha de nacimiento
- Los campos autocompletados deben ser editables (por si hay cambios)

### RF-003: Formulario Completo de Evangelismo
**Prioridad:** Alta

El formulario debe incluir los siguientes campos:

**Datos Personales:**
- Primer nombre (requerido)
- Segundo nombre (opcional)
- Primer apellido (requerido)
- Segundo apellido (opcional)
- Apellido de casada (opcional, solo visible si sexo = Mujer)
- Teléfono (requerido)
- Dirección (requerido)
- Sexo (requerido): Selector con opciones Masculino/Femenino
- Fecha de nacimiento (requerido)

**Datos de Evangelismo:**
- SSVA (requerido): Selector con opciones:
  - Nuevo Creyente
  - Reconciliación
- Tipo de Evangelismo (requerido): Selector con opciones:
  - Elite
  - 1+1
  - (Puede haber más tipos en el futuro)
- Evangelizador (requerido): Buscador inteligente de personas en la base de datos
  - Debe buscar entre todos los miembros
  - Mostrar nombre completo en resultados

### RF-004: Campos Condicionales
**Prioridad:** Alta

**Si se selecciona "Elite" o "1+1" en Tipo de Evangelismo:**
- Debe aparecer un campo adicional: "Persona que lo trajo"
- Este campo debe ser un buscador inteligente de personas
- Es requerido cuando el tipo es Elite o 1+1

**Si se selecciona "Mujer" en Sexo:**
- Debe aparecer el campo "Apellido de casada"
- Es opcional

### RF-005: Validaciones
**Prioridad:** Media

- Todos los campos marcados como requeridos deben validarse antes de guardar
- El teléfono debe tener formato válido
- La fecha de nacimiento debe ser una fecha válida y en el pasado
- No permitir guardar si faltan campos requeridos

### RF-006: Agregar Múltiples Evangelizados
**Prioridad:** Media

- Después de guardar un evangelizado, debe permitir agregar otro
- Debe mantener el contador "Total evangelizados: X"
- Debe mostrar la lista de evangelizados agregados en la sesión actual

## Requisitos No Funcionales

### RNF-001: Usabilidad
- El buscador debe responder en menos de 500ms
- Los resultados deben aparecer mientras el usuario escribe (debounce de 300ms)
- El formulario debe ser intuitivo y fácil de usar

### RNF-002: Rendimiento
- La búsqueda debe ser eficiente incluso con miles de registros
- Usar paginación en resultados si hay más de 10 coincidencias

## Casos de Uso

### CU-001: Agregar Evangelizado Nuevo
1. Usuario selecciona "Sí" en "¿Salida evangelística?"
2. Aparece el buscador inteligente
3. Usuario escribe el nombre de la persona
4. No hay resultados (persona nueva)
5. Usuario hace clic en "Agregar nueva persona"
6. Se abre el formulario completo vacío
7. Usuario llena todos los campos
8. Usuario selecciona tipo de evangelismo "Elite"
9. Aparece campo "Persona que lo trajo"
10. Usuario busca y selecciona al evangelizador
11. Usuario guarda
12. Se agrega a la lista de evangelizados

### CU-002: Agregar Evangelizado Existente
1. Usuario selecciona "Sí" en "¿Salida evangelística?"
2. Aparece el buscador inteligente
3. Usuario escribe el nombre de la persona
4. Aparecen resultados coincidentes
5. Usuario selecciona a la persona
6. El formulario se abre con datos autocompletados
7. Usuario revisa/edita datos si es necesario
8. Usuario completa datos de evangelismo
9. Usuario guarda
10. Se agrega a la lista de evangelizados

## Notas Técnicas

- El buscador debe usar el servicio de personas existente
- Considerar crear un nuevo endpoint en el backend si es necesario para búsqueda global
- El formulario debe ser un componente reutilizable
- Usar validación en frontend y backend

## Criterios de Aceptación

- ✅ El buscador busca en toda la base de datos
- ✅ Los datos se autocompletar correctamente
- ✅ Todos los campos del formulario están presentes
- ✅ Los campos condicionales aparecen/desaparecen según corresponda
- ✅ Las validaciones funcionan correctamente
- ✅ Se pueden agregar múltiples evangelizados
- ✅ El contador se actualiza correctamente
