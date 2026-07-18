# Tareas — Registro Público por URL de Líder

> **Importante:** este módulo agrega la única excepción a "cero acceso de `anon`" (`01-tenancy-iglesias` Req 4.6). Cada tarea de escritura debe cerrar con el checklist de seguridad de [design.md](design.md#checklist-de-seguridad-repetir-si-se-agrega-una-función-pública-nueva).

## 1. Esquema

- [ ] 1.1 Agregar `CREATE EXTENSION IF NOT EXISTS unaccent;` a `00_extensiones.sql`. — *design.md#slug*
- [ ] 1.2 Crear `estado_url_enum` (`ACTIVO`, `INACTIVO`, `SUSPENDIDO`) en `01_enums.sql`. — *Req 2*
- [ ] 1.3 Crear tabla `casa_paz_url` con el bloque estándar de Fundación (00-fundacion) y `uq_casa_paz_url_slug`. — *Req 1.4, 1.6*
- [ ] 1.4 Agregar columna `casa_paz_url_id` nulable a `persona_llegada`, referenciando `casa_paz_url(id)`. — *Req 6.8*
- [ ] 1.5 Verificar que `casa_de_paz_cargo_id` es `NOT NULL` y referencia la fila exacta que originó la URL. — *design.md#esquema*

## 2. Slug

- [ ] 2.1 Crear `fn_slugificar(text)`: minúsculas, sin acentos (`unaccent`), guiones en vez de espacios/símbolos. — *Req 1.4*
- [ ] 2.2 Crear `fn_generar_slug_unico(text)` con sufijo numérico incremental ante colisión. — *Req 1.5*
- [ ] 2.3 Verificar: dos líderes distintos llamados "Juan Pérez" obtienen `juan-perez` y `juan-perez-2`. — *Req 1.5, 1.6*
- [ ] 2.4 Verificar que el slug ignora mayúsculas, tildes y ñ: "José Núñez" → `jose-nunez`. — *Req 1.4*

## 3. Auto-creación y baja automática

- [ ] 3.1 Crear `fn_gestionar_casa_paz_url()` y su disparador `AFTER INSERT OR UPDATE ON casa_de_paz_cargo`. — *Req 1.1, 3.1*
- [ ] 3.2 Verificar que asignar `LIDER_CDP` a una persona crea una `casa_paz_url` con `estado = INACTIVO`. — *Req 1.1, 1.7*
- [ ] 3.3 Verificar que un líder con dos Casas de Paz vigentes obtiene dos URL distintas, cada una fija a su CdP. — *Req 1.2, 1.3*
- [ ] 3.4 Verificar que cerrar (`fecha_fin`) el `casa_de_paz_cargo` de un líder pone su URL en `INACTIVO` y llena `fecha_desactivacion`. — *Req 3.1, 3.2*
- [ ] 3.5 Verificar que asignar un líder nuevo a esa misma CdP crea una URL nueva, y que la del líder anterior no se reutiliza ni se borra. — *Req 3.3, 3.4*
- [ ] 3.6 Verificar que el disparador no reacciona a cargos que no son `LIDER_CDP` (por ejemplo `SUBLIDER_CDP`, `ANFITRION`). — *Req 1.1*

## 4. Configuración

- [ ] 4.1 Sembrar `REGISTRO_URL_ACTIVO` en `configuracion_definicion`, `tipo = BOOLEANO`, `valor_defecto = 'false'`, `categoria = 'REGISTRO'`. — *Req 4.1, 4.2*
- [ ] 4.2 Verificar que una Iglesia nueva, sin fila en `configuracion_valor`, tiene `REGISTRO_URL_ACTIVO = false`. — *Req 4.2*
- [ ] 4.3 Verificar que el Supervisor puede cambiarlo con `fn_set_configuracion`, igual que cualquier otra perilla. — *Req 4.5*

## 5. Lectura pública

- [ ] 5.1 Crear `fn_resolver_url_registro(varchar)`. — *Req 5.1*
- [ ] 5.2 `GRANT EXECUTE` a `anon` y `authenticated`, sin `GRANT` de tabla alguna. — *Req 7.2*
- [ ] 5.3 Verificar que un slug inexistente, uno `INACTIVO` y uno con `REGISTRO_URL_ACTIVO = false` en su iglesia devuelven **la misma forma** de respuesta (`admite_registro: false`), indistinguibles entre sí. — *Req 5.2*
- [ ] 5.4 Verificar que la respuesta nunca incluye `persona_id`, `casa_de_paz_id` ni `iglesia_id`. — *Req 5.3*

## 6. Escritura pública

- [ ] 6.1 Crear `fn_registrar_persona_via_url(varchar, jsonb)` con los cuatro `INSERT` (persona, persona_detalle condicional, persona_llegada, casa_de_paz_membresia). — *Req 6.2, 6.3, 6.4*
- [ ] 6.2 `GRANT EXECUTE` a `anon` y `authenticated`, sin `GRANT` de tabla alguna. — *Req 7.1, 7.2*
- [ ] 6.3 Agregar el chequeo de límite de frecuencia (20 registros / 10 min por slug). — *Req 7.4*
- [ ] 6.4 Verificar que un slug no `ACTIVO` o con la iglesia en `REGISTRO_URL_ACTIVO = false` rechaza con `REGISTRO_URL_NO_DISPONIBLE` sin crear ninguna fila. — *Req 6.5*
- [ ] 6.5 Verificar que `iglesia_id` y `casa_de_paz_id` de las filas creadas **siempre** coinciden con los de la `casa_paz_url` resuelta, sin importar qué mande el cliente en `p_datos`. — *Req 6.6*
- [ ] 6.6 Verificar que la respuesta solo trae `nombre_completo` y `casa_de_paz_nombre`, ningún `id`. — *Req 6.7*
- [ ] 6.7 Verificar que `persona_llegada.motivo_llegada_id` apunta a `INVITACION_PERSONAL`, `invitado_por_id` al líder, y `casa_paz_url_id` a la URL usada. — *Req 6.3, 6.8*
- [ ] 6.8 Verificar que `persona.creado_por` queda `NULL` (no hay `auth.uid()`). — *Req 7.5*
- [ ] 6.9 Verificar que un `ci` duplicado revierte los cuatro `INSERT`, no solo el de `persona`. — *design.md#escritura-pública*
- [ ] 6.10 Aplicar los Campo_Configurable de `FORMULARIO_MEMBRESIA` (10-panel-supervisor) también a este camino de `INSERT`. — *Req 5.6*

## 7. Panel del Supervisor

- [ ] 7.1 Crear `pol_casa_paz_url_select` (lectura: `iglesia_id IN fn_mis_iglesias()`). — *Req 2.6*
- [ ] 7.2 Crear `pol_casa_paz_url_update` (`fn_es_operativo_en(iglesia_id)`), sin policy de `INSERT` ni `DELETE` para `authenticated`. — *Req 2.1, 2.2, 2.3*
- [ ] 7.3 Verificar que cambiar `estado` a `ACTIVO` la primera vez llena `fecha_activacion`. — *Req 2.4*
- [ ] 7.4 Verificar que un Usuario sin `fn_es_operativo_en` no puede cambiar `estado` (ni por RLS ni manipulando la petición). — *Req 2.2, 2.3*
- [ ] 7.5 Verificar que reactivar una URL `SUSPENDIDO` conserva el mismo `slug`. — *Req 2.7*

## 8. Seguridad (auditoría final)

- [ ] 8.1 Ejecutar la auditoría de RLS de `12-pruebas-curl` sobre `casa_paz_url` y `persona_llegada`: cero policies para `anon`. — *Req 7.1, 01-tenancy Req 4.7*
- [ ] 8.2 Confirmar con `\dp` (o el equivalente en el dashboard de Supabase) que `anon` **no** tiene `SELECT/INSERT/UPDATE/DELETE` en ninguna tabla nueva de este módulo. — *Req 7.1*
- [ ] 8.3 Confirmar que `anon` tiene exactamente dos `EXECUTE`: `fn_resolver_url_registro`, `fn_registrar_persona_via_url`. — *Req 7.2*
- [ ] 8.4 Prueba curl sin ningún header de autenticación: `GET`/`POST` contra las dos funciones deben funcionar; cualquier otro endpoint de datos de negocio debe devolver vacío o 401/403 igual que antes de este módulo. — *12-pruebas-curl*
- [ ] 8.5 **Hallazgo corregido en `20_permisos_explicitos.sql`, fuera del alcance funcional de este módulo pero descubierto al escribirlo:** ninguna de las 18 migraciones existentes (`00`–`18`) tenía un `REVOKE ALL ... FROM anon` ni un `GRANT SELECT/INSERT/UPDATE ... TO authenticated` explícito — solo `REVOKE DELETE` (`02_funciones_base.sql`). El aislamiento de las 44 tablas dependía de RLS + de lo que Supabase otorgó por defecto al crear el proyecto, no de un permiso versionado en el repo. `20_permisos_explicitos.sql` lo deja explícito para todas las tablas (incluidas las de este módulo), es puramente `GRANT`/`REVOKE` (no toca RLS ni datos) y se aplica al final de la cadena. Verificar tras aplicarlo: `SELECT * FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee = 'anon';` debe devolver cero filas.

## Dependencias

- [00-fundacion](../00-fundacion/) — esqueleto de tabla, auditoría, `trg_no_delete`.
- [01-tenancy-iglesias](../01-tenancy-iglesias/) — `fn_mis_iglesias`, `fn_es_operativo_en`; y la excepción a su Req 4.6.
- [02-persona-parentela](../02-persona-parentela/) — validaciones de `persona`/`persona_detalle` que este módulo reutiliza sin duplicar.
- [03-estructura](../03-estructura/) — `casa_de_paz_cargo`, `casa_de_paz_membresia`, `cargo` (`LIDER_CDP`).
- [10-panel-supervisor](../10-panel-supervisor/) — motor de Configuracion (`fn_config_bool`, `fn_set_configuracion`, `fn_panel_configuracion`), Campo_Configurable de `FORMULARIO_MEMBRESIA`.

## Bloquea a

- El frontend del formulario público (`Fase D`) no puede construirse hasta que las tareas de la sección 6 estén verificadas contra el Supabase real, no solo contra el SQL local.

## Orden de aplicación

Este módulo es el archivo `19_registro_publico.sql`, el último de la cadena: se aplica **después** de `18_validaciones.sql` (los `INSERT` de `fn_registrar_persona_via_url` dependen de que toda restricción de `persona`/`persona_detalle` ya exista). Como `16_rls.sql` solo cubre las tablas `00`–`15`, `19_registro_publico.sql` habilita RLS y crea sus propias políticas para `casa_paz_url` de forma autocontenida — mismo patrón que usa `08_estructura.sql` al cerrar el "ciclo 2" con un `ALTER TABLE` después de que la tabla referenciada ya existe.
