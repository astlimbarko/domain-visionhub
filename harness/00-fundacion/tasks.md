# Tareas — Fundación

Se ejecutan antes que cualquier otra área. Todo lo demás depende de esto.

## 1. Proyecto Supabase

- [ ] 1.1 Crear el proyecto en Supabase, región más cercana a Bolivia (`sa-east-1`, São Paulo). — *Req 1*
- [ ] 1.2 Guardar `SUPABASE_URL`, `ANON_KEY` y `SERVICE_ROLE_KEY` fuera del repositorio. Nunca commitear el `SERVICE_ROLE_KEY`. — *Req 8*
- [ ] 1.3 Verificar la versión de PostgreSQL: debe ser 13 o superior para tener `gen_random_uuid()` nativo. — *Req 1.2*
- [ ] 1.4 Fijar el timezone del proyecto en UTC y confirmar que `now()` devuelve `TIMESTAMPTZ`. — *Req 2.2*

## 2. Funciones base

- [ ] 2.1 Crear `fn_auditoria()` con `SECURITY DEFINER` y `SET search_path = public`. — *Req 2.2, 2.3, 2.4*
- [ ] 2.2 Verificar que `fn_auditoria()` sobrescribe `creado_por` aunque el cliente lo envíe. — *Req 2.4*
- [ ] 2.3 Verificar que `fn_auditoria()` conserva `fecha_creacion` en el `UPDATE`. — *Req 2.3*
- [ ] 2.4 Crear `fn_bloquear_delete()` que lanza excepción `P0001`. — *Req 3.2, 9.1*

## 3. Permisos globales

- [ ] 3.1 Ejecutar `REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated`. — *Req 3.2*
- [ ] 3.2 Ejecutar `ALTER DEFAULT PRIVILEGES ... REVOKE DELETE` para que las tablas futuras nazcan sin `DELETE`. — *Req 3.2*
- [ ] 3.3 Revocar todo acceso del rol `anon` al esquema `public`. Ningún dato de la iglesia es público. — *Req 8.3*

## 4. Plantilla de tabla

- [ ] 4.1 Escribir la plantilla SQL de tabla de dominio (UUID + campos de negocio + 6 de auditoría). — *Req 1, 2.1*
- [ ] 4.2 Escribir el bloque que toda tabla nueva debe ejecutar: `trg_auditoria_<tabla>`, `trg_no_delete_<tabla>`, `ENABLE ROW LEVEL SECURITY`, vista `v_<tabla>`. — *Req 2, 3, 8*
- [ ] 4.3 Documentar la plantilla en `11-esquema-bd/design.md` para que las demás áreas la copien sin variar. — *Req 4*

## 5. Catálogos

- [ ] 5.1 Escribir la plantilla de tabla de catálogo (`nombre`, `activo`, `orden` + auditoría). — *Req 5.4*
- [ ] 5.2 Crear `fn_catalogo_en_uso(p_tabla, p_id)` que devuelve si un valor de catálogo está referenciado por alguna fila vigente. — *Req 5.3*
- [ ] 5.3 Crear el disparador que impide el borrado lógico de un valor de catálogo en uso. — *Req 5.3*

## 6. Verificación

- [ ] 6.1 Crear una tabla de prueba con la plantilla y confirmar por curl que `creado_por` se llena solo. — *Req 2.2*
- [ ] 6.2 Confirmar por curl que `DELETE` sobre la tabla de prueba devuelve error `P0001`. — *Req 3.2*
- [ ] 6.3 Confirmar que un `UPDATE` con `fecha_eliminacion = now()` funciona y que la fila desaparece de `v_<tabla>`. — *Req 3.1, 3.3*
- [ ] 6.4 Confirmar que el `CHECK` de asignación única rechaza dos FK con valor a la vez. — *Req 6.3*
- [ ] 6.5 Confirmar que el índice único parcial rechaza dos `es_principal = true` para la misma persona. — *Req 6.4*
- [ ] 6.6 Borrar la tabla de prueba. — *Req 3.2 (requiere desactivar el disparador, lo cual confirma que la fricción existe)*

## Dependencias

Ninguna. Es la primera área.

## Bloquea a

Todas. Ninguna otra área puede empezar antes de completar el punto 4.
