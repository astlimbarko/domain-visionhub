# Modulos del Software VisionHub

## Vision general

VisionHub es un sistema de gestion eclesiastica (Church Relationship Management - ChMR) para la Red Apostolica del apostol Edgar Ortuño. Cubre tres dominios principales: seguimiento de personas (CRM), administracion de recursos (ERP) y comunidad celular (CC).

## Arquitectura base

### Multi-tenancy

- Cada iglesia es un tenant independiente.
- Row-Level Security (RLS) controla acceso a nivel de filas.
- Cada usuario solo ve datos de su iglesia o cobertura segun su rol.
- La tabla "iglesia" define la pertenencia y la "cobertura" el nivel superior.

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
| SUPER_ADMIN | Acceso total |
| ADMIN | Administracion de iglesia |
| SOPORTE | Soporte tecnico |
| AUDITOR | Solo lectura para auditoria |
| USUARIO | Uso basico |
| INVITADO | Acceso limitado |

### Roles organizacionales (no son de software)

Apostol, Pastor, Lider_Red, Sublider_Red, Lider_CdP, Sublider_CdP, Lider_Evangelismo, Lider_Afirmacion, Lider_Discipulado, Lider_Envio, Maestro, Estudiante, Contador, Editor, Miembro, Invitado.

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
