# Requisitos — Registro Público por URL de Líder

## Introducción

`nuevos_requisitos.txt` (2026-07-18) pide que una persona nueva pueda registrarse sola, sin usuario ni contraseña, entrando al enlace de su líder de Casa de Paz. Este documento cierra el diseño de esa modalidad.

Es la primera vez que el sistema deja escribir a alguien sin sesión de Supabase Auth. Choca de frente con `01-tenancy-iglesias` Requisito 4.6 ("revocar todo acceso del rol `anon` a los datos de negocio"): la solución no relaja esa regla, la rodea con una función acotada. Ver [design.md](design.md).

**Modalidad 2 (Afirmación)** descrita en `nuevos_requisitos.txt` es explícitamente futura — depende del Departamento de Afirmación, fuera de alcance del Módulo 1 (`harness/README.md`). Este documento solo cierra la Modalidad 1 (URL de líder) y deja el interruptor listo para cuando la Modalidad 2 exista.

## Glosario

- **CasaPazURL**: Enlace público único que identifica a un Líder de CdP y a la Casa_De_Paz que lidera en el momento en que el enlace se crea.
- **Slug**: Segmento de texto de la URL (`nombre-del-lider`), único en todo el sistema, derivado del Nombre_Completo del líder.
- **Estado_URL**: `ACTIVO`, `INACTIVO` o `SUSPENDIDO`. Solo `ACTIVO` acepta registros.
- **Registro_Anonimo**: Envío del formulario de membresía hecho sin sesión de Supabase Auth, a través de una CasaPazURL activa.
- **Modalidad_Registro**: Interruptor por Iglesia (`REGISTRO_URL_ACTIVO`) que habilita o deshabilita el Registro_Anonimo para toda la Iglesia, independientemente del Estado_URL de cada líder.

## Requisitos

### Requisito 1: Creación automática de la URL

**Historia:** Como sistema, quiero generar el enlace del líder en el momento en que alguien se convierte en líder de una Casa de Paz, para que el Supervisor no tenga que crearlo a mano.

#### Criterios de aceptación

1. WHEN se registra una fila de `casa_de_paz_cargo` con `cargo = LIDER_CDP` y `fecha_fin IS NULL`, THE Sistema SHALL crear automáticamente una CasaPazURL para esa Persona y esa Casa_De_Paz.
2. THE Sistema SHALL fijar la Casa_De_Paz de la CasaPazURL en el momento de creación, y SHALL NOT recalcularla si el líder pasa a liderar otra Casa_De_Paz.
3. WHERE la misma Persona lidera más de una Casa_De_Paz a la vez, THE Sistema SHALL crear una CasaPazURL distinta por cada una.
4. THE Sistema SHALL derivar el Slug del Nombre_Completo del líder al momento de creación, normalizado a minúsculas, sin tildes ni caracteres especiales, con palabras separadas por guiones.
5. IF el Slug derivado ya existe, THEN THE Sistema SHALL agregar un sufijo numérico incremental (`-2`, `-3`, ...) hasta obtener uno único.
6. THE Sistema SHALL exigir que el Slug sea único en todo el sistema, sin distinguir entre Iglesias.
7. THE Sistema SHALL crear toda CasaPazURL nueva con `estado = INACTIVO`.
8. THE Sistema SHALL NOT permitir que el Slug se modifique después de creado.

### Requisito 2: Administración por el Supervisor

**Historia:** Como Supervisor de la Visión en Acción, quiero activar, desactivar o suspender el enlace de cada líder, para controlar quién puede recibir registros en cada momento.

#### Criterios de aceptación

1. THE Sistema SHALL permitir cambiar el Estado_URL únicamente a un Usuario para el que `fn_es_operativo_en(iglesia_id)` sea verdadero (Pastor o Supervisor de esa Iglesia).
2. IF un Usuario sin ese permiso intenta cambiar el Estado_URL, THEN THE Sistema SHALL rechazar la operación.
3. THE Sistema SHALL aplicar la restricción del Criterio 1 en la base de datos, mediante RLS.
4. THE Sistema SHALL registrar `fecha_activacion` la primera vez que el Estado_URL pasa a `ACTIVO`.
5. THE Sistema SHALL registrar `fecha_desactivacion` cada vez que el Estado_URL deja de ser `ACTIVO`.
6. THE Sistema SHALL exponer, para cada CasaPazURL de su Iglesia, el líder, la Casa_De_Paz, el Slug completo y el Estado_URL, para que el Supervisor decida.
7. THE Sistema SHALL permitir al Supervisor volver a activar una CasaPazURL `INACTIVO` o `SUSPENDIDO`, sin generar un Slug nuevo.

### Requisito 3: Baja automática al cambiar de líder

**Historia:** Como pastor, quiero que un enlace deje de funcionar apenas la persona ya no es líder de esa Casa de Paz, para que nadie se siga registrando bajo un nombre que ya no lidera nada.

#### Criterios de aceptación

1. WHEN se cierra con `fecha_fin` la fila de `casa_de_paz_cargo` de un `LIDER_CDP`, THE Sistema SHALL cambiar automáticamente el Estado_URL de la CasaPazURL correspondiente a `INACTIVO`.
2. THE Sistema SHALL registrar `fecha_desactivacion` en ese cambio automático.
3. WHERE se asigna un nuevo Líder de CdP a esa misma Casa_De_Paz, THE Sistema SHALL crear una CasaPazURL nueva para el nuevo líder, según el Requisito 1.
4. THE Sistema SHALL conservar la CasaPazURL del líder anterior con su historial, y SHALL NOT reasignarla al nuevo líder.

### Requisito 4: Modalidad de registro por Iglesia

**Historia:** Como Supervisor, quiero un interruptor único que apague todos los enlaces de mi Iglesia a la vez, sin tener que desactivarlos uno por uno.

#### Criterios de aceptación

1. THE Sistema SHALL exponer `REGISTRO_URL_ACTIVO` como Configuracion booleana por Iglesia, en el motor de [10-panel-supervisor](../10-panel-supervisor/requirements.md#requisito-2-motor-de-configuración).
2. THE Sistema SHALL definir el valor por defecto de `REGISTRO_URL_ACTIVO` en `false`, para que una Iglesia nueva no exponga formularios públicos sin que el Supervisor lo decida.
3. IF `REGISTRO_URL_ACTIVO` es `false` en la Iglesia de una CasaPazURL, THEN THE Sistema SHALL rechazar todo Registro_Anonimo a través de ella, sin importar su Estado_URL.
4. THE Sistema SHALL evaluar `REGISTRO_URL_ACTIVO` en el servidor en cada Registro_Anonimo, y SHALL NOT confiar en que el frontend oculte el formulario.
5. THE Sistema SHALL permitir que el Supervisor cambie `REGISTRO_URL_ACTIVO` desde el panel, con el mismo mecanismo que las demás Configuracion.

### Requisito 5: Acceso anónimo al formulario

**Historia:** Como persona nueva, quiero abrir el enlace de mi líder y llenar el formulario sin que me pidan usuario ni contraseña.

#### Criterios de aceptación

1. THE Sistema SHALL exponer una función de lectura pública que, dado un Slug, devuelva el Nombre_Completo del líder, el nombre de la Casa_De_Paz y si el enlace admite registro (Estado_URL = `ACTIVO` y `REGISTRO_URL_ACTIVO` = `true`).
2. IF el Slug no existe o no admite registro, THEN THE Sistema SHALL devolver un resultado que el frontend interprete como "enlace no disponible", sin distinguir entre "no existe", "inactivo" o "suspendido".
3. THE Sistema SHALL NOT exponer en esa función ningún dato de la Persona del líder más allá de su Nombre_Completo, ni ningún identificador interno (`persona_id`, `casa_de_paz_id`, `iglesia_id`).
4. THE Sistema SHALL preseleccionar y bloquear el campo de líder/Casa de Paz en el formulario, de modo que la persona no pueda elegir un líder distinto al de la URL.
5. THE Sistema SHALL usar el mismo formulario digital de membresía que usa un líder autenticado, con la diferencia de que el líder y la Casa de Paz llegan fijos por la URL en vez de elegidos a mano.
6. THE Sistema SHALL aplicar a este formulario público los mismos Campo_Configurable de `FORMULARIO_MEMBRESIA` que a los formularios autenticados ([10-panel-supervisor](../10-panel-supervisor/requirements.md#requisito-6-formularios-configurables)).

### Requisito 6: Registro anónimo

**Historia:** Como persona nueva, quiero que al enviar el formulario quede registrado en el sistema y asociado a la Casa de Paz de mi líder, sin pasos adicionales.

#### Criterios de aceptación

1. THE Sistema SHALL exponer una única función de escritura pública que reciba el Slug y los datos del formulario, y SHALL rechazar cualquier otro camino de escritura para el rol `anon`.
2. WHEN el Registro_Anonimo se acepta, THE Sistema SHALL crear la Persona en la Iglesia de la Casa_De_Paz de la CasaPazURL, con los mismos campos y las mismas validaciones que el registro hecho por un líder autenticado (`02-persona-parentela`).
3. WHEN el Registro_Anonimo se acepta, THE Sistema SHALL crear la Persona_Llegada de esa Persona con `motivo_llegada = INVITACION_PERSONAL` e `invitado_por_id` igual a la Persona del líder de la CasaPazURL.
4. WHEN el Registro_Anonimo se acepta, THE Sistema SHALL crear la Casa_De_Paz_Membresia de esa Persona con `es_principal = true` y la Casa_De_Paz fijada por la CasaPazURL, en la misma transacción que la creación de la Persona.
5. IF la CasaPazURL no admite registro según el Requisito 4 o 5, THEN THE Sistema SHALL rechazar la operación sin crear ninguna fila.
6. THE Sistema SHALL ignorar cualquier `iglesia_id`, `casa_de_paz_id` o rol enviado por el cliente en un Registro_Anonimo, y SHALL derivarlos únicamente de la CasaPazURL resuelta en el servidor.
7. THE Sistema SHALL devolver, al aceptar un Registro_Anonimo, únicamente una confirmación con el Nombre_Completo registrado y el nombre de la Casa_De_Paz, sin exponer el `id` de la Persona ni ningún otro identificador interno.
8. THE Sistema SHALL registrar la CasaPazURL usada en cada Persona registrada por esta vía, para poder auditar cuántas Personas entraron por cada enlace.

### Requisito 7: Seguridad del acceso anónimo

**Historia:** Como arquitecto, quiero que abrir la puerta al registro anónimo no abra ninguna otra puerta.

#### Criterios de aceptación

1. THE Sistema SHALL implementar el Requisito 6 mediante una única función `SECURITY DEFINER`, y SHALL NOT otorgar al rol `anon` ningún permiso `SELECT`, `INSERT`, `UPDATE` ni `DELETE` directo sobre `persona`, `persona_llegada`, `casa_de_paz_membresia`, `casa_de_paz` ni `casa_paz_url`.
2. THE Sistema SHALL otorgar al rol `anon` únicamente `EXECUTE` sobre las dos funciones de los Requisitos 5 y 6.
3. THE Sistema SHALL validar dentro de esas funciones, no en el cliente, todo lo que el Requisito 6 exige.
4. THE Sistema SHALL aplicar un límite de frecuencia por Slug a la función de escritura, para amortiguar el abuso de un enlace público conocido.
5. THE Sistema SHALL registrar `creado_por = NULL` en las Personas creadas por Registro_Anonimo, porque no hay Usuario autenticado que lo haya creado.
