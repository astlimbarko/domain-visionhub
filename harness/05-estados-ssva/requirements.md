# Requisitos — Estados SSVA

## Introducción

SSVA es el Sistema de Seguimiento en la Visión en Acción. Sigla **no oficial**, solo para documentación interna (`domain_knowledge/README.md`).

En el Módulo 1 existen cuatro estados: **SIM**, **NC**, **CRE** y **RE**. Los otros dos — DA (Discípulo Activo) y DI (Discípulo Inactivo) — dependen de la asistencia al discipulado y entran con el Módulo 4.

Todas las transiciones del Módulo 1 se disparan por asistencia a la Casa de Paz, y por eso son calculables hoy: el reporte semanal ya registra quién vino.

## Glosario

- **Estado**: Situación espiritual de una Persona dentro del SSVA.
- **SIM**: Simpatizante. Persona evangelizada que aún no toma decisión. Estado inicial.
- **NC**: Nuevo Convertido. Aceptó a Jesús. `glosario/glosario.md` lo llama "Nuevo Creyente"; se adopta "Nuevo Convertido" para no chocar con CRE.
- **CRE**: Creyente. Asistente recurrente que ya no es nuevo. Solo para mayores de 12 años.
- **RE**: Reconciliado. Persona que se alejó tres meses o más y retornó.
- **DA / DI**: Discípulo Activo / Inactivo. **Fuera de alcance del Módulo 1.**
- **Criterio**: Valor numérico configurable que gobierna una transición.
- **Transicion**: Cambio de Estado de una Persona, con fecha y motivo.
- **Visitas_Consecutivas**: Cantidad de reuniones seguidas de una Casa_De_Paz a las que asistió una Persona, sin faltar a ninguna intermedia.
- **Ausencia_Prolongada**: Intervalo sin asistencia mayor o igual a `DIAS_PARA_RE`.
- **Inactivo**: Condición derivada de no asistir hace mucho. **No es un Estado**: `criterios.md` la declara no oficial.

## Requisitos

### Requisito 1: Catálogo de estados

**Historia:** Como supervisor, quiero que el sistema maneje los estados que la iglesia usa hoy, sin los que dependen del discipulado que todavía no existe.

#### Criterios de aceptación

1. THE Sistema SHALL sembrar los Estados `SIM`, `NC`, `CRE` y `RE`.
2. THE Sistema SHALL sembrar también `DA` y `DI` como filas inactivas, para que el Módulo 4 solo tenga que activarlas.
3. IF una Transicion apunta a `DA` o `DI` en el Módulo 1, THEN THE Sistema SHALL rechazar la operación.
4. THE Sistema SHALL registrar de cada Estado: `sigla`, `nombre`, `descripcion`, `orden` y `activo`.
5. THE Sistema SHALL exigir que toda Persona tenga exactamente un Estado vigente.

### Requisito 2: Historial de estados

**Historia:** Como pastor, quiero ver cómo evolucionó una persona, no solo dónde está hoy.

#### Criterios de aceptación

1. THE Sistema SHALL registrar el Estado de una Persona como historial, con `fecha_inicio` y `fecha_fin`.
2. THE Sistema SHALL permitir como máximo un Estado vigente por Persona.
3. WHEN una Persona cambia de Estado, THE Sistema SHALL cerrar el anterior con `fecha_fin` y abrir el nuevo en la misma transacción.
4. THE Sistema SHALL registrar el motivo de cada Transicion.
5. THE Sistema SHALL registrar si la Transicion fue automática o manual.
6. THE Sistema SHALL conservar el historial completo, sin sobrescribir Transiciones pasadas.

### Requisito 3: Estado inicial

**Historia:** Como líder, quiero que toda persona nueva arranque en el estado correcto sin que yo tenga que elegirlo.

#### Criterios de aceptación

1. WHEN se registra una Persona por evangelismo, THE Sistema SHALL asignarle el Estado `SIM`.
2. WHEN se registra una Persona por Alta_Rapida desde la asistencia, THE Sistema SHALL asignarle el Estado `SIM`.
3. THE Sistema SHALL asignar el Estado inicial automáticamente, sin intervención del usuario.
4. THE Sistema SHALL permitir al líder cambiar el Estado inicial manualmente si conoce la situación real de la Persona.

### Requisito 4: SIM → NC

**Historia:** Como líder, quiero registrar que una persona aceptó a Jesús, porque es un evento que solo yo puedo saber.

#### Criterios de aceptación

1. THE Sistema SHALL permitir la Transicion de `SIM` a `NC` únicamente de forma manual.
2. THE Sistema SHALL registrar la fecha en que la Persona hizo la oración de fe.
3. THE Sistema SHALL NOT inferir la Transicion `SIM → NC` de la asistencia ni de ningún otro dato.
4. THE Sistema SHALL permitir que la Transicion `SIM → NC` la registre el Líder o el Sublíder de la Casa_De_Paz de la Persona.
5. WHERE una Persona no avanza de `SIM`, THE Sistema SHALL mantenerla en `SIM` y SHALL exponerla en las alertas del líder, conforme a `estados/estados.md`.

### Requisito 5: NC → CRE

**Historia:** Como supervisor, quiero que una persona deje de contar como "nueva" cuando ya viene seguido, y quiero poder ajustar cuántas visitas hacen falta.

#### Criterios de aceptación

1. WHEN una Persona en Estado `NC` alcanza `VISITAS_PARA_CRE` Visitas_Consecutivas a su Casa_De_Paz, THE Sistema SHALL cambiarla a `CRE`.
2. THE Sistema SHALL definir `VISITAS_PARA_CRE` con valor por defecto 2.
3. THE Sistema SHALL permitir al Supervisor cambiar `VISITAS_PARA_CRE` desde su panel.
4. IF la Persona tiene menos de `EDAD_MINIMA_CREYENTE` años, THEN THE Sistema SHALL mantenerla en `NC` y SHALL NOT cambiarla a `CRE`.
5. THE Sistema SHALL definir `EDAD_MINIMA_CREYENTE` con valor por defecto 12.
6. THE Sistema SHALL calcular la edad de la Persona a la fecha de la reunión que dispara la evaluación.
7. WHERE una Persona no tiene `fecha_nacimiento`, THE Sistema SHALL usar `es_menor` de la Asistencia para evaluar el Requisito 4.
8. THE Sistema SHALL ejecutar la Transicion automáticamente al registrarse la Asistencia, sin proceso nocturno.

### Requisito 6: Reconciliado

**Historia:** Como líder, quiero que el sistema me avise cuando alguien que se había perdido vuelve, porque es la persona a la que más hay que atender.

#### Criterios de aceptación

1. WHEN una Persona con Ausencia_Prolongada registra una Asistencia, THE Sistema SHALL cambiarla a `RE`.
2. THE Sistema SHALL definir `DIAS_PARA_RE` con valor por defecto 90.
3. THE Sistema SHALL permitir al Supervisor cambiar `DIAS_PARA_RE` desde su panel.
4. THE Sistema SHALL calcular la Ausencia_Prolongada como los días entre la Asistencia actual y la Asistencia anterior de esa Persona a cualquier Casa_De_Paz.
5. IF la Persona no tiene Asistencia anterior, THEN THE Sistema SHALL NOT cambiarla a `RE`: alguien que nunca vino no se reconcilia.
6. THE Sistema SHALL aplicar la Transicion a `RE` desde cualquier Estado, salvo `SIM` sin asistencia previa.
7. THE Sistema SHALL ejecutar la Transicion automáticamente al registrarse la Asistencia.
8. THE Sistema SHALL exponer las Personas en Estado `RE` en las alertas del líder de su Casa_De_Paz.

### Requisito 7: RE → CRE

**Historia:** Como líder, quiero que quien volvió y se quedó deje de figurar como recién reconciliado.

#### Criterios de aceptación

1. WHEN una Persona en Estado `RE` alcanza `VISITAS_PARA_CRE` Visitas_Consecutivas, THE Sistema SHALL cambiarla a `CRE`.
2. IF la Persona tiene menos de `EDAD_MINIMA_CREYENTE` años, THEN THE Sistema SHALL cambiarla a `NC` en lugar de `CRE`.
3. THE Sistema SHALL contar las Visitas_Consecutivas desde la Asistencia que disparó el paso a `RE`.

> `estados/criterios.md` define la salida de `RE` como `RE → DA` por asistencia al discipulado, que es Módulo 4. Sin esta regla, un reconciliado quedaría en `RE` para siempre. **Confirmar con el owner.**

### Requisito 8: Migración entre casas de paz

**Historia:** Como líder de red, quiero que el sistema detecte cuando alguien se cambió de casa de hecho, aunque nadie lo haya formalizado.

#### Criterios de aceptación

1. WHEN una Persona alcanza `VISITAS_PARA_MIGRAR` Visitas_Consecutivas a una Casa_De_Paz distinta de su Casa_De_Paz principal, THE Sistema SHALL proponer la migración.
2. THE Sistema SHALL definir `VISITAS_PARA_MIGRAR` con valor por defecto 8.
3. THE Sistema SHALL exponer la propuesta como alerta a los Líderes de las dos Casas de Paz.
4. THE Sistema SHALL NOT ejecutar la migración automáticamente: `criterios.md` dice que la migración formal se coordina entre líderes.
5. WHEN un Líder acepta la propuesta, THE Sistema SHALL cerrar la membresía anterior y abrir la nueva como principal.

### Requisito 9: Miembro de casa de paz

**Historia:** Como líder, quiero que el sistema sepa quién ya es de mi casa sin que yo lo declare.

#### Criterios de aceptación

1. WHEN una Persona alcanza `VISITAS_PARA_MIEMBRO` Visitas_Consecutivas a una Casa_De_Paz donde no es Miembro_CdP, THE Sistema SHALL crear su membresía.
2. THE Sistema SHALL definir `VISITAS_PARA_MIEMBRO` con valor por defecto 2.
3. WHERE la Persona no tiene ninguna membresía vigente, THE Sistema SHALL crear la nueva como principal.
4. WHERE la Persona ya tiene una membresía principal vigente en otra Casa_De_Paz, THE Sistema SHALL crear la nueva como no principal y SHALL aplicar el Requisito 8.
5. THE Sistema SHALL distinguir Miembro_CdP de Miembro_Iglesia, conforme a [03-estructura](../03-estructura/requirements.md).

### Requisito 10: Inactividad

**Historia:** Como líder, quiero ver en rojo a los que hace mucho que no vienen.

#### Criterios de aceptación

1. THE Sistema SHALL calcular la inactividad como los días desde la última Asistencia de la Persona.
2. THE Sistema SHALL NOT modelar Inactivo como un Estado del SSVA: `criterios.md` declara la regla no oficial.
3. THE Sistema SHALL exponer la cantidad de inasistencias consecutivas de cada Miembro_CdP.
4. THE Sistema SHALL definir `INASISTENCIAS_PARA_INACTIVO` con valor por defecto 12.
5. THE Sistema SHALL exponer a los Miembro_CdP que superan el umbral en las alertas del líder.
6. THE Sistema SHALL NOT cerrar la membresía por inactividad de forma automática.

### Requisito 11: Motor de criterios

**Historia:** Como supervisor, quiero cambiar los umbrales de mi iglesia sin pedirle nada al desarrollador.

#### Criterios de aceptación

1. THE Sistema SHALL almacenar los Criterios por Iglesia, y SHALL NOT usar constantes en el código.
2. THE Sistema SHALL exponer una función que devuelva el valor de un Criterio para una Iglesia.
3. WHERE una Iglesia no tiene definido un Criterio, THE Sistema SHALL devolver su valor por defecto.
4. THE Sistema SHALL permitir al Supervisor modificar los Criterios de su Iglesia.
5. IF un Usuario sin rol `ADMIN` en esa Iglesia intenta modificar un Criterio, THEN THE Sistema SHALL rechazar la operación.
6. WHEN el Supervisor cambia un Criterio, THE Sistema SHALL aplicar el nuevo valor a partir de ese momento.
7. THE Sistema SHALL NOT recalcular retroactivamente las Transiciones ya procesadas, conforme a `software/modulos.md`.
8. THE Sistema SHALL registrar quién cambió cada Criterio y cuándo.
9. THE Sistema SHALL validar que el valor de un Criterio esté dentro de su rango permitido.
