# Pendientes de Revision

## Area de Membresia (asterisco en el update)

Los siguientes campos del formulario de membresia estan marcados como "falta revisar si estamos bien":

- `fecha_ultimo_envio` — Se refiere a la ultima vez que recuerda haber sido enviado como lider. Podria ser solo referencia (dia, mes o anio). Requiere definicion exacta.
- `Cual es su cargo(s) en la iglesia?` — Opcion multiple opcional. Verificar si la estructura de cargos Tipo A/B cubre esto correctamente.
- `En que ministerio sirve?` — Verificar relacion con la tabla de asignaciones ministeriales.
- `Es lider de algun ministerio?` — Verificar si se maneja como cargo o como asignacion.

## Area de Evangelismo

- El campo `domicilio` guarda texto libre por defecto. El sistema debe normalizar despues por medio de frontend en la tabla de direcciones. Requiere definir el flujo de normalizacion.
- `telefono_persona_id` — FK de telefono. Verificar si es el telefono de la persona evangelizada o del evangelizador.

## Area de Discipulado

- `discipulado_curso.iglesia_id` — Se define a que "tenant y cobertura" pertenece. Verificar si es necesario o si basta con la iglesia de la persona.
- Cursos: la cantidad de lecciones varia (12, 5, 10). Verificar si hay un estandar o si se permite configurar.

## Area de Envio

- `fecha_ultimo_envio` vs `fecha_envio` — El primero es historico (antes del SAAS), el segundo es desde la implementacion. Verificar coherencia.

## Area de Liderazgo

- `liderazgo_cargo` — Los tipos A y B estan definidos pero falta verificar si la lista esta completa.
- `liderazgo_persona` — Falta definir si `activo` se calcula automaticamente segun `fecha_fin` o es manual.

## Area de Formacion Post-envio

- Solo tenemos Seminario y Universidad Vino Nuevo por ahora. Verificar si hay mas opciones futuras.

## Area de Finanzas

- `tipo_reunion` — Solo tenemos "casas de paz" por ahora. Las otras reuniones (jovenes, domingo, etc.) se agregaran despues.
- `persona_id` — Null cuando el ingreso es grupal. Verificar si esto es suficiente o si se necesita otro campo.

## Roles y Permisos

- El area de roles, usuarios y permisos aun no esta aclarada completamente. Falta revisar y establecer:
  - Que rol de sistema puede hacer que acciones.
  - Relacion entre rol_sistema y rol_organizacional.
  - Permisos granulares por modulo.

## Nuevos Roles de Vision y Red (actualizacion Daniel)

Los siguientes roles son nuevos y requieren modelado en la BD:

- **Lider de la Vision (Macro):** Cabeza administrativa. No pastorea, supervisa.
- **Encargado de Departamentos (Vision):** Supervisa los 4 departamentos a nivel global.
- **Encargado General de Ministerios (Vision):** Audita participacion por red y ministerio.
- **Encargado de Departamentos de Red:** OBLIGATORIO en cada red.
- **Encargado de Ministerio de Red:** OBLIGATORIO en cada red.

**Preguntas abiertas:**
- El Lider de la Vision es un rol permanente o temporal?
- Los Encargados de Red son roles funcionales o ministeriales?
- El Encargado General de Ministerios tiene acceso de escritura o solo lectura/auditoria?
