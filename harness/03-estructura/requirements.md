# Requisitos — Estructura Organizacional

## Introducción

Cubre las entidades que organizan a la gente: Red, Casa de Paz, cargos, ministerios y membresía. Todo con historial: quién lideró qué y cuándo, sin perder el pasado.

## Glosario

- **Red**: Agrupación de Casas de Paz dentro de una Iglesia.
- **Casa_De_Paz** (CdP): Unidad básica donde los creyentes se reúnen semanalmente. Pertenece a una Red.
- **Anfitrion**: Persona que hospeda la CdP en su domicilio.
- **Cargo**: Rol dentro de la organización. Es Tipo_A o Tipo_B.
- **Tipo_A**: Cargo único por persona. Ministerial o permanente. Apóstol, pastor, profeta, evangelista, maestro, ministro, anciano, diácono.
- **Tipo_B**: Cargo múltiple por persona. Funcional o temporal. Líder de red, líder de CdP, sublíder de CdP, líder de ministerio.
- **Encargado_Departamentos_Red**: Supervisa a los representantes de los 4 departamentos de su Red.
- **Encargado_Ministerio_Red**: Coordina a las personas de su Red que sirven en ministerios de la Iglesia.
- **Ministerio**: Equipo de servicio a nivel de Iglesia. Nunca a nivel de Red.
- **Miembro_CdP**: Persona que asiste a una CdP de forma regular. Se alcanza por asistencia, automáticamente.
- **Miembro_Iglesia**: Persona bautizada en la Iglesia. Se alcanza por bautizo. **Módulo 3**, fuera de alcance aquí.
- **Red_Incompleta**: Red que no tiene asignados sus dos encargados obligatorios.

## Requisitos

### Requisito 1: Red

**Historia:** Como supervisor, quiero organizar mis casas de paz en redes con un líder responsable de cada una.

#### Criterios de aceptación

1. THE Sistema SHALL asociar toda Red a exactamente una Iglesia.
2. THE Sistema SHALL registrar de cada Red: `nombre`, `iglesia_id` y `activo`.
3. THE Sistema SHALL registrar el Líder de Red como historial, con `fecha_inicio` y `fecha_fin`.
4. THE Sistema SHALL permitir como máximo un Líder de Red vigente por Red.
5. THE Sistema SHALL permitir cero o más Sublíderes de Red vigentes por Red.
6. THE Sistema SHALL registrar el Encargado_Departamentos_Red y el Encargado_Ministerio_Red como historial.
7. THE Sistema SHALL permitir como máximo un Encargado_Departamentos_Red y un Encargado_Ministerio_Red vigentes por Red.
8. IF una Red no tiene los dos encargados vigentes, THEN THE Sistema SHALL marcarla como Red_Incompleta y SHALL exponerla en las alertas del Supervisor.
9. THE Sistema SHALL permitir crear una Red sin encargados asignados, porque la Red debe existir antes de poder designarlos.
10. THE Sistema SHALL exigir que toda persona asignada a un cargo de Red pertenezca a la misma Iglesia que la Red.

### Requisito 2: Casa de Paz

**Historia:** Como líder de red, quiero abrir casas de paz y saber cuáles son mías, con su líder y su anfitrión.

#### Criterios de aceptación

1. THE Sistema SHALL asociar toda Casa_De_Paz a exactamente una Red vigente.
2. THE Sistema SHALL registrar de cada Casa_De_Paz: `nombre`, `red_id`, `iglesia_id` y `activo`.
3. THE Sistema SHALL registrar la pertenencia de Casa_De_Paz a Red como historial, para conservar los cambios de red.
4. THE Sistema SHALL permitir exactamente una Red vigente por Casa_De_Paz.
5. THE Sistema SHALL registrar el Líder de CdP como historial, con como máximo uno vigente.
6. THE Sistema SHALL permitir de cero a N Sublíderes de CdP vigentes por Casa_De_Paz, según `domain_knowledge/cargos/cargos.md`.
7. THE Sistema SHALL registrar el Anfitrion como historial, con como máximo uno vigente.
8. THE Sistema SHALL permitir que una Persona lidere más de una Casa_De_Paz simultáneamente.
9. THE Sistema SHALL exigir que la Red de una Casa_De_Paz pertenezca a la misma Iglesia que la Casa_De_Paz.
10. THE Sistema SHALL vincular la dirección de la Casa_De_Paz al domicilio del Anfitrion mediante el Modelo_Hibrido.

### Requisito 3: Membresía de Casa de Paz

**Historia:** Como líder, quiero que el sistema sepa quiénes son mis miembros sin que yo tenga que declararlo.

#### Criterios de aceptación

1. THE Sistema SHALL registrar la pertenencia de una Persona a una Casa_De_Paz como historial, con `fecha_inicio` y `fecha_fin`.
2. THE Sistema SHALL permitir exactamente una Casa_De_Paz principal vigente por Persona.
3. THE Sistema SHALL permitir que una Persona asista a Casas de Paz distintas de la suya sin cambiar su membresía.
4. THE Sistema SHALL derivar la condición de Miembro_CdP de la asistencia, según los criterios de [05-estados-ssva](../05-estados-ssva/requirements.md).
5. THE Sistema SHALL distinguir Miembro_CdP de Miembro_Iglesia, y SHALL NOT usar el mismo campo para ambos.
6. WHEN una Persona migra de Casa_De_Paz, THE Sistema SHALL cerrar la membresía anterior con `fecha_fin` y abrir la nueva en la misma transacción.
7. THE Sistema SHALL exigir que la Persona y la Casa_De_Paz de una membresía pertenezcan a la misma Iglesia.

### Requisito 4: Cargos

**Historia:** Como supervisor, quiero registrar que alguien es diácono y además líder de casa de paz, porque en la iglesia real eso pasa.

#### Criterios de aceptación

1. THE Sistema SHALL modelar el catálogo de cargos como Catalogo global, compartido por todas las Iglesias.
2. THE Sistema SHALL clasificar cada Cargo como Tipo_A o Tipo_B.
3. THE Sistema SHALL permitir como máximo un Cargo Tipo_A vigente por Persona.
4. THE Sistema SHALL permitir N Cargos Tipo_B vigentes por Persona.
5. THE Sistema SHALL permitir que una Persona tenga un Cargo Tipo_A y varios Tipo_B simultáneamente.
6. THE Sistema SHALL registrar el Cargo de una Persona como historial, con `persona_id`, `cargo_id`, `iglesia_id`, `fecha_inicio` y `fecha_fin`.
7. THE Sistema SHALL derivar el campo `activo` de un Cargo de `fecha_fin IS NULL`, y SHALL NOT permitir asignarlo a mano.
8. THE Sistema SHALL distinguir Cargo organizacional de Rol_Sistema, y SHALL NOT derivar uno del otro automáticamente.

### Requisito 5: Ministerios

**Historia:** Como encargado de ministerios, quiero saber cuánta gente de cada red sirve en cada ministerio.

#### Criterios de aceptación

1. THE Sistema SHALL modelar los Ministerios a nivel de Iglesia.
2. IF se intenta asociar un Ministerio a una Red, THEN THE Sistema SHALL rechazar la operación.
3. THE Sistema SHALL sembrar los 14 Ministerios de `domain_knowledge/ministerios/ministerios.md`.
4. THE Sistema SHALL registrar la participación de una Persona en un Ministerio como historial.
5. THE Sistema SHALL permitir que una Persona participe en varios Ministerios simultáneamente.
6. THE Sistema SHALL registrar el líder de cada Ministerio como historial, con como máximo uno vigente.
7. THE Sistema SHALL NOT permitir el cierre de un Ministerio salvo por acción de un Usuario con rol `ADMIN`.
8. THE Sistema SHALL exponer, para cada Ministerio, cuántas Personas de cada Red participan en él.
9. THE Sistema SHALL derivar la Red de una Persona a través de su Casa_De_Paz vigente, y SHALL NOT duplicar el dato en la asignación ministerial.

### Requisito 6: Departamentos

**Historia:** Como supervisor, quiero activar solo los departamentos que mi iglesia usa.

#### Criterios de aceptación

1. THE Sistema SHALL sembrar los 4 Departamentos: Evangelismo, Afirmación, Discipulado, Envío.
2. THE Sistema SHALL asociar los Departamentos a una Iglesia.
3. THE Sistema SHALL permitir al Supervisor activar o desactivar cada Departamento de su Iglesia.
4. THE Sistema SHALL registrar los representantes departamentales de Red como historial.
5. THE Sistema SHALL permitir que una Casa_De_Paz tenga representantes departamentales, sin exigirlo.
6. WHERE un Departamento está desactivado, THE Sistema SHALL ocultarlo de los dashboards de esa Iglesia.

### Requisito 7: Integridad de la estructura

**Historia:** Como arquitecto, quiero que la base impida estructuras imposibles, no que dependa de que el frontend se porte bien.

#### Criterios de aceptación

1. IF se intenta asignar dos Líderes vigentes a la misma Casa_De_Paz, THEN THE Sistema SHALL rechazar la operación.
2. IF se intenta asignar dos Líderes vigentes a la misma Red, THEN THE Sistema SHALL rechazar la operación.
3. IF se intenta asignar un cargo a una Persona de otra Iglesia, THEN THE Sistema SHALL rechazar la operación.
4. IF `fecha_fin` es anterior a `fecha_inicio` en cualquier historial, THEN THE Sistema SHALL rechazar la operación.
5. IF se intenta desactivar una Red que tiene Casas de Paz vigentes, THEN THE Sistema SHALL rechazar la operación.
6. WHERE una Casa_De_Paz se desactiva, THE Sistema SHALL cerrar las membresías vigentes con `fecha_fin`.
