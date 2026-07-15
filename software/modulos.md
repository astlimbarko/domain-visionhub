# Modulos del Software VisionHub

## Vision general

VisionHub es un sistema de gestion eclesiastica (Church Relationship Management - ChMR) para la Red Apostolica del apostol Edgar Ortuño. Cubre tres dominios principales: seguimiento de personas (CRM), administracion de recursos (ERP) y comunidad celular (CC).

**Stack:** Supabase + PostgreSQL (ver [bd-modelo.md](bd-modelo.md))

**Proceso de desarrollo:** Esta documentacion sera pasada por Claude Code para generar los archivos de configuracion y spec tecnicos (hardcode, etc.).

## Foco actual: Modulo 1

El desarrollo actual se concentra en el **Modulo 1**. Los demas modulos se implementaran despues.

### Despliegue inicial: 2 iglesias

El sistema se implementa primero en 2 iglesias, pero se disena como si fuera escalable (multi-tenancy real). Esto permite agregar iglesias sin refactorizar.

| Iglesia | Tipo | Ubicacion |
|---------|------|-----------|
| **Centro de Vida Global 4 Anillo** | Madre (sede principal) | Santa Cruz, Bolivia |
| **Centro de Vida Global Montero** | Hija (espiritual de Cochabamba) | Montero, Bolivia |

**Nota:** La iglesia de Cochabamba (Centro de Vida Global) NO se da de alta en esta fase. Solo se documenta para que el modelo la soporte a futuro.

### Flujo de alta inicial (configuracion)

El alta de usuarios sigue una cadena de autoridad. Cada nivel crea al siguiente:

```
1. ADMIN TECNICO (el desarrollador/soporte)
   └── Da de alta al PASTOR de todas las iglesias

2. PASTOR (de la iglesia madre - Santa Cruz)
   └── Da de alta al SUPERVISOR DE LA VISION EN ACCION en cada iglesia
       (Montero y Santa Cruz)

3. PASTOR o SUPERVISOR
   └── Da de alta las REDES
   └── Da de alta los DEPARTAMENTOS (Ev, Af, Di, En)
   └── Asigna ENCARGADOS de Departamentos de Red y Ministerio de Red

4. SUPERVISOR o LIDER DE RED
   └── Da de alta las CASAS DE PAZ
   └── Asigna LIDERES y SUBLIDERES de CdP
```

**Regla:** Solo el admin tecnico puede crear el primer usuario (pastor). Despues, cada nivel crea al siguiente. Nadie se auto-asigna.

### Jerarquia de las 2 iglesias

- **Centro de Vida Global (Cochabamba)** es la iglesia madre real y sede del apostol. NO se da de alta en esta fase.
- **Centro de Vida Global 4 Anillo (Santa Cruz)** es iglesia hija de Cochabamba. Sede principal del despliegue.
- **Centro de Vida Global Montero** es iglesia hija de Cochabamba.
- Ambas iglesias de Santa Cruz y Montero estan bajo el **mismo pastor** (pastor de Santa Cruz).
- Cada iglesia tiene su propio **Supervisor de la Vision en Accion** (puede ser la misma persona en ambas). Supervisa solo su iglesia.
- El **pastor** puede ver en su dashboard el resumen de todas sus iglesias (Santa Cruz + Montero + futuras hijas).
- Cada iglesia opera de forma independiente: sus propias redes, casas de paz, miembros.
- El **Supervisor** tiene poderes totales sobre SU iglesia: crear redes, casas de paz, asignar lideres y sublideres.
- El Supervisor **recibe ordenes directas del pastor** y ejecuta los procesos. Brazo operativo del pastor.

### Componentes del Modulo 1

| # | Componente | Descripcion |
|---|-----------|-------------|
| 0 | **Configuracion de iglesias** | Alta de iglesias, iglesia padre/hija, pastor asignado, supervisor por iglesia. Punto de entrada para escalar. |
| 1 | **Formulario de CdP (web)** | Lider O SUBLIDER de CdP llena reporte semanal de reunion via web |
| 2 | **App movil CdP** | Mismo formulario pero en app movil para lideres/sublideres de CdP + dashboard |
| 3 | **Dashboard lider de CdP** | Historial de su CdP, asistencia, ofrendas, miembros |
| 4 | **Dashboard sublider de CdP** | Similar al del lider pero configurable desde Supervision (ver dashboards/sublider-cdp.md) |
| 5 | **Dashboard lider de red** | Resumen de todas las CdP de su red, ranking, alertas |
| 6 | **Dashboard supervisor** | Todo de su iglesia: redes, CdP, departamentos, alertas, configuracion |
| 7 | **Dashboard pastor** | Todas sus iglesias (madre + hijas), comparativas, reportes |
| 8 | **Formulario de membresia** | Formulario online de registro de nuevos miembros |
| 9 | **Plataforma finanzas** | Ingresos de CdP (ofrendas, diezmos) |

### Modulos futuros

| Modulo | Contenido |
|--------|-----------|
| 2 | Departamento de Evangelismo |
| 3 | Departamento de Afirmacion (resto del depto, ya esta el formulario de membresia en Mod 1) |
| 4 | Departamento de Discipulado (escuela de discipulado) |
| 5 | Departamento de Envio |
| 6 | Finanzas completas (contabilidad general)

## Arquitectura base

### Multi-tenancy

- Cada iglesia es un tenant independiente.
- Row-Level Security (RLS) controla acceso a nivel de filas.
- Cada usuario solo ve datos de su iglesia segun su rol.
- La tabla "iglesia" define la pertenencia. Relacion padre/hija para jerarquia apostolica.
- **Regla de pastor:** Un pastor puede tener varias iglesias (madre + hijas). Su dashboard muestra el resumen de todas.
- **Regla de supervisor:** Un supervisor opera solo SU iglesia. Puede ser la misma persona en varias iglesias, pero en cada una tiene permisos independientes.
- **Escalabilidad:** Empezamos con 2 iglesias, pero el modelo soporta N iglesias sin cambios.

### Auditoria

Toda tabla contiene campos de auditoria:

| Campo | Funcion |
|-------|---------|
| fecha_creacion | Timestamp de creacion |
| fecha_actualizacion | Timestamp de ultima modificacion |
| creado_por | ID de persona que creo |
| actualizado_por | ID de persona que modifico |
| fecha_eliminacion | Timestamp de eliminacion logica |
| eliminado_por | ID de persona que elimino |

Los IDs son UUID. El idioma por defecto es espanol.

### Autenticacion

- Login con username Y email (ambos unicos).
- Password hasheado.
- Sistema de bloqueo por intentos fallidos.
- Refresh tokens para mantener sesion.
- Campo `requiere_cambio_password` para primer login.
- El email de autenticacion puede diferir del correo de contacto de la persona.

---

## Dominio 1: CRM (Seguimiento de Personas)

### Persona

Gestion completa del perfil de cada persona:

- Datos personales (nombres, apellidos, CI, sexo, fecha nacimiento, correo contacto).
- Persona detalle (lugar nacimiento, estado civil, grado instruccion, ocupacion).
- Direccion con modelo hibrido (asignacion + datos fisicos, principal, historial).
- Telefono con modelo hibrido (asignacion + numero, tipo, principal, historial).
- Campo "oculto" para personas de alto rango.
- Vista de nombre completo.

### Ingreso a la iglesia

- Registro de como llego la persona (motivo, fecha, quien invito).
- Invitado por persona (FK) o texto libre.
- Historial de pertenencia a iglesia.

### Familia

- Relaciones familiares entre personas del sistema.
- Tipo de relacion con inverso (padre->hijo, esposo->esposa).
- Referencias familiares en texto libre cuando el familiar no esta en BD.

### Estados espirituales (SSVA)

Estados: SIM, NC, CRE, RE, DA, DI.

Transiciones con criterios configurables:
- SIM -> NC: ora de fe
- NC -> CRE: 1 semana sin discipulado
- NC/CRE -> DA: asiste a discipulado
- DA -> DI: 3 clases ausentes
- DI -> DA: retoma asistencia
- RE -> DA: asiste a discipulado (RE dura 1 dia)

El sistema debe calcular estados automaticamente segun asistencia y tiempo.

### Evangelismo

- Registro de personas evangelizadas.
- Fecha, domicilio, telefono, escala (casa de paz, red, iglesia, cobertura).
- Solo evangelismo de casas de paz por ahora.

### Afirmacion

- Registro de fechas de altar, fiesta, bautismo.
- Bautizo en esta iglesia (boolean) + fecha + iglesia o texto.
- Retiro espiritual de sanidad interior.

### Discipulado

- 7 cursos con orden y nombre.
- Inscripcion en cursos (persona, curso, fecha alta, fecha completado).
- Lecciones por curso (nombre, orden).
- Retiro del Espiritu Santo (evento de un solo dia).
- Retiro de Mentores (evento de un solo dia).

### Envio

- Registro de fecha de envio como lider de CdP.
- Fecha de ultimo envio (referencia historica).
- Solo para quienes completaron discipulado de lideres + retiro + aval pastoral.

### Formacion post-envio

- Tipos: Seminario, Universidad Vino Nuevo.
- Fecha de inicio y fin.

---

## Dominio 2: ERP (Recursos y Administracion)

### Estructura organizacional

**Cobertura:**
- Entidad abstracta sin sede fisica.
- Puede tener cobertura padre (jerarquia apostolica).
- Lider historico de la cobertura.

**Iglesia:**
- Tiene iglesia padre (quien la fundo).
- Perteneciente a una cobertura.
- Correo electronico para contacto.
- Activo/inactivo.

**Red:**
- Agrupacion de casas de paz.
- Pertenece a una iglesia.
- Lider y sublider historico.
- **Encargado de Departamentos de Red (OBLIGATORIO):** Supervisa representantes de Ev, Af, Di, En.
- **Encargado de Ministerio de Red (OBLIGATORIO):** Coordina personas de la red en ministerios.
- Activo/inactivo.
- **Regla:** Toda red debe tener ambos encargados asignados.

**Casa de paz:**
- Pertenece a una red.
- Historial de cambios de red (es_principal).
- Lider, sublider, anfitrion historicos.
- Membresia historica de personas.
- Puede tener representantes de departamentos (no obligatorio).

### Cargos y liderazgo

**Nivel Vision (Macro):**
- Lider de la Vision: cabeza administrativa del crecimiento. No pastorea, supervisa.
- Encargado de Departamentos (Vision): supervisa y estandariza los 4 departamentos a nivel global.
- Encargado General de Ministerios (Vision): audita y cruza datos de personas por red y ministerio.

**Nivel Iglesia:**
- Apostol, Pastor, Profeta, Evangelista, Maestro (5 ministerios).
- Ministro, Anciano, Diacono.

**Nivel Red:**
- Lider de Red.
- Encargado de Departamentos de Red (OBLIGATORIO).
- Encargado de Ministerio de Red (OBLIGATORIO).

**Nivel CdP:**
- Lider de CdP, Sublider de CdP.

**Cargos (catalogo global):**
- Tipo A (unico): apostol, pastor, profeta, evangelista, maestro, ministro, diacono.
- Tipo B (multiple): lider_ministerio, lider_red, sublider_red, lider_cdp, sublider_cdp.
-Una persona puede tener Tipo A + Tipo B simultaneamente.

**Liderazgo persona:**
- Historial de cargo por persona (inicio, fin, activo).
- Cada registro apunta a un cargo y una iglesia.

### Ministerios

- 14 ministerios (Alabanza, Danza, Comunicacion, Ninos, Jovenes, Protocolo, Ujieres, Parqueo, Cocina, Evangelismo, Sonido, Testimonios, Escuderos, Intercesion).
- Asignaciones historicas (ministerio, lider, fechas).
- Un ministerio nunca se cierra.

### Membresia

- Historial de pertenencia a iglesia (fecha inicio, fin).
- Historial de pertenencia a casa de paz.

---

## Dominio 3: CC (Comunidad Celular)

### Reportes de casa de paz

Cada reunion semanal se reporta con:
- Fecha, casa de paz, tema, libro, disertador.
- Salida evangelistica (si/no).
- Testimonios y comentarios.
- Asistencia por tipo (menores/mayores).
- Ofrendas y diezmos de la reunion.

### Formulario de reporte

El lider llena un formulario con los datos de la reunion. Actualmente por WhatsApp o Google Forms. El software debe reemplazar esto.

---

## Dominio 4: Finanzas

### Ingresos

- Tipos: ofrenda, diezmo, primicia, pacto.
- Registro por reunion con persona (opcional) o grupal.
- Moneda configurable (bolivianos, dolares, otra).
- Asociado a tipo de reunion.

### Reportes

- Periodicidad: semanal, mensual, trimestral, semestral, anual.
- Por area: CdP, red, global.
- Contenido: fecha, tipo reunion, asistentes, montos por tipo, moneda.

---

## Formularios de reporte

El sistema debe generar formularios para:

1. **Membresia:** Registro completo de datos personales al bautizar.
2. **Reporte de CdP:** Formulario semanal del lider.
3. **Reporte de evangelismo:** Registro de personas evangelizadas.

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| SUPER_ADMIN | Acceso total (admin tecnico) |
| ADMIN | Administracion de iglesia (pastor, supervisor) |
| USUARIO | Uso basico (lideres, miembros) |
| INVITADO | Solo lectura — observa dashboards pero no puede editar nada |

- Un usuario puede tener **multiples roles del sistema** (ej: ADMIN en una iglesia, USUARIO en otra).
- Los roles organizacionales (pastor, lider, etc.) NO son roles de software — se manejan por el modelo de datos (persona tiene cargo X en iglesia Y).

### Panel de configuracion del Supervisor

El Supervisor de la Vision en Accion tiene un panel para configurar su iglesia. Puede activar/desactivar y ajustar:

| Area | Que configura |
|------|---------------|
| **Dashboard de CdP** | Que ve el lider de CdP: reportes, asistencia, ofrendas, historial. Activar/desactivar secciones. |
| **Dashboard de Red** | Que ve el lider de red: resumen de sus CdP, graficos, comparativas. Activar/desactivar secciones. |
| **Formulario de membresia** | Campos obligatorios vs opcionales. Ej: si 'ocupacion' es obligatorio u opcional. |
| **Formulario de CdP** | Campos del reporte semanal. Ej: si 'testimonios' es obligatorio, si 'salio a evangelizar' aparece. |
| **Departamentos activos** | Que departamentos estan activos en la iglesia. Ej: Evangelismo y Discipulado activos, Afirmacion no. |
| **Estados SSVA** | Configurar estados y transiciones. Ej: cambiar numero de clases para DA→DI. |
| **Notificaciones** | Que notificaciones recibe cada rol. Ej: alerta cuando CdP no reporto, miembro inactivo. |
| **Moneda por defecto** | Moneda que usa la iglesia (BOB, USD). |
| **Catalogos** | Editar listas: tipos de contribucion, ministerios, cargos, etc. |
| **Dashboard del Sublider** | Configurar que puede ver el sublider de CdP: ofrendas, graficos, historial, editar reporte. |
| **Criterios de CdP** | Valores numericos que el Supervisor puede cambiar (ver tabla abajo). |
| **Criterios de Estados (SSVA)** | Valores numericos de transiciones de estados (ver tabla abajo). |

### Criterios configurables — Casa de Paz

| Criterio | Valor por defecto | Que significa |
|----------|-------------------|---------------|
| Visitas para ser miembro | 2 | A partir de la 2da visita consecutiva, la persona es miembro |
| Visitas para migrar de CdP | 8 | Si asiste 8 veces seguidas a otra CdP, se asume que se cambio |
| Inasistencias para inactivo | 12 | Despues de ~12 inasistencias se considera inactivo |
| Meses para Reconciliado | 3 | Si estuvo 3+ meses fuera y retorna, es Reconciliado |

### Criterios configurables — Estados SSVA

| Criterio | Valor por defecto | Que significa |
|----------|-------------------|---------------|
| Clases ausentes para DI | 3 | 3 clases seguidas sin ir al discipulado = Discipulo Inactivo |
| Semanas sin discipulado NC→CRE | 1 | 1 semana sin ir al discipulado y NC pasa a CRE |
| Asistencia para ser DA | 1 | Basta 1 vez al discipulado para ser Discipulo Activo |
| Dias como RE antes de DA | 1 | Reconciliado dura 1 dia, luego pasa a DA si asiste |
| Edad minima para CRE | 12 | CRE es para mayores de 12 anos |

**Nota:** El Supervisor cambia estos valores desde su panel. Si los cambia, el sistema aplica los nuevos valores a partir de ese momento. Los valores anteriores ya procesados NO se recalculation retroactivamente.

---

## Criterios de disenho

1. Un archivo o grupo por area funcional.
2. Brevedad: documentacion condensada, no abultada.
3. UUID para todos los IDs.
4. Soft delete (nunca borrar fisicamente).
5. Auditoria en toda tabla.
6. RLS para multi-tenancy.
7. Enums para campos con valores fijos.
8. Modelo hibrido para direcciones y telefonos (evitar polimorfismo puro).

## Reglas de negocio adicionales

1. **Pertenencia de Red:** Cuando un miembro se inscribe o sirve en un ministerio, el sistema no debe perder el rastro de la red a la que pertenece. La relacion persona-ministerio debe cruzarse con persona-red.
2. **Obligatoriedad en Redes:** Toda red debe tener un Encargado de Departamentos de Red y un Encargado de Ministerio de Red asignados. Ninguna red puede existir sin estos perfiles.
3. **Flujo de Auditoria:** Los Encargados Generales (Vision) tienen permisos de lectura/auditoria global sobre todas las redes, ministerios y departamentos para generar dashboards.
4. **Separacion de Responsabilidades:** Los encargados de nivel Vision tienen enfoque global/analitico/estandarizacion. Los encargados de nivel Red tienen enfoque local/operativo/manejo directo de personas.
