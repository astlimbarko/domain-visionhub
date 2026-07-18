# Tasks: Mejora del Formulario de Evangelismo

## Task 1: Backend - Endpoint de Búsqueda Global de Personas
- [x] 1.1 Crear método `buscarGlobal()` en `PersonasService`
  - Implementar búsqueda en nombre, apellidos y teléfonos
  - Usar ILIKE para case-insensitive
  - Incluir relación con teléfonos
  - Calcular edad si hay fecha de nacimiento
  - Limitar resultados a 10
  - Ordenar por relevancia
- [x] 1.2 Crear endpoint GET `/api/v1/personas/buscar-global` en `PersonasController`
  - Recibir query parameter `q`
  - Recibir query parameter `limit` (opcional, default 10)
  - Validar parámetros
  - Retornar lista de personas con teléfonos
- [x] 1.3 Agregar tests unitarios para búsqueda global

## Task 2: Frontend - Componente BuscadorPersonasGlobal
- [x] 2.1 Crear componente `BuscadorPersonasGlobal.tsx`
  - Input de búsqueda con icono de lupa
  - Implementar debounce de 300ms
  - Mostrar spinner mientras carga
  - Dropdown con resultados
  - Botón "Agregar nueva persona"
- [x] 2.2 Crear servicio `buscarPersonasGlobal()` en `personas.service.ts`
  - Llamar al endpoint de búsqueda global
  - Manejar errores
- [x] 2.3 Estilizar componente según diseño
  - Mostrar nombre completo, teléfono y edad
  - Resaltar término de búsqueda en resultados
  - Hover effects

## Task 3: Frontend - Componente FormularioEvangelizado
- [x] 3.1 Crear componente `FormularioEvangelizado.tsx`
  - Estructura básica del formulario
  - Props: personaInicial, onGuardar, onCancelar
- [x] 3.2 Implementar sección "Datos Personales"
  - Primer nombre (requerido)
  - Segundo nombre (opcional)
  - Primer apellido (requerido)
  - Segundo apellido (opcional)
  - Apellido de casada (condicional si mujer)
  - Teléfono (requerido)
  - Dirección (requerida)
  - Sexo (requerido, selector)
  - Fecha de nacimiento (requerida, date picker)
- [x] 3.3 Implementar sección "Datos de Evangelismo"
  - SSVA (requerido, selector)
  - Tipo de Evangelismo (requerido, selector)
  - Persona que lo trajo (condicional, buscador)
  - Evangelizador (requerido, buscador)
- [x] 3.4 Implementar lógica condicional
  - Mostrar "Apellido de casada" solo si sexo === 'F'
  - Mostrar "Persona que lo trajo" solo si tipo es Elite o 1+1
- [x] 3.5 Implementar validaciones
  - Validar campos requeridos
  - Validar formato de teléfono
  - Validar fecha de nacimiento (pasado)
  - Mostrar errores en rojo
- [x] 3.6 Implementar autocompletado
  - Si personaInicial existe, precargar todos los campos
  - Permitir edición de campos precargados
- [x] 3.7 Botones de acción
  - Botón "Cancelar" (llamar onCancelar)
  - Botón "Guardar" (validar y llamar onGuardar)

## Task 4: Frontend - Integración en SeccionEvangelismo
- [x] 4.1 Modificar `SeccionEvangelismo.tsx`
  - Agregar estado para mostrarBuscador
  - Agregar estado para mostrarFormulario
  - Agregar estado para personaSeleccionada
- [x] 4.2 Implementar flujo de "Sí" en salida evangelística
  - Al seleccionar "Sí", mostrar BuscadorPersonasGlobal
  - Al seleccionar "No", ocultar todo
- [x] 4.3 Implementar handlers
  - handlePersonaSeleccionada: abrir formulario con datos
  - handleNuevaPersona: abrir formulario vacío
  - handleGuardarEvangelizado: agregar a lista y volver a buscador
  - handleCancelarFormulario: volver a buscador
- [x] 4.4 Actualizar contador de evangelizados
  - Mostrar "Total evangelizados: X"
  - Actualizar al agregar/remover

## Task 5: Frontend - Componente BuscadorPersonas Reutilizable
- [x] 5.1 Crear componente `BuscadorPersonas.tsx` (para evangelizador y persona que lo trajo)
  - Similar a BuscadorPersonasGlobal pero más compacto
  - Props: label, onSelect, required
  - Mostrar persona seleccionada
  - Botón para cambiar selección

## Task 6: Backend - Validaciones Mejoradas
- [ ] 6.1 Agregar validaciones en DTOs
  - Validar datos personales
  - Validar datos de evangelismo
  - Validar campos condicionales
- [ ] 6.2 Mejorar manejo de errores
  - Mensajes de error claros
  - Códigos de error específicos

## Task 7: Frontend - Tipos TypeScript
- [ ] 7.1 Crear/actualizar tipos en `types/persona.types.ts`
  - PersonaCompleta
  - PersonaBusqueda
- [ ] 7.2 Crear/actualizar tipos en `types/evangelismo.types.ts`
  - EvangelizadoData
  - TipoEvangelismo
  - SSVA

## Task 8: Testing y Refinamiento
- [ ] 8.1 Probar flujo completo: persona nueva
- [ ] 8.2 Probar flujo completo: persona existente
- [ ] 8.3 Probar validaciones
- [ ] 8.4 Probar campos condicionales
- [ ] 8.5 Probar agregar múltiples evangelizados
- [ ] 8.6 Probar búsqueda con diferentes términos
- [ ] 8.7 Ajustar estilos según feedback
- [ ] 8.8 Optimizar performance

## Task 9: Documentación
- [ ] 9.1 Documentar endpoint de búsqueda global
- [ ] 9.2 Documentar componentes nuevos
- [ ] 9.3 Actualizar README si es necesario

## Orden de Implementación Recomendado

1. Task 1 (Backend búsqueda)
2. Task 2 (Buscador global)
3. Task 5 (Buscador reutilizable)
4. Task 3 (Formulario)
5. Task 4 (Integración)
6. Task 6 (Validaciones backend)
7. Task 7 (Tipos)
8. Task 8 (Testing)
9. Task 9 (Documentación)

## Notas de Implementación

- Usar componentes UI existentes (Input, Select, Button, Modal)
- Mantener consistencia con el estilo actual
- Reutilizar servicios existentes cuando sea posible
- Considerar accesibilidad (labels, aria-labels)
- Implementar loading states
- Manejar errores gracefully
