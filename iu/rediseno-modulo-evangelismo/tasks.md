# Plan de Implementación: Rediseño del Módulo de Evangelismo

## Overview

Implementación incremental del rediseño del módulo de Evangelismo. Se introduce la tabla `meta_evangelismo_asignada`, un nuevo módulo NestJS `MetaEvangelismo`, nuevos componentes React para la vista de líder y la vista de gestión para roles superiores, y se actualiza la lógica de cálculo de la Tasa de Evangelismo.

## Tasks

- [x] 1. Migración de base de datos: tabla `meta_evangelismo_asignada`
  - Agregar el modelo `MetaEvangelismoAsignada` al schema de Prisma con todos los campos definidos en el diseño: `id`, `casaDePazId`, `asignadorUsuarioId`, `meta`, `fechaInicio`, `fechaFin`, `observaciones`, campos de auditoría y soft-delete
  - Agregar la relación inversa `metasAsignadas` en el modelo `CasaDePaz`
  - Agregar la relación inversa `metasAsignadas` en el modelo `Usuario` con el nombre `"MetasAsignadasPorUsuario"`
  - Agregar los índices en `casaDePazId`, `asignadorUsuarioId`, `fechaInicio` y `fechaFin`
  - Generar y aplicar la migración Prisma (`prisma migrate dev`)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 11.2_

- [x] 2. Backend: DTOs y módulo `MetaEvangelismo`
  - [x] 2.1 Crear el módulo NestJS `meta-evangelismo` con su estructura de archivos: `meta-evangelismo.module.ts`, `meta-evangelismo.controller.ts`, `meta-evangelismo.service.ts`
    - Registrar el módulo en `app.module.ts`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Crear los DTOs de validación
    - `dto/asignar-meta.dto.ts`: campos `casaDePazId` (Int, min 1), `meta` (Int, min 1), `fechaInicio` (DateString), `fechaFin` (DateString), `observaciones` (opcional String)
    - `dto/update-meta-asignada.dto.ts`: todos los campos opcionales con las mismas validaciones
    - Usar decoradores de `class-validator`: `@IsInt`, `@Min`, `@IsDateString`, `@IsOptional`, `@IsString`
    - _Requirements: 2.3, 2.4, 3.3_

- [x] 3. Backend: `MetaEvangelismoService` — lógica de negocio
  - [x] 3.1 Implementar `getMetaCdp(casaDePazId)`: consulta `metaEvangelismo` de `CasaDePaz` y la meta vigente (fecha_inicio <= hoy <= fecha_fin, deletedAt null) con datos del asignador; retorna `{ metaPropia, metaAsignada }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 3.2 Escribir test de propiedad para `getMetaCdp` — meta vigente por rango de fechas
    - **Property 7: Meta vigente determinada por rango de fechas**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 3.3 Implementar `verificarAutoridad(userId, casaDePazId)`: obtiene el rol activo del usuario desde `UsuarioRolSistema`, obtiene la CDP con su red e iglesia, y aplica la lógica de autorización por rol (PASTOR, SUPERVISOR_VISION_ACCION, LIDER_RED, SUBLIDER_RED → autorizado según jerarquía; LIDER_CDP, SUBLIDER_CDP → ForbiddenException)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x]* 3.4 Escribir test de propiedad para `verificarAutoridad` — autorización jerárquica
    - **Property 1: Autorización jerárquica para asignación de metas**
    - **Validates: Requirements 2.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

  - [x] 3.5 Implementar `asignar(dto, userId)`: llama a `verificarAutoridad`, valida que `fechaFin >= fechaInicio` y `meta > 0`, hace soft-delete de la meta vigente anterior si existe, crea el nuevo registro con `asignadorUsuarioId = userId`, retorna la meta creada con datos del asignador
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x]* 3.6 Escribir test de propiedad para `asignar` — round-trip de creación
    - **Property 2: Round-trip de creación de meta asignada**
    - **Validates: Requirements 2.2, 4.1, 4.2, 4.4**

  - [x]* 3.7 Escribir test de propiedad para `asignar` — rechazo de fechas inválidas
    - **Property 3: Rechazo de fechas inválidas**
    - **Validates: Requirements 2.3, 3.3**

  - [x]* 3.8 Escribir test de propiedad para `asignar` — rechazo de meta no positiva
    - **Property 4: Rechazo de meta no positiva**
    - **Validates: Requirements 2.4, 5.4**

  - [x]* 3.9 Escribir test de propiedad para `asignar` — unicidad de meta vigente
    - **Property 5: Unicidad de meta vigente por CDP**
    - **Validates: Requirements 2.5**

  - [x] 3.10 Implementar `update(metaId, dto, userId)`: verifica que `userId == asignadorUsuarioId` (ForbiddenException si no), valida fechas y meta si se proporcionan, actualiza el registro, retorna la meta actualizada con datos del asignador
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]* 3.11 Escribir test de propiedad para `update` — autorización de modificación solo para el asignador original
    - **Property 6: Autorización de modificación solo para el asignador original**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.12 Implementar `remove(metaId, userId)`: verifica que `userId == asignadorUsuarioId`, realiza soft-delete del registro
    - _Requirements: 3.4_

  - [x] 3.13 Implementar `getCdpsJerarquia(userId)`: obtiene el rol activo del usuario, consulta las CDPs bajo su jerarquía (por iglesia, red o CDP según rol), para cada CDP obtiene meta propia, meta vigente, evangelizados del período actual y calcula la tasa; incluye `metaAsignadaPorMi: boolean`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 4. Backend: `MetaEvangelismoController` — endpoints REST
  - Implementar los 5 endpoints del controlador usando el servicio:
    - `GET /meta-evangelismo/cdp/:casaDePazId` → `getMetaCdp`
    - `GET /meta-evangelismo/jerarquia` → `getCdpsJerarquia` (guard de roles superiores)
    - `POST /meta-evangelismo/asignar` → `asignar` (guard de roles superiores)
    - `PATCH /meta-evangelismo/:id` → `update`
    - `DELETE /meta-evangelismo/:id` → `remove`
  - Aplicar guards JWT y de roles correspondientes
  - Aplicar `ParseIntPipe` en los parámetros numéricos
  - _Requirements: 2.1, 3.1, 4.1, 8.2, 10.5, 10.6, 11.1_

- [x] 5. Checkpoint — Verificar backend
  - Asegurarse de que todos los tests del backend pasan y que los endpoints responden correctamente. Consultar al usuario si hay dudas.

- [x] 6. Frontend: tipos y servicio `metaEvangelismoService`
  - [x] 6.1 Crear `frontend/src/types/meta-evangelismo.types.ts` con las interfaces `MetaAsignadaInfo` y `CdpConMeta` según el diseño
    - _Requirements: 4.4, 8.3_

  - [x] 6.2 Crear `frontend/src/services/meta-evangelismo.service.ts` con los métodos: `getMetaCdp`, `getJerarquia`, `asignar`, `update`, `remove`; usando la instancia `api` existente
    - _Requirements: 4.1, 8.1, 9.4_

- [x] 7. Frontend: utilidades de cálculo y formato de tasa
  - [x] 7.1 Crear `frontend/src/utils/tasa-evangelismo.ts` con las funciones puras `calcularTasa(evangelizados, metaEfectiva)` y `formatearTasa(tasa)`:
    - `calcularTasa`: retorna `parseFloat(((evangelizados / metaEfectiva) * 100).toFixed(2))` o `null` si `metaEfectiva` es null o 0
    - `formatearTasa`: retorna la cadena en formato `"XX.XX%"` sin truncar valores > 100%
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x]* 7.2 Escribir test de propiedad para `calcularTasa` — cálculo correcto de la tasa
    - **Property 8: Cálculo correcto de la Tasa de Evangelismo**
    - **Validates: Requirements 7.1, 7.2, 7.4**

  - [x]* 7.3 Escribir test de propiedad para `formatearTasa` — formato de la tasa
    - **Property 9: Formato de la Tasa de Evangelismo**
    - **Validates: Requirements 7.4, 7.5, 7.6**

- [x] 8. Frontend: componente `MetaAsignadaCard`
  - Crear `frontend/src/components/evangelismo/MetaAsignadaCard.tsx`
  - Props: `metaAsignada: MetaAsignadaInfo | null`
  - Si `metaAsignada` es null → mostrar "Sin meta asignada"
  - Si existe → mostrar el valor de la meta, nombre del asignador, su rol y el período `fechaInicio – fechaFin`
  - Sin controles de edición (siempre solo lectura)
  - Estilo visual consistente con las tarjetas KPI existentes (gradiente, sombra)
  - _Requirements: 6.2, 6.4, 6.5, 6.7_

- [x] 9. Frontend: actualizar `TasaEvangelismoCard`
  - Modificar `frontend/src/components/evangelismo/TasaEvangelismoCard.tsx` para aceptar las nuevas props: `evangelizados`, `metaEfectiva: number | null`, `fuenteMeta: 'asignada' | 'propia' | null`
  - Usar las funciones `calcularTasa` y `formatearTasa` de `utils/tasa-evangelismo.ts`
  - Mostrar "Sin meta" cuando `metaEfectiva` es null o 0
  - Mostrar indicador textual: "Usando meta asignada" o "Usando meta propia" según `fuenteMeta`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 10. Frontend: componente `AsignarMetaModal`
  - Crear `frontend/src/components/evangelismo/AsignarMetaModal.tsx`
  - Props: `casaDePazId`, `casaDePazCodigo`, `metaExistente?` (para modo edición), `onSuccess`, `onClose`
  - Campos del formulario: meta (input numérico, entero positivo), fecha_inicio (date picker), fecha_fin (date picker), observaciones (textarea opcional)
  - Validación inline: meta > 0, fecha_fin > fecha_inicio; botón de envío deshabilitado si hay errores
  - En modo edición: pre-poblar los campos con `metaExistente`
  - Al enviar: llamar `metaEvangelismoService.asignar` o `.update` según el modo; mostrar toast de éxito y llamar `onSuccess`; mostrar mensaje de error si el API retorna error
  - Botón cancelar limpia el estado y llama `onClose`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x]* 10.1 Escribir test de propiedad para la validación del formulario de asignación
    - **Property 10: Validación del formulario de asignación**
    - **Validates: Requirements 9.2, 9.3**

- [x] 11. Frontend: componente `GestionMetasView`
  - Crear `frontend/src/components/evangelismo/GestionMetasView.tsx`
  - Carga `GET /meta-evangelismo/jerarquia` al montar; muestra spinner durante la carga y mensaje de error con botón de reintento si falla
  - Muestra filtro por red (select con las redes disponibles en los datos)
  - Por cada CDP renderiza una fila con: código, red, meta vigente, meta propia, evangelizados del período, tasa de evangelismo
  - Si no hay meta vigente → botón "Asignar meta" que abre `AsignarMetaModal`
  - Si hay meta vigente asignada por el usuario actual (`metaAsignadaPorMi === true`) → botones "Editar" y "Eliminar"
  - Si hay meta vigente asignada por otro usuario → solo lectura (sin botones)
  - Al eliminar: confirmar con el usuario, llamar `metaEvangelismoService.remove`, recargar la lista
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 12. Frontend: actualizar `Evangelismo.tsx`
  - Agregar estado `metaAsignada: MetaAsignadaInfo | null` inicializado en `null`
  - Reemplazar `loadCasaDePaz` por `loadMetas`: llama a `metaEvangelismoService.getMetaCdp(casaDePazId)` y actualiza tanto `metaEvangelismo` (meta propia) como `metaAsignada`
  - Calcular `metaEfectiva = metaAsignada?.meta ?? metaEvangelismo` y `fuenteMeta = metaAsignada ? 'asignada' : metaEvangelismo ? 'propia' : null`
  - Detectar `isRolSuperior`: `roles?.some(r => ['PASTOR','LIDER_RED','SUBLIDER_RED','SUPERVISOR_VISION_ACCION'].includes(r))`
  - Si `isRolSuperior`: renderizar `<GestionMetasView />` en lugar de las tarjetas de meta
  - Si no es rol superior: renderizar las tres tarjetas KPI — `MetaEvangelismoCard` (meta propia, editable para LIDER_CDP), `MetaAsignadaCard` (solo lectura), `TasaEvangelismoCard` con las nuevas props
  - Mantener el gráfico de Timeline y el detalle por reunión sin cambios
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.7, 8.1, 11.3, 11.4_

- [x] 13. Checkpoint final — Verificar integración completa
  - Asegurarse de que todos los tests pasan (backend y frontend). Verificar que el endpoint existente `PATCH /casas-de-paz/:id/meta-evangelismo` sigue funcionando sin cambios. Consultar al usuario si hay dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los tests de propiedades usan `fast-check` con `numRuns: 100`
- Los tests unitarios y de propiedades son complementarios; no reemplazan la implementación
- El endpoint `PATCH /casas-de-paz/:id/meta-evangelismo` se preserva sin cambios (Requisito 11.1)
- El campo `meta_evangelismo` en `casa_de_paz` se preserva sin cambios (Requisito 11.2)
