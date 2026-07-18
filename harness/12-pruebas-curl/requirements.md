# Requisitos — Pruebas con curl

## Introducción

El arnés que verifica que Supabase hace lo que estas specs dicen. Se ejercita la API con curl puro, sin frontend: si una regla solo se cumple cuando la web la respeta, no se cumple.

Es el paso 4 del flujo del [README](../README.md#orden-de-trabajo), antes de tocar la IU.

## Glosario

- **Escenario**: Secuencia de llamadas que verifica un requisito.
- **JWT_Rol**: Token de un usuario con un cargo específico, usado para probar permisos.
- **Assert**: Comprobación de que una respuesta es la esperada.
- **Prueba_Negativa**: Escenario que verifica que una operación prohibida **falla**.
- **Fuga**: Caso donde un usuario accede a datos fuera de su alcance.

## Requisitos

### Requisito 1: Cobertura

**Historia:** Como owner, quiero saber que cada regla que documentamos de verdad funciona.

#### Criterios de aceptación

1. THE Arnes SHALL incluir al menos un Escenario por cada área del harness.
2. THE Arnes SHALL incluir una Prueba_Negativa por cada regla de permiso.
3. THE Arnes SHALL verificar toda transición de estado del Módulo 1.
4. THE Arnes SHALL verificar el aislamiento entre las dos Iglesias.
5. THE Arnes SHALL ejecutar las cuatro consultas de auditoría de [11-esquema-bd](../11-esquema-bd/requirements.md#requisito-3-completitud).

### Requisito 2: Ejecución

**Historia:** Como desarrollador, quiero correr todas las pruebas con un comando.

#### Criterios de aceptación

1. THE Arnes SHALL ejecutarse con un solo comando.
2. THE Arnes SHALL usar únicamente curl y utilidades de shell POSIX.
3. THE Arnes SHALL leer la configuración de variables de entorno.
4. THE Arnes SHALL NOT contener credenciales en el código.
5. THE Arnes SHALL devolver código de salida distinto de cero si algún Assert falla.
6. THE Arnes SHALL informar qué Escenario falló y qué esperaba.
7. THE Arnes SHALL ejecutarse contra una base con Datos_De_Prueba, y SHALL NOT ejecutarse contra producción.

### Requisito 3: Autenticación

**Historia:** Como probador, quiero un token por cada rol para verificar los permisos de verdad.

#### Criterios de aceptación

1. THE Arnes SHALL obtener un JWT_Rol por cada rol probado, vía Supabase Auth.
2. THE Arnes SHALL usar el token real de cada rol, y SHALL NOT usar el `SERVICE_ROLE_KEY` para probar permisos.
3. THE Arnes SHALL incluir tokens de: admin técnico, pastor, supervisor, líder de red, líder de CdP, sublíder de CdP e invitado.
4. THE Arnes SHALL incluir tokens de las dos Iglesias, para probar el aislamiento.
5. IF el `SERVICE_ROLE_KEY` se usa en una prueba de permisos, THEN THE Arnes SHALL considerar esa prueba inválida.

### Requisito 4: Aislamiento

**Historia:** Como pastor, quiero prueba de que un líder de Montero nunca verá datos de Santa Cruz.

#### Criterios de aceptación

1. THE Arnes SHALL verificar que un Usuario de una Iglesia recibe `[]` al pedir datos de otra.
2. THE Arnes SHALL verificar que la respuesta es una lista vacía y no un error, conforme al Requisito 4.4 de [01-tenancy](../01-tenancy-iglesias/requirements.md).
3. THE Arnes SHALL verificar que ninguna función `SECURITY DEFINER` permite una Fuga al pasarle un UUID de otra Iglesia.
4. THE Arnes SHALL verificar el aislamiento en toda tabla con `iglesia_id`.
5. IF alguna prueba de aislamiento falla, THEN THE Arnes SHALL considerar el sistema no apto para producción.

### Requisito 5: Reglas de negocio

**Historia:** Como owner, quiero ver que los criterios configurables mueven algo de verdad.

#### Criterios de aceptación

1. THE Arnes SHALL verificar la transición NC → CRE con 2 visitas consecutivas.
2. THE Arnes SHALL verificar que un menor de `EDAD_MINIMA_CREYENTE` no pasa a CRE.
3. THE Arnes SHALL verificar la transición a RE tras `DIAS_PARA_RE` sin asistir.
4. THE Arnes SHALL verificar que RE se evalúa antes que CRE.
5. THE Arnes SHALL verificar la creación automática de membresía por visitas.
6. THE Arnes SHALL verificar que la migración se propone y no se ejecuta.
7. THE Arnes SHALL verificar que cambiar un Criterio cambia el comportamiento siguiente.
8. THE Arnes SHALL verificar que cambiar un Criterio no recalcula el pasado.
9. THE Arnes SHALL verificar el cálculo de totales de asistencia.
10. THE Arnes SHALL verificar el conteo de familias.

### Requisito 6: Configuración

**Historia:** Como supervisor, quiero prueba de que apagar "el sublíder ve ofrendas" apaga de verdad.

#### Criterios de aceptación

1. THE Arnes SHALL verificar cada configuración booleana en sus dos estados.
2. THE Arnes SHALL verificar que la restricción actúa en la API y no solo en el frontend.
3. THE Arnes SHALL verificar que un valor fuera de rango se rechaza.
4. THE Arnes SHALL verificar que un valor de tipo incorrecto se rechaza.

### Requisito 7: Integridad

**Historia:** Como arquitecto, quiero prueba de que la base rechaza lo imposible.

#### Criterios de aceptación

1. THE Arnes SHALL verificar que `DELETE` está bloqueado en toda tabla de dominio.
2. THE Arnes SHALL verificar que el borrado lógico funciona y oculta la fila.
3. THE Arnes SHALL verificar que los campos de auditoría se llenan solos.
4. THE Arnes SHALL verificar que un `creado_por` enviado por el cliente se ignora.
5. THE Arnes SHALL verificar cada regla de unicidad con un intento de duplicado.
6. THE Arnes SHALL verificar cada `CHECK` con un valor inválido.
