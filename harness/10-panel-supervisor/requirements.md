# Requisitos — Panel del Supervisor

## Introducción

El panel donde el Supervisor de la Visión en Acción configura su iglesia sin pedirle nada al desarrollador.

`software/pendientes.md` dejó abierto el detalle técnico de cada área configurable. Aquí se cierra, acotado a casas de paz: el panel crece con los módulos siguientes.

La modalidad de registro de personas por URL de líder (`REGISTRO_URL_ACTIVO`) es una Configuracion más de este mismo motor, administrada por el Supervisor. Sus requisitos completos, incluida la administración de cada enlace, están en [13-registro-publico-cdp](../13-registro-publico-cdp/requirements.md).

## Glosario

- **Configuracion**: Valor booleano, numérico o de texto que cambia el comportamiento del sistema en una Iglesia.
- **Criterio**: Configuracion numérica que gobierna una transición de estado o de membresía. Definida en [05-estados-ssva](../05-estados-ssva/requirements.md).
- **Seccion_Configurable**: Bloque de un dashboard que se puede activar o desactivar.
- **Campo_Configurable**: Campo de un formulario cuya obligatoriedad o visibilidad se puede cambiar.
- **Catalogo_Editable**: Catalogo cuyas filas el Supervisor puede agregar, editar o desactivar.

## Requisitos

### Requisito 1: Acceso al panel

**Historia:** Como pastor, quiero que solo el supervisor y yo podamos cambiar la configuración de la iglesia.

#### Criterios de aceptación

1. THE Sistema SHALL permitir el acceso al panel únicamente a Usuarios con rol `ADMIN` en esa Iglesia.
2. IF un Usuario sin rol `ADMIN` en esa Iglesia intenta leer o escribir una Configuracion, THEN THE Sistema SHALL rechazar la operación.
3. THE Sistema SHALL aplicar la restricción en la base de datos.
4. WHERE un Supervisor administra varias Iglesias, THE Sistema SHALL exigir que toda escritura de Configuracion indique la Iglesia.
5. IF un Supervisor intenta configurar una Iglesia fuera de sus Iglesias_Accesibles, THEN THE Sistema SHALL rechazar la operación.
6. THE Sistema SHALL registrar quién cambió cada Configuracion y cuándo.

### Requisito 2: Motor de configuración

**Historia:** Como desarrollador, quiero un solo mecanismo de configuración, no uno por área.

#### Criterios de aceptación

1. THE Sistema SHALL almacenar toda Configuracion por Iglesia en un mecanismo único.
2. THE Sistema SHALL separar la definición de la Configuracion (global) de su valor (por Iglesia).
3. WHERE una Iglesia no tiene definido el valor de una Configuracion, THE Sistema SHALL devolver su valor por defecto.
4. THE Sistema SHALL tipar cada Configuracion como booleana, numérica o de texto.
5. IF el valor asignado no corresponde al tipo de la Configuracion, THEN THE Sistema SHALL rechazar la operación.
6. IF el valor asignado está fuera del rango permitido, THEN THE Sistema SHALL rechazar la operación.
7. THE Sistema SHALL exponer una función de lectura por tipo: booleana, numérica y de texto.
8. THE Sistema SHALL aplicar el nuevo valor a partir del momento del cambio.
9. THE Sistema SHALL NOT recalcular retroactivamente lo ya procesado.

### Requisito 3: Criterios de casa de paz

**Historia:** Como supervisor, quiero ajustar cuántas visitas hacen falta para ser miembro.

#### Criterios de aceptación

1. THE Sistema SHALL exponer para edición: `VISITAS_PARA_MIEMBRO`, `VISITAS_PARA_MIGRAR`, `INASISTENCIAS_PARA_INACTIVO`.
2. THE Sistema SHALL exponer el valor actual, el valor por defecto y el rango permitido de cada uno.
3. THE Sistema SHALL exponer la descripción en español de qué hace cada Criterio.
4. THE Sistema SHALL advertir que el cambio aplica desde ese momento y no recalcula el pasado.

### Requisito 4: Criterios de estados

**Historia:** Como supervisor, quiero ajustar cuándo alguien pasa de nuevo convertido a creyente.

#### Criterios de aceptación

1. THE Sistema SHALL exponer para edición: `VISITAS_PARA_CRE`, `DIAS_PARA_RE`, `EDAD_MINIMA_CREYENTE`.
2. THE Sistema SHALL ocultar los Criterios de estados no disponibles en el módulo actual.
3. THE Sistema SHALL advertir que bajar `EDAD_MINIMA_CREYENTE` no promueve retroactivamente a los menores que ya son NC.
4. THE Sistema SHALL exponer los Criterios agrupados por categoría.

### Requisito 5: Dashboards configurables

**Historia:** Como supervisor, quiero decidir qué ve el sublíder de cada casa de paz.

#### Criterios de aceptación

1. THE Sistema SHALL permitir activar o desactivar cada Seccion_Configurable del dashboard del Sublíder.
2. THE Sistema SHALL exponer como configurables del Sublíder: `SUBLIDER_VE_OFRENDAS`, `SUBLIDER_VE_GRAFICOS`, `SUBLIDER_VE_HISTORIAL`, `SUBLIDER_PUEDE_EDITAR_REPORTE`, `SUBLIDER_RECIBE_NOTIFICACIONES`.
3. THE Sistema SHALL definir las cinco con valor por defecto `false`.
4. THE Sistema SHALL permitir activar o desactivar Seccion_Configurable del dashboard del Líder de CdP.
5. THE Sistema SHALL permitir activar o desactivar Seccion_Configurable del dashboard del Líder de Red.
6. THE Sistema SHALL aplicar la configuración en la base de datos, y SHALL NOT ocultar datos solo en el frontend.

### Requisito 6: Formularios configurables

**Historia:** Como supervisor, quiero decidir si el campo "ocupación" es obligatorio en mi iglesia.

#### Criterios de aceptación

1. THE Sistema SHALL permitir marcar cada Campo_Configurable del formulario de membresía como obligatorio u opcional.
2. THE Sistema SHALL permitir marcar cada Campo_Configurable del formulario de Reporte de CdP como obligatorio, opcional u oculto.
3. THE Sistema SHALL validar la obligatoriedad en la base de datos.
4. IF un campo marcado obligatorio llega nulo, THEN THE Sistema SHALL rechazar la operación con un error que nombre el campo.
5. THE Sistema SHALL NOT permitir marcar como opcional un campo que el esquema define `NOT NULL`.
6. THE Sistema SHALL exponer la configuración de campos para que el frontend pinte el asterisco.
7. WHERE un campo se marca oculto, THE Sistema SHALL exigir que sea opcional.

### Requisito 7: Departamentos

**Historia:** Como supervisor, quiero apagar los departamentos que mi iglesia no usa.

#### Criterios de aceptación

1. THE Sistema SHALL permitir activar o desactivar cada uno de los 4 Departamentos de la Iglesia.
2. WHERE un Departamento está desactivado, THE Sistema SHALL ocultarlo de los dashboards de esa Iglesia.
3. THE Sistema SHALL conservar los datos históricos de un Departamento desactivado.

### Requisito 8: Catálogos editables

**Historia:** Como supervisor, quiero agregar un tipo de contribución que mi iglesia usa.

#### Criterios de aceptación

1. THE Sistema SHALL exponer como Catalogo_Editable: tipos de ingreso, tipos de evento, temas de CdP, ministerios, tipos de teléfono, tipos de relación familiar y motivos de llegada.
2. THE Sistema SHALL permitir agregar filas propias de la Iglesia a cada Catalogo_Editable.
3. THE Sistema SHALL impedir modificar o eliminar las filas globales de un Catalogo_Editable.
4. IF una fila de Catalogo está referenciada por al menos un registro vigente, THEN THE Sistema SHALL impedir su borrado lógico.
5. THE Sistema SHALL permitir desactivar una fila de Catalogo en uso, para retirarla de los formularios nuevos sin afectar el histórico.
6. THE Sistema SHALL permitir al Supervisor marcar qué tipos de relación familiar cuentan para el conteo de familias.

### Requisito 9: Moneda

**Historia:** Como supervisor, quiero fijar la moneda que usa mi iglesia.

#### Criterios de aceptación

1. THE Sistema SHALL permitir al Supervisor cambiar la `moneda_defecto` de su Iglesia.
2. THE Sistema SHALL NOT modificar la moneda de los Ingresos ya registrados al cambiar la `moneda_defecto`.
3. THE Sistema SHALL advertir que el cambio solo afecta a los registros nuevos.

### Requisito 10: Notificaciones

**Historia:** Como supervisor, quiero decidir qué avisos recibe cada rol.

#### Criterios de aceptación

1. THE Sistema SHALL permitir configurar qué notificaciones recibe cada rol organizacional.
2. THE Sistema SHALL exponer como configurable la ventana de días de aviso de eventos.
3. THE Sistema SHALL exponer las notificaciones como consulta en el Módulo 1, y SHALL NOT enviarlas.
