# Requisitos — Esquema de Base de Datos

## Introducción

El esquema completo del Módulo 1, consolidado. Es lo que hay que revisar y aprobar **antes** de tocar Supabase.

Este documento no repite las reglas de negocio de las otras áreas: define cómo se organiza, se aplica y se verifica el esquema como un todo.

## Glosario

- **Migracion**: Archivo SQL versionado que lleva el esquema de un estado al siguiente.
- **Semilla**: Datos de catálogo y configuración necesarios para que el sistema funcione.
- **Datos_De_Prueba**: Datos ficticios para verificar el sistema. Nunca en producción.
- **Orden_De_Aplicacion**: Secuencia en que las migraciones se aplican, dictada por las dependencias.

## Requisitos

### Requisito 1: Organización

**Historia:** Como desarrollador, quiero aplicar el esquema completo en una base vacía con un solo comando.

#### Criterios de aceptación

1. THE Sistema SHALL organizar el esquema en Migraciones numeradas y ordenadas.
2. THE Sistema SHALL nombrar cada Migracion con un prefijo numérico y un nombre descriptivo en español.
3. THE Sistema SHALL permitir aplicar todas las Migraciones sobre una base vacía sin errores.
4. THE Sistema SHALL permitir aplicar todas las Migraciones dos veces sin errores, mediante `IF NOT EXISTS` y `CREATE OR REPLACE`.
5. THE Sistema SHALL separar las Migraciones de esquema de las de Semilla.
6. THE Sistema SHALL separar los Datos_De_Prueba de las Semilla.
7. IF una Migracion falla a la mitad, THEN THE Sistema SHALL revertir la Migracion completa.

### Requisito 2: Orden

**Historia:** Como desarrollador, quiero que el orden de aplicación sea explícito y no adivinado.

#### Criterios de aceptación

1. THE Sistema SHALL aplicar las extensiones antes que cualquier objeto que las use.
2. THE Sistema SHALL aplicar los tipos enumerados antes que las tablas que los usan.
3. THE Sistema SHALL aplicar las tablas antes que las funciones que las consultan.
4. THE Sistema SHALL aplicar las funciones de acceso antes que las políticas que las invocan.
5. THE Sistema SHALL aplicar el motor de configuración antes que los disparadores que leen criterios.
6. WHERE dos tablas se referencian mutuamente, THE Sistema SHALL crearlas en la misma Migracion o agregar la clave foránea con `ALTER TABLE`.

### Requisito 3: Completitud

**Historia:** Como pastor, quiero que ninguna tabla quede sin protección por olvido.

#### Criterios de aceptación

1. THE Sistema SHALL habilitar RLS en el 100% de las tablas del esquema `public`.
2. THE Sistema SHALL aplicar los seis campos de auditoría al 100% de las tablas de dominio.
3. THE Sistema SHALL aplicar el disparador de auditoría al 100% de las tablas de dominio.
4. THE Sistema SHALL aplicar el bloqueo de `DELETE` al 100% de las tablas de dominio.
5. THE Sistema SHALL exponer una consulta de auditoría que liste las tablas sin RLS.
6. THE Sistema SHALL exponer una consulta de auditoría que liste las tablas sin campos de auditoría.
7. THE Sistema SHALL exponer una consulta de auditoría que liste las funciones `SECURITY DEFINER` sin `search_path` fijo.
8. THE Sistema SHALL exigir que las tres consultas de auditoría devuelvan cero filas.

### Requisito 4: Semillas

**Historia:** Como supervisor, quiero que el sistema arranque con los catálogos de mi iglesia listos.

#### Criterios de aceptación

1. THE Sistema SHALL sembrar los catálogos globales: cargos, estados, tipos de relación, tipos de teléfono, motivos de llegada, libros, tipos de evento, tipos de ingreso.
2. THE Sistema SHALL sembrar las definiciones de configuración.
3. THE Sistema SHALL sembrar por cada Iglesia: los 14 ministerios, los 4 departamentos y los temas de CdP.
4. THE Sistema SHALL permitir ejecutar las Semilla más de una vez sin duplicar filas.
5. THE Sistema SHALL sembrar la Cobertura y las dos Iglesias del despliegue inicial.
6. THE Sistema SHALL NOT sembrar la Iglesia de Cochabamba.

### Requisito 5: Índices

**Historia:** Como usuario, quiero que los dashboards carguen rápido.

#### Criterios de aceptación

1. THE Sistema SHALL indexar toda columna `iglesia_id` usada por RLS.
2. THE Sistema SHALL indexar toda clave foránea usada en JOIN de dashboards.
3. THE Sistema SHALL usar índices parciales con `WHERE fecha_eliminacion IS NULL` donde la consulta siempre filtra por vigencia.
4. THE Sistema SHALL implementar toda regla de unicidad condicional con índice único parcial, y SHALL NOT usar disparador cuando el índice alcanza.
5. IF una regla de unicidad requiere consultar otra tabla, THEN THE Sistema SHALL implementarla con disparador, porque el predicado de un índice parcial debe ser inmutable.

### Requisito 6: Reversibilidad

**Historia:** Como desarrollador, quiero poder volver atrás si algo sale mal.

#### Criterios de aceptación

1. THE Sistema SHALL documentar cómo revertir cada Migracion.
2. THE Sistema SHALL permitir borrar y recrear el esquema completo mientras no haya datos reales.
3. WHERE existen datos reales, THE Sistema SHALL exigir respaldo antes de aplicar una Migracion.

### Requisito 7: Aprobación

**Historia:** Como owner, quiero revisar el modelo antes de que se cree nada.

#### Criterios de aceptación

1. THE Sistema SHALL presentar el esquema completo al owner antes de aplicarlo en Supabase.
2. THE Sistema SHALL listar las decisiones de modelado que requieren confirmación.
3. THE Sistema SHALL NOT aplicar el esquema en Supabase antes de la aprobación del owner.
