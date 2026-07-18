# Tareas — Esquema de Base de Datos

## 0. Aprobación del owner

**Antes de tocar Supabase.**

- [ ] 0.1 Presentar al owner el inventario de 40 tablas de [design.md](design.md#inventario). — *Req 7.1*
- [ ] 0.2 Presentar la lista de decisiones pendientes de confirmar. — *Req 7.2*
- [ ] 0.3 Obtener la aprobación explícita. **No aplicar nada antes.** — *Req 7.3*

### Decisiones pendientes de confirmar

| # | Decisión | Área |
|---|----------|------|
| 1 | ¿La viuda conserva el apellido de casada? El diseño asume que sí. | [02](../02-persona-parentela/tasks.md) |
| 2 | ¿"Familia" es hogar o linaje? Si es hogar, `ABUELO` no debe contar. | [02](../02-persona-parentela/tasks.md) |
| 3 | ¿El cruce red × ministerio muestra a quienes no tienen CdP? Hoy quedan fuera. | [03](../03-estructura/tasks.md) |
| 4 | Los 52 nombres de tema de cada uno de los 7 libros. | [04](../04-reporte-cdp/tasks.md) |
| 5 | ¿RE → CRE con 2 visitas? Sin esta regla, RE es terminal hasta el Módulo 4. | [05](../05-estados-ssva/tasks.md) |
| 6 | ¿Qué son RMS, AVIVATE, HOMBRES, DEBORAS y MOS? | [07](../07-calendario-eventos/tasks.md) |
| 7 | Umbrales del semáforo de inactividad (2 y 4 semanas). | [09](../09-dashboards/tasks.md) |
| 8 | `cuenta_para_familia` es global: el Supervisor de una iglesia cambiaría el conteo de otra. | [10](../10-panel-supervisor/tasks.md) |
| 9 | `SUPERVISOR_VISION` vs `SUPERVISOR_VISION_ACCION` — el front usa el segundo. | [06](../06-evangelismo-cdp/tasks.md) |

## 1. Estructura de migraciones

- [ ] 1.1 Crear el directorio `supabase/migrations/`. — *Req 1.1*
- [ ] 1.2 Nombrar cada archivo con prefijo numérico y nombre en español. — *Req 1.2*
- [ ] 1.3 Envolver cada migración en `BEGIN` / `COMMIT`. — *Req 1.7*
- [ ] 1.4 Usar `IF NOT EXISTS` y `CREATE OR REPLACE` en todo. — *Req 1.4*
- [ ] 1.5 Separar `migrations/`, `seeds/` y `test-data/`. — *Req 1.5, 1.6*

## 2. Migraciones (en este orden)

- [ ] 2.1 `00_extensiones.sql` — `pgcrypto`, `btree_gist`. — *Req 2.1*
- [ ] 2.2 `01_enums.sql` — los 8 tipos enumerados. — *Req 2.2*
- [ ] 2.3 `02_funciones_base.sql` — `fn_auditoria`, `fn_bloquear_delete`. — *00-fundacion*
- [ ] 2.4 `03_tenancy.sql` — `cobertura`, `iglesia` **sin** `pastor_id` ni `supervisor_id`. — *Req 2.6*
- [ ] 2.5 `04_persona.sql` — `persona`, `persona_detalle`, y `ALTER TABLE iglesia` para cerrar el ciclo 1. — *Req 2.6*
- [ ] 2.6 `05_funciones_acceso.sql` — las 5 funciones + `usuario_rol`. — *Req 2.4*
- [ ] 2.7 `06_configuracion.sql` — **antes que los estados**. — *Req 2.5*
- [ ] 2.8 `07_contacto.sql` — direcciones y teléfonos **sin** `casa_de_paz_id`. — *Req 2.6*
- [ ] 2.9 `08_estructura.sql` — estructura + `ALTER TABLE` para cerrar el ciclo 2. — *Req 2.6*
- [ ] 2.10 `09_parentela.sql`
- [ ] 2.11 `10_reporte.sql`
- [ ] 2.12 `11_estados.sql` — **después de 06 y 10**. — *Req 2.5*
- [ ] 2.13 `12_evangelismo.sql`
- [ ] 2.14 `13_calendario.sql`
- [ ] 2.15 `14_finanzas.sql`
- [ ] 2.16 `15_permisos.sql`
- [ ] 2.17 `16_rls.sql` — **después de todas las funciones**. — *Req 2.4*
- [ ] 2.18 `17_dashboards.sql`
- [ ] 2.19 `18_validaciones.sql`

## 3. Semillas

- [ ] 3.1 `seed_01_catalogos_globales.sql` con `ON CONFLICT DO UPDATE`. — *Req 4.1, 4.4*
- [ ] 3.2 Enlazar los inversos de `tipo_relacion` en un segundo paso y validar la restricción. — *02-persona Req 7.7*
- [ ] 3.3 `seed_02_configuracion.sql` — las ~25 definiciones. — *Req 4.2*
- [ ] 3.4 `seed_03_despliegue.sql` — cobertura + 2 iglesias. — *Req 4.5*
- [ ] 3.5 Verificar que **Cochabamba no se siembra**. — *Req 4.6*
- [ ] 3.6 `seed_04_por_iglesia.sql` — 14 ministerios, 4 departamentos, 364 temas por iglesia. — *Req 4.3*
- [ ] 3.7 Ejecutar todas las semillas dos veces y confirmar que no duplican. — *Req 4.4*

## 4. Auditoría del esquema

**Las cuatro consultas tienen que devolver cero filas.** Si alguna devuelve algo, el esquema no está listo.

- [ ] 4.1 Tablas sin RLS. — *Req 3.1, 3.5*
- [ ] 4.2 Tablas de dominio sin `fecha_creacion`. — *Req 3.2, 3.6*
- [ ] 4.3 Funciones `SECURITY DEFINER` sin `search_path` fijo. **Es de seguridad real**: sin `search_path`, la función se puede secuestrar creando un objeto homónimo en un esquema anterior, y corre con privilegios de su dueño. — *Req 3.7*
- [ ] 4.4 Tablas sin `trg_no_delete`. — *Req 3.4*
- [ ] 4.5 Verificar que las cuatro dan cero filas. — *Req 3.8*
- [ ] 4.6 Guardar las cuatro en `harness/12-pruebas-curl/auditoria.sql` para reejecutarlas en cada despliegue. — *Req 3.5*

## 5. Índices

- [ ] 5.1 Crear los 7 índices no obvios de [design.md](design.md#índices). — *Req 5.1, 5.2*
- [ ] 5.2 Verificar que toda columna `iglesia_id` está indexada. — *Req 5.1*
- [ ] 5.3 Verificar que los índices de vigencia son parciales con `WHERE fecha_eliminacion IS NULL`. — *Req 5.3*
- [ ] 5.4 Verificar que las reglas de unicidad de una sola tabla usan índice y no disparador. — *Req 5.4*
- [ ] 5.5 Verificar que las que necesitan otra tabla usan disparador. Un índice parcial con subconsulta **falla al crearse**: el predicado debe ser inmutable. — *Req 5.5*

## 6. Aplicación

- [ ] 6.1 Aplicar todo sobre una base vacía. Sin errores. — *Req 1.3*
- [ ] 6.2 Aplicar todo **dos veces**. Sin errores. — *Req 1.4*
- [ ] 6.3 Verificar que una migración que falla a la mitad revierte completa. — *Req 1.7*
- [ ] 6.4 Documentar cómo revertir cada migración. — *Req 6.1*
- [ ] 6.5 Documentar el `DROP SCHEMA public CASCADE` y que **deja de ser opción** con la primera CdP real. — *Req 6.2, 6.3*

## 7. Datos de prueba

- [ ] 7.1 `test_01_estructura.sql` — 2 iglesias, 6 redes, 30 CdP con líderes y encargados. — *Req 1.6*
- [ ] 7.2 `test_02_personas.sql` — 3.000 personas con edades y estados variados. Incluir menores de 12, personas sin `fecha_nacimiento` y personas sin CI. — *Req 1.6*
- [ ] 7.3 `test_03_reportes.sql` — **52 semanas de reportes con asistencia por persona**. Sin esto no se puede probar ni un criterio de estado. — *05-estados*
- [ ] 7.4 Incluir en `test_03` los casos límite: alguien que falta y vuelve, alguien ausente 100 días, alguien que va 8 veces a otra CdP. — *05-estados*
- [ ] 7.5 `test_04_finanzas.sql` — ingresos en BOB y algunos en USD. — *08-finanzas*
- [ ] 7.6 Verificar que los datos de prueba **nunca** se aplican en producción. — *Req 1.6*

## Dependencias

Todas las áreas: este documento las consolida.

## Bloquea a

[12-pruebas-curl](../12-pruebas-curl/) y todo lo demás. Sin esquema aplicado no hay nada que probar.
