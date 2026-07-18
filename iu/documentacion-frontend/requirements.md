# Requirements Document

## Introduction

Este documento especifica los requisitos para la **Documentación Técnica del Frontend de VisionHub**, redactada en estilo "Harness Engineer" (documentación de ingeniería precisa, accionable y estructurada). El alcance cubre **exclusivamente el frontend** de VisionHub; el backend queda **fuera de alcance** en su totalidad y no debe documentarse.

VisionHub es una aplicación de gestión para iglesias/casas de paz con módulos de evangelismo, calendario/eventos, gestión de sublíderes, dashboard, reportes y KPIs. El frontend está construido sobre React 18, TypeScript y Vite, con Tailwind CSS para estilos, React Router DOM v6 para routing, TanStack React Query v5 para estado de servidor, Zustand para estado global, React Hook Form + Zod para formularios y validación, y Axios como cliente HTTP.

El objetivo de la documentación es servir como **spec ejecutable**: cada documento markdown debe ser lo suficientemente concreto para que un ingeniero pueda entender, mantener y extender el frontend sin ambigüedad, describiendo arquitectura, componentes, patrones, convenciones, flujos de datos, manejo de estado, routing, formularios/validación, servicios/cliente API y estándares de testing.

## Glossary

- **Documentación_Frontend**: El conjunto de documentos markdown que describe el frontend de VisionHub. Es el "sistema" objeto de esta especificación.
- **Frontend_VisionHub**: La aplicación cliente ubicada en `frontend/src`, construida con React 18, TypeScript y Vite.
- **Backend**: La API y servicios de servidor de VisionHub, ubicados en `backend/`. Fuera de alcance de esta documentación.
- **Estilo_Harness_Engineer**: Convención de redacción técnica caracterizada por ser precisa, accionable, estructurada en secciones jerárquicas, con ejemplos de código reales del repositorio, tablas de referencia y ausencia de lenguaje vago.
- **Spec_Ejecutable**: Documento markdown estructurado de forma que sus afirmaciones sean verificables contra el código fuente real del frontend.
- **Documento_Arquitectura**: Documento que describe la estructura de carpetas, capas y dependencias del `Frontend_VisionHub`.
- **Documento_Componentes**: Documento que cataloga los componentes de React organizados por dominio (`ui`, `layout`, `shared`, `calendario`, `evangelismo`, `casas-de-paz`, `icons`).
- **Documento_Estado**: Documento que describe el manejo de estado global (Zustand) y de servidor (React Query).
- **Documento_Routing**: Documento que describe el enrutamiento con React Router DOM v6, incluyendo rutas, guards y control de acceso por rol.
- **Documento_Formularios**: Documento que describe el patrón de formularios con React Hook Form + Zod.
- **Documento_Servicios**: Documento que describe la capa de servicios HTTP y el cliente Axios.
- **Documento_Testing**: Documento que describe los estándares de pruebas con Vitest, Testing Library y fast-check.
- **Documento_Convenciones**: Documento que describe convenciones de código, nomenclatura, tipos e idioma.
- **Store_Zustand**: Un almacén de estado global creado con `create` de Zustand, ubicado en `frontend/src/store`.
- **Servicio_HTTP**: Un módulo en `frontend/src/services` que encapsula llamadas a la API mediante el cliente Axios compartido.
- **Cliente_API**: La instancia de Axios configurada en `frontend/src/services/api.ts`, con interceptores de request y response.
- **Hook_Dominio**: Un hook de React en `frontend/src/hooks` que envuelve React Query para un dominio (por ejemplo `useCalendario`).
- **Rol_Usuario**: Rol de autorización del usuario; los valores conocidos son `LIDER_CDP` y `SUBLIDER_CDP`.
- **Prueba_Basada_En_Propiedades**: Prueba escrita con fast-check que verifica una propiedad sobre un rango de entradas generadas.

## Requirements

### Requirement 1: Alcance exclusivo de frontend

**User Story:** Como ingeniero de VisionHub, quiero que la documentación cubra únicamente el frontend, para evitar confusión con el backend y mantener el alcance acotado.

#### Acceptance Criteria

1. THE Documentación_Frontend SHALL describir únicamente artefactos (archivos de código fuente, componentes, módulos y archivos de configuración) cuya ruta comience con `frontend/`.
2. IF un artefacto tiene una ruta que no comienza con `frontend/`, THEN THE Documentación_Frontend SHALL excluir ese artefacto de su contenido.
3. WHERE una descripción del frontend requiera mencionar la existencia del Backend, THE Documentación_Frontend SHALL limitarse a referenciar las rutas HTTP consumidas y las formas de datos de peticiones y respuestas, excluyendo la lógica interna, la estructura de código y los componentes de implementación del Backend.
4. IF una sección describe la implementación de un artefacto ubicado fuera de `frontend/`, THEN THE Documentación_Frontend SHALL considerar esa sección fuera de alcance y removerla.
5. THE Documentación_Frontend SHALL redactar el 100% de su contenido textual en idioma español.

### Requirement 2: Estilo Harness Engineer y formato de spec ejecutable

**User Story:** Como ingeniero, quiero que cada documento siga el estilo Harness Engineer y sea un spec ejecutable, para poder actuar sobre la documentación sin ambigüedad.

#### Acceptance Criteria

1. THE Documentación_Frontend SHALL organizar cada documento con encabezados Markdown que comiencen en nivel H1 para el título único del documento, sin omitir niveles intermedios (la secuencia debe ser H1→H2→H3) y con una profundidad máxima de 4 niveles (H4).
2. WHERE un documento describe un patrón de código, THE Documentación_Frontend SHALL incluir al menos un bloque de código delimitado con triple backtick cuyo contenido coincida textualmente con código existente en el Frontend_VisionHub y vaya acompañado de la ruta relativa del archivo de origen.
3. THE Documentación_Frontend SHALL referenciar cada archivo mediante su ruta relativa a la raíz del repositorio, expresada sin barra inicial y correspondiente a un archivo que exista en el repositorio.
4. IF un documento incluye una afirmación sobre el comportamiento del Frontend_VisionHub, THEN THE Documentación_Frontend SHALL acompañar esa afirmación de una referencia a la ruta relativa del archivo y al identificador del símbolo (función, componente, hook o constante) que la respalda en el código fuente.
5. THE Documentación_Frontend SHALL redactar su contenido técnico sin calificadores subjetivos (por ejemplo "rápido", "adecuado", "amigable", "eficiente" o "intuitivo"), sustituyéndolos por valores medibles, límites numéricos o criterios verificables contra el código fuente.
6. IF una ruta de archivo referenciada no corresponde a un archivo existente en el repositorio, THEN THE Documentación_Frontend SHALL marcarse como inválida hasta que la referencia se corrija o se elimine.
7. IF un bloque de código de ejemplo no coincide textualmente con el código presente en la ruta de origen citada, THEN THE Documentación_Frontend SHALL marcarse como desactualizada hasta que el ejemplo se sincronice con el código fuente.

### Requirement 3: Documento de arquitectura

**User Story:** Como ingeniero nuevo en el proyecto, quiero un documento de arquitectura, para entender la estructura y las capas del frontend antes de modificarlo.

#### Acceptance Criteria

1. THE Documento_Arquitectura SHALL enumerar exactamente los ocho directorios de primer nivel de `frontend/src`: `components`, `hooks`, `pages`, `services`, `store`, `test`, `types` y `utils`.
2. THE Documento_Arquitectura SHALL describir, para cada uno de los ocho directorios de primer nivel de `frontend/src`, el tipo de artefactos que contiene.
3. IF el conjunto de directorios documentado difiere del contenido real de `frontend/src`, THEN THE Documento_Arquitectura SHALL considerarse desactualizado hasta que se sincronice con la estructura del repositorio.
4. THE Documento_Arquitectura SHALL documentar el stack tecnológico declarado en `frontend/package.json`, indicando el nombre y la versión declarada de React, TypeScript, Vite, Tailwind CSS, React Router DOM, TanStack React Query, Zustand, React Hook Form, Zod y Axios.
5. THE Documento_Arquitectura SHALL describir el punto de entrada de la aplicación en `frontend/src/main.tsx` y el componente raíz en `frontend/src/App.tsx`.
6. THE Documento_Arquitectura SHALL describir la dirección permitida del flujo de dependencias `pages → components → hooks → services → store`, e indicar explícitamente que el sentido inverso no está permitido.

### Requirement 4: Documento de componentes

**User Story:** Como ingeniero, quiero un catálogo de componentes por dominio, para localizar y reutilizar componentes existentes.

#### Acceptance Criteria

1. THE Documento_Componentes SHALL agrupar los componentes en exactamente siete secciones correspondientes a los subdirectorios de `frontend/src/components`: `ui`, `layout`, `shared`, `calendario`, `evangelismo`, `casas-de-paz` e `icons`, y SHALL listar cada archivo de componente (`.tsx`) bajo una única sección indicando su nombre y su ruta relativa dentro de `frontend/src/components`.
2. IF un archivo de un subdirectorio es un archivo de prueba (nombre terminado en `.test.tsx`), THEN THE Documento_Componentes SHALL excluirlo del catálogo de componentes.
3. THE Documento_Componentes SHALL describir cada uno de los ocho componentes base de `frontend/src/components/ui` (`button`, `card`, `checkbox`, `input`, `label`, `modal`, `select` y `textarea`), incluyendo para cada uno su nombre, su ruta relativa y su propósito en una o más frases.
4. WHERE un componente expone props, THE Documento_Componentes SHALL documentar, para cada prop, su nombre, su tipo y si es obligatoria u opcional.
5. THE Documento_Componentes SHALL documentar que los componentes del `Frontend_VisionHub` se exponen mediante exportación nombrada (named export), indicando el nombre exportado de cada componente.
6. WHERE un dominio expone un archivo `index.ts` de barril, THE Documento_Componentes SHALL documentar el nombre de cada símbolo re-exportado por ese archivo.

### Requirement 5: Documento de manejo de estado

**User Story:** Como ingeniero, quiero entender cómo se separa el estado global del estado de servidor, para modificar el estado sin introducir inconsistencias.

#### Acceptance Criteria

1. THE Documento_Estado SHALL enumerar exactamente los cuatro stores de Zustand ubicados en `frontend/src/store` (`auth.store`, `casa-de-paz.store`, `periodo.store` y `ui.store`), indicando para cada uno el hook exportado y su responsabilidad.
2. THE Documento_Estado SHALL describir el patrón de creación de un Store_Zustand mediante `create`, e indicar que el middleware `persist` se aplica únicamente a los stores persistidos, identificando `auth.store` como store persistido.
3. THE Documento_Estado SHALL documentar la clave de persistencia `visionhub-auth` y los campos persistidos declarados en `partialize` del `auth.store`: `user`, `accessToken`, `refreshToken`, `casaDePazId` e `isAuthenticated`.
4. THE Documento_Estado SHALL describir el uso de TanStack React Query para el estado de servidor, incluyendo la configuración de `QueryClient` en `frontend/src/App.tsx` con `retry: 1` y `refetchOnWindowFocus: false`.
5. THE Documento_Estado SHALL documentar la convención de query keys del objeto `calendarioKeys` en `frontend/src/hooks/useCalendario.ts`, enumerando sus claves `all`, `tiposEvento`, `eventos`, `eventosMensual` y `eventosSemanales`.
6. WHEN una mutación de React Query finaliza con éxito, THE Documento_Estado SHALL describir la invalidación de queries mediante `queryClient.invalidateQueries` con la query key correspondiente como mecanismo de refresco de datos.
7. THE Documento_Estado SHALL documentar los valores concretos de `staleTime` presentes en los Hook_Dominio (1 hora para datos de baja volatilidad y 5 minutos para datos de mayor volatilidad).

### Requirement 6: Documento de routing y control de acceso

**User Story:** Como ingeniero, quiero entender el routing y los guards por rol, para agregar o proteger rutas correctamente.

#### Acceptance Criteria

1. THE Documento_Routing SHALL enumerar las rutas definidas en el objeto `ROUTES` de `frontend/src/utils/constants.ts`, indicando para cada entrada su clave, su path y el componente que renderiza.
2. THE Documento_Routing SHALL describir el componente `PrivateRoute` de `frontend/src/App.tsx` como guard de autenticación que restringe el acceso a rutas cuando el usuario no está autenticado.
3. THE Documento_Routing SHALL describir el componente `RoleGuard` de `frontend/src/App.tsx` especificando el mapeo exacto ruta→rol autorizado: rutas exclusivas de `LIDER_CDP` (DASHBOARD, SUBLIDERES, EVANGELISMO, ASISTENCIAS) y rutas autorizadas para ambos roles (NUEVO_REPORTE, PERSONAS, CALENDARIO).
4. WHEN un usuario no autenticado solicita una ruta protegida, THE Documento_Routing SHALL describir la redirección hacia la ruta `LOGIN` mediante reemplazo de historial (`replace`).
5. IF el usuario tiene el campo `requiereCambioPassword` en verdadero, THEN THE Documento_Routing SHALL describir la redirección hacia `/cambiar-password` mediante reemplazo de historial (`replace`).
6. THE Documento_Routing SHALL describir el comportamiento del componente `DefaultRoute`, indicando que redirige a `SUBLIDER_CDP` hacia la ruta `NUEVO_REPORTE` y a `LIDER_CDP` hacia el Dashboard.
7. WHEN `RoleGuard` deniega el acceso por rol no autorizado, THE Documento_Routing SHALL describir la ruta de redirección de respaldo aplicada.
8. IF el usuario no tiene un rol reconocido, THEN THE Documento_Routing SHALL describir el fallback de redirección hacia la ruta `LOGIN`.

### Requirement 7: Documento de formularios y validación

**User Story:** Como ingeniero, quiero el patrón estándar de formularios, para construir formularios consistentes con validación tipada.

#### Acceptance Criteria

1. THE Documento_Formularios SHALL describir el uso de `useForm` de React Hook Form junto con `zodResolver` de `@hookform/resolvers/zod`, incluyendo un ejemplo de código que muestre `useForm` tipado con `resolver: zodResolver(esquema)`.
2. THE Documento_Formularios SHALL describir la definición de un esquema Zod y la derivación del tipo del formulario mediante `z.infer`, incluyendo un ejemplo de código.
3. THE Documento_Formularios SHALL usar `frontend/src/components/calendario/EventoForm.tsx` como ejemplo de referencia, citando al menos el esquema Zod y la invocación de `useForm` de ese archivo.
4. WHEN un campo del formulario incumple su regla de validación Zod, THE Documento_Formularios SHALL describir la obtención del mensaje de error desde `formState.errors.<campo>.message` y su renderizado en un elemento adyacente al campo.
5. THE Documento_Formularios SHALL documentar el patrón de validación entre campos mediante `refine`, mostrando el uso de la propiedad `path` para asociar el error al campo correspondiente, según los `refine` de `fechaFin` y `horaFin` en `EventoForm.tsx`.
6. WHEN el usuario envía el formulario, THE Documento_Formularios SHALL describir el uso de `handleSubmit` para invocar la función `onSubmit` únicamente cuando la validación es exitosa.
7. THE Documento_Formularios SHALL documentar la configuración de `defaultValues` para diferenciar el modo de creación del modo de edición.

### Requirement 8: Documento de servicios y cliente API

**User Story:** Como ingeniero, quiero entender la capa de servicios y el cliente Axios, para consumir endpoints del backend de forma consistente.

#### Acceptance Criteria

1. THE Documento_Servicios SHALL enumerar los Servicio_HTTP ubicados en `frontend/src/services` (`auth`, `calendario`, `casas-de-paz`, `dashboard`, `evangelismo`, `evangelismo-cdp`, `meta-evangelismo`, `notificaciones`, `personas`, `solicitudes-ssva` y `sublideres`), indicando para cada archivo su nombre y su responsabilidad.
2. THE Documento_Servicios SHALL describir la instancia `Cliente_API` de Axios definida en `frontend/src/services/api.ts`, incluyendo `baseURL` derivado de `API_BASE_URL` y el encabezado por defecto `Content-Type: application/json`.
3. THE Documento_Servicios SHALL describir el interceptor de request que adjunta el encabezado `Authorization` con el formato `Bearer <accessToken>` obtenido del `auth.store`, únicamente cuando existe un token.
4. WHEN una respuesta HTTP retorna estado 401 y la petición no ha sido reintentada, THE Documento_Servicios SHALL describir la secuencia de refresco de token: marcar la petición con `_retry`, obtener el `refreshToken` del store, invocar el endpoint `/auth/refresh`, actualizar los tokens y reintentar la petición original con el nuevo token.
5. IF el refresco de token falla o no existe `refreshToken`, THEN THE Documento_Servicios SHALL describir la notificación de sesión expirada, el cierre de sesión mediante `logout` y la redirección a la ruta `ROUTES.LOGIN`.
6. THE Documento_Servicios SHALL documentar la convención de mapeo de errores HTTP a mensajes en español mediante la función `getErrorMessage`, indicando la precedencia del mensaje del backend sobre el mensaje por defecto y los códigos mapeados (400, 401, 403, 404, 409, 422, 500, 502, 503 y default).
7. THE Documento_Servicios SHALL documentar la lógica de supresión de notificaciones (`shouldShowToast`) para respuestas 401 y para URLs marcadas como `silent`.

### Requirement 9: Documento de convenciones de código

**User Story:** Como ingeniero, quiero convenciones de código explícitas, para que el código nuevo sea consistente con el existente.

#### Acceptance Criteria

1. THE Documento_Convenciones SHALL documentar el uso de tipos e interfaces de TypeScript definidos en `frontend/src/types`, indicando su ubicación, la convención de nomenclatura de archivos (`*.types.ts`) y al menos un ejemplo de código conforme.
2. THE Documento_Convenciones SHALL documentar la utilidad `cn` de `frontend/src/utils/cn.ts` como el único mecanismo estándar para componer clases de Tailwind mediante `clsx` y `tailwind-merge`, incluyendo un ejemplo de importación y uso.
3. THE Documento_Convenciones SHALL documentar la convención de idioma español para nombres de dominio, comentarios y mensajes al usuario, incluyendo un ejemplo conforme y un ejemplo no conforme por cada categoría.
4. THE Documento_Convenciones SHALL documentar que los valores de configuración en tiempo de build se leen exclusivamente mediante `import.meta.env`, incluyendo un ejemplo de lectura de la variable `VITE_API_URL`.
5. THE Documento_Convenciones SHALL documentar las utilidades de dominio de `frontend/src/utils` (`format`, `error-handler`, `toast`, `constants` y `tasa-evangelismo`), indicando para cada una su responsabilidad y cuándo usarla.
6. THE Documento_Convenciones SHALL presentar todos sus ejemplos en bloques de código delimitados con triple backtick e identificando el lenguaje.

### Requirement 10: Documento de estándares de testing

**User Story:** Como ingeniero, quiero estándares de testing claros, para escribir pruebas que se integren con la configuración existente.

#### Acceptance Criteria

1. THE Documento_Testing SHALL incluir una sección que documente Vitest como ejecutor de pruebas, incluyendo el comando exacto de ejecución de la suite completa (`npm test`) y la presencia de la bandera `--run` en el script `test` declarado en `frontend/package.json`.
2. THE Documento_Testing SHALL incluir una sección que documente `@testing-library/react` y `@testing-library/jest-dom`, indicando la ruta del archivo de configuración global `frontend/src/test/setup.ts` y su propósito declarado (registro de matchers de jest-dom y limpieza del DOM entre pruebas).
3. THE Documento_Testing SHALL incluir una sección que documente fast-check para Prueba_Basada_En_Propiedades, referenciando `frontend/src/utils/__tests__/tasa-evangelismo.property.test.ts` como ejemplo e incluyendo al menos un fragmento de código que muestre la definición de una propiedad.
4. THE Documento_Testing SHALL documentar la convención de nomenclatura de archivos de prueba, incluyendo al menos un ejemplo de cada patrón: `*.test.tsx` para pruebas de componentes y unitarias, y `*.property.test.ts` para Prueba_Basada_En_Propiedades.
5. WHERE una función es una transformación pura de datos (sin efectos secundarios ni dependencias externas), THE Documento_Testing SHALL recomendar una Prueba_Basada_En_Propiedades que verifique al menos un invariante sobre entradas generadas por fast-check.
6. IF una función tiene efectos secundarios o dependencias externas (no es una transformación pura), THEN THE Documento_Testing SHALL recomendar pruebas basadas en ejemplos con `@testing-library/react` en lugar de Prueba_Basada_En_Propiedades.
7. WHEN el documento referencia un archivo de ejemplo o de configuración, THE Documento_Testing SHALL usar una ruta relativa a la raíz del repositorio que corresponda a un archivo existente en el mismo.

### Requirement 11: Documento de flujos de datos por módulo

**User Story:** Como ingeniero, quiero entender el flujo de datos de los módulos principales, para rastrear cómo viaja la información desde la UI hasta la API.

#### Acceptance Criteria

1. THE Documentación_Frontend SHALL describir el flujo de datos del módulo de calendario/eventos enumerando las capas ordenadas desde la página `frontend/src/pages/Calendario.tsx` hasta el `calendario.service`, indicando la dirección de invocación entre capas consecutivas.
2. THE Documentación_Frontend SHALL describir el flujo de datos del módulo de evangelismo desde la página `frontend/src/pages/Evangelismo.tsx` hasta cada Servicio_HTTP asociado ubicado en `frontend/src/services`, indicando la dirección de invocación entre capas consecutivas.
3. THE Documentación_Frontend SHALL describir el flujo de datos del dashboard y los KPIs desde `frontend/src/pages/Dashboard.tsx` hasta `dashboard.service`, indicando la dirección de invocación entre capas consecutivas.
4. WHERE un módulo consume un Hook_Dominio, THE Documentación_Frontend SHALL describir el Servicio_HTTP invocado, los datos obtenidos, el Store_Zustand leído o actualizado, e indicar si la operación es de lectura o de escritura.
5. THE Documentación_Frontend SHALL describir, para al menos un módulo representativo, tanto la secuencia de ida UI → Hook_Dominio → Servicio_HTTP → Cliente_API como la secuencia de retorno de la respuesta hacia la UI.
6. IF la petición de un módulo falla, THEN THE Documentación_Frontend SHALL describir la propagación del error en el sentido Cliente_API → Servicio_HTTP → Hook_Dominio → UI.
