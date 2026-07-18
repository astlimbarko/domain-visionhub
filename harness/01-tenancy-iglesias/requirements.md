# Requisitos — Tenancy e Iglesias

## Introducción

Define cómo se aísla cada iglesia, cómo se autentica la gente y cómo se dan de alta los usuarios. Es la capa de seguridad de todo el sistema: si esta falla, un líder de Montero ve los datos de Santa Cruz.

El despliegue arranca con dos iglesias, pero el modelo se diseña para N sin refactorizar. Cochabamba existe como iglesia madre real y **no se da de alta en esta fase**; el modelo debe admitirla después sin migración.

## Glosario

- **Iglesia**: Congregación local. Es el tenant del sistema.
- **Iglesia_Madre**: Iglesia que fundó a otra. Se referencia con `iglesia_padre_id`.
- **Cobertura**: Agrupación apostólica de iglesias. Entidad abstracta, sin sede física.
- **Usuario**: Fila de `auth.users` de Supabase. Representa a alguien que puede iniciar sesión.
- **Persona**: Fila de `persona`. Representa a un ser humano de la iglesia. La mayoría de las Personas **no** tiene Usuario.
- **Rol_Sistema**: Nivel de permiso de un Usuario en una Iglesia: `SUPER_ADMIN`, `PASTOR`, `SUPERVISOR_VISION_ACCION`, `LIDER_RED`, `LIDER_CDP`, `SUBLIDER_CDP` (roles de dominio, `rol_sistema_enum` en `01_enums.sql`; reemplazan al enum genérico `ADMIN`/`USUARIO`/`INVITADO` de una versión anterior de este documento).
- **Admin_Tecnico**: Quien desarrolla y da soporte al sistema. Tiene `SUPER_ADMIN`. No es un cargo de la iglesia.
- **Pastor**: Autoridad principal de una o más Iglesias. Ve el resumen de todas las suyas.
- **Supervisor**: Supervisor de la Visión en Acción. Brazo operativo del Pastor en una Iglesia. En `domain_knowledge/cargos/cargos.md` aparece como "Líder de la Visión en Acción": **es el mismo rol**.
- **Iglesias_Accesibles**: Conjunto de Iglesias cuyos datos puede leer el Usuario actual.
- **Alta_En_Cadena**: Regla por la cual cada nivel de autoridad da de alta al siguiente y nadie se auto-asigna.

## Requisitos

### Requisito 1: Modelo de iglesia

**Historia:** Como pastor, quiero que el sistema refleje que Santa Cruz y Montero son hijas de Cochabamba, para que la jerarquía apostólica quede registrada aunque Cochabamba todavía no use el software.

#### Criterios de aceptación

1. THE Sistema SHALL permitir que una Iglesia referencie a su Iglesia_Madre mediante `iglesia_padre_id`.
2. THE Sistema SHALL permitir que `iglesia_padre_id` sea `NULL`, para representar una Iglesia cuya madre no está dada de alta.
3. WHEN se da de alta la Iglesia_Madre de una Iglesia existente, THE Sistema SHALL permitir asignar `iglesia_padre_id` mediante un `UPDATE`, sin migración de esquema ni pérdida de datos.
4. IF `iglesia_padre_id` es igual al `id` de la propia Iglesia, THEN THE Sistema SHALL rechazar la operación.
5. IF una cadena de `iglesia_padre_id` forma un ciclo, THEN THE Sistema SHALL rechazar la operación que lo cierra.
6. THE Sistema SHALL asociar toda Iglesia a exactamente una Cobertura.
7. THE Sistema SHALL registrar de cada Iglesia: `nombre`, `ciudad`, `correo`, `moneda_defecto` y `activo`.

### Requisito 2: Autenticación

**Historia:** Como líder de casa de paz, quiero entrar con mi correo y contraseña, sin que el sistema invente su propio mecanismo de login.

#### Criterios de aceptación

1. THE Sistema SHALL delegar la autenticación completa en Supabase Auth.
2. THE Sistema SHALL identificar a cada Usuario por su correo electrónico.
3. THE Sistema SHALL almacenar las contraseñas únicamente en `auth.users`, gestionadas por Supabase.
4. IF una tabla del esquema `public` almacena contraseñas, hashes de contraseña, tokens de sesión o contadores de intentos fallidos, THEN THE Sistema SHALL rechazar ese diseño.
5. THE Sistema SHALL vincular una Persona a un Usuario mediante `persona.usuario_id`, referenciando `auth.users(id)`.
6. THE Sistema SHALL permitir que `persona.usuario_id` sea `NULL`, porque la mayoría de las Personas no inicia sesión.
7. THE Sistema SHALL exigir que `persona.usuario_id` sea único entre las Personas vigentes: un Usuario corresponde a una sola Persona.
8. THE Sistema SHALL mantener el correo de contacto de la Persona (`persona.correo`) separado del correo de autenticación (`auth.users.email`), y SHALL permitir que difieran.
9. WHEN se crea un Usuario nuevo, THE Sistema SHALL exigir cambio de contraseña en el primer inicio de sesión.

### Requisito 3: Roles del sistema

**Historia:** Como supervisor, quiero que una misma persona pueda ser administradora en una iglesia y solo usuaria en otra, porque el pastor de Santa Cruz también pastorea Montero.

#### Criterios de aceptación

1. THE Sistema SHALL asignar a cada Usuario un Rol_Sistema **por Iglesia**, no global.
2. THE Sistema SHALL permitir que un Usuario tenga Rol_Sistema distinto en Iglesias distintas.
3. THE Sistema SHALL definir los Rol_Sistema como: `SUPER_ADMIN`, `PASTOR`, `SUPERVISOR_VISION_ACCION`, `LIDER_RED`, `LIDER_CDP`, `SUBLIDER_CDP` (roles de dominio; decisión del owner 2026-07-17, ver [design.md](design.md)).
4. THE Sistema SHALL otorgar a `SUPER_ADMIN` acceso a todas las Iglesias, sin necesidad de asignación por Iglesia.
5. THE Sistema SHALL NOT modelar un rol transversal de "solo lectura": el acceso limitado se resuelve asignando el Rol_Sistema de dominio que corresponda a la situación real de esa persona en esa Iglesia.
6. THE Sistema SHALL distinguir Rol_Sistema (permiso de software) de cargo organizacional (pastor, líder de red, líder de CdP), y SHALL modelarlos en tablas separadas.

### Requisito 4: Aislamiento entre iglesias

**Historia:** Como pastor, quiero certeza de que un líder de Montero jamás verá los datos de Santa Cruz, aunque manipule las peticiones a la API.

#### Criterios de aceptación

1. THE Sistema SHALL habilitar Row-Level Security en toda tabla del esquema `public`.
2. THE Sistema SHALL incluir una columna `iglesia_id` en toda tabla que contenga datos de negocio pertenecientes a una Iglesia.
3. THE Sistema SHALL restringir toda lectura a las filas cuyo `iglesia_id` pertenezca a las Iglesias_Accesibles del Usuario actual.
4. IF un Usuario solicita una fila cuyo `iglesia_id` no está en sus Iglesias_Accesibles, THEN THE Sistema SHALL comportarse como si la fila no existiera.
5. THE Sistema SHALL aplicar el aislamiento en la base de datos, y SHALL NOT depender de ningún filtro enviado por el cliente.
6. THE Sistema SHALL revocar todo acceso del rol `anon` a los datos de negocio. La única excepción es `EXECUTE` sobre las dos funciones `SECURITY DEFINER` acotadas de [13-registro-publico-cdp](../13-registro-publico-cdp/requirements.md#requisito-7-seguridad-del-acceso-anónimo): ninguna otra tabla, vista ni función queda expuesta a `anon`.
7. WHEN se crea una tabla nueva en `public`, THE Sistema SHALL exigir que se habilite RLS antes de otorgarle permisos a `authenticated`.

### Requisito 5: Iglesias accesibles por rol

**Historia:** Como supervisor de dos iglesias, quiero cambiar entre ellas dentro del sistema y ver solo lo mío en cada una.

#### Criterios de aceptación

1. WHERE el Usuario tiene rol `SUPER_ADMIN`, THE Sistema SHALL incluir todas las Iglesias en sus Iglesias_Accesibles.
2. WHERE el Usuario es Pastor de una o más Iglesias, THE Sistema SHALL incluir todas esas Iglesias en sus Iglesias_Accesibles.
3. WHERE el Usuario es Supervisor de una o más Iglesias, THE Sistema SHALL incluir todas esas Iglesias en sus Iglesias_Accesibles.
4. WHERE el Usuario no es Pastor ni Supervisor, THE Sistema SHALL incluir únicamente la Iglesia de su Persona en sus Iglesias_Accesibles.
5. THE Sistema SHALL permitir que un Pastor tenga varias Iglesias, y SHALL exponer el resumen consolidado de todas.
6. THE Sistema SHALL permitir que la misma Persona sea Supervisor de varias Iglesias, con permisos independientes en cada una.
7. THE Sistema SHALL evaluar las Iglesias_Accesibles en el servidor a partir de `auth.uid()`, y SHALL NOT aceptarlas como parámetro del cliente.
8. THE Sistema SHALL exponer una función que devuelva las Iglesias_Accesibles del Usuario actual, para que el cliente pinte el selector de iglesia.

### Requisito 6: Alta en cadena

**Historia:** Como pastor, quiero que nadie se auto-asigne permisos, para que la autoridad del sistema refleje la autoridad real de la iglesia.

#### Criterios de aceptación

1. THE Sistema SHALL permitir únicamente al Admin_Tecnico crear el primer Usuario con rol `ADMIN` de una Iglesia, que corresponde al Pastor.
2. THE Sistema SHALL permitir al Pastor designar al Supervisor de cada una de sus Iglesias.
3. THE Sistema SHALL permitir al Pastor y al Supervisor crear Redes y Departamentos en las Iglesias donde tienen rol `ADMIN`.
4. THE Sistema SHALL permitir al Supervisor y al Líder de Red crear Casas de Paz y designar sus Líderes y Sublíderes.
5. IF un Usuario intenta asignarse a sí mismo un Rol_Sistema, THEN THE Sistema SHALL rechazar la operación.
6. IF un Usuario intenta asignar un Rol_Sistema de nivel superior al propio, THEN THE Sistema SHALL rechazar la operación.
7. IF un Usuario intenta asignar un Rol_Sistema en una Iglesia que no está en sus Iglesias_Accesibles, THEN THE Sistema SHALL rechazar la operación.
8. WHEN se asigna un Rol_Sistema, THE Sistema SHALL registrar qué Usuario lo asignó y cuándo.

### Requisito 7: Despliegue inicial

**Historia:** Como owner, quiero arrancar con dos iglesias sin cerrarle la puerta a las demás.

#### Criterios de aceptación

1. THE Sistema SHALL dar de alta la Cobertura "Red Apostólica del Ap. Edgar Ortuño", con sede en Cochabamba.
2. THE Sistema SHALL dar de alta la Iglesia "Centro de Vida Global 4 Anillo", ciudad Santa Cruz, con `iglesia_padre_id = NULL`.
3. THE Sistema SHALL dar de alta la Iglesia "Centro de Vida Global Montero", ciudad Montero, con `iglesia_padre_id = NULL`.
4. THE Sistema SHALL NOT dar de alta la Iglesia de Cochabamba en esta fase.
5. THE Sistema SHALL asignar la misma Persona como Pastor de ambas Iglesias.
6. THE Sistema SHALL asignar `BOB` como `moneda_defecto` de ambas Iglesias.
7. WHERE una Iglesia se agrega en el futuro, THE Sistema SHALL requerir únicamente operaciones de inserción de datos, sin cambios de esquema ni de políticas RLS.
