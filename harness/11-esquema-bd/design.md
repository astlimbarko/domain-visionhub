# Diseño — Esquema de Base de Datos

## Resumen

El mapa completo del Módulo 1: qué tablas existen, en qué orden se crean y cómo se verifica que ninguna quedó desprotegida.

**Este es el documento que el owner tiene que aprobar antes de que se cree nada en Supabase.**

## Inventario

~43 tablas (el conteo original más `moneda`, `iglesia_moneda` y `familia_override`, agregadas el 2026-07-17). Las reglas de cada una están en el área correspondiente.

### Tenancy y acceso — [01](../01-tenancy-iglesias/)

| Tabla | Qué guarda |
|-------|-----------|
| `cobertura` | Agrupación apostólica. Jerarquía vía `cobertura_padre_id`. |
| `moneda` | Catálogo de monedas (BOB, USD, BRL, ARS, PYG). Reemplaza al `moneda_enum` original. |
| `iglesia_moneda` | Qué monedas están activas para cada iglesia. |
| `iglesia` | El tenant. `iglesia_padre_id`, `pastor_id`, `supervisor_id`, `prefijo`/`sufijo` (nombre calculado), `moneda_defecto_id`. |
| `usuario_rol` | Rol de software por usuario y por iglesia. Roles de dominio: `SUPER_ADMIN`, `PASTOR`, `SUPERVISOR_VISION_ACCION`, `LIDER_RED`, `LIDER_CDP`, `SUBLIDER_CDP`. |

### Persona — [02](../02-persona-parentela/)

| Tabla | Qué guarda |
|-------|-----------|
| `persona` | Identidad. `usuario_id` nulable hacia `auth.users`. |
| `persona_detalle` | Datos censales. Uno a uno con `persona`. |
| `direccion` | Datos físicos de una dirección. |
| `direccion_asignacion` | A quién pertenece. Tres FK, exactamente una llena. |
| `telefono` | Datos del teléfono. |
| `telefono_asignacion` | A quién pertenece. |
| `tipo_telefono` | Catálogo global. |
| `motivo_llegada` | Catálogo global. |
| `persona_llegada` | Cómo y cuándo llegó a la iglesia. |
| `tipo_relacion` | Catálogo global. `inverso_id`. (`cuenta_para_familia` se movió a `configuracion_valor`, por iglesia.) |
| `familia` | Relación entre dos personas. Simétrica por disparador. |
| `familia_override` | Ajuste manual: incluir o excluir a una persona del núcleo calculado. |
| `referencia_familiar` | Familiar en texto libre, no registrado. |

### Estructura — [03](../03-estructura/)

| Tabla | Qué guarda |
|-------|-----------|
| `red` | Agrupación de CdP. |
| `casa_de_paz` | La unidad básica. `meta_evangelismo` se agrega en [06](../06-evangelismo-cdp/). |
| `casa_de_paz_red` | Historial de pertenencia a red. |
| `cargo` | Catálogo global. Tipo A/B, nivel. |
| `persona_cargo` | Historial de cargos sin ámbito. |
| `red_cargo` | Historial de cargos de red. |
| `casa_de_paz_cargo` | Historial de cargos de CdP, incluye anfitrión. |
| `casa_de_paz_membresia` | Historial de membresía. `es_principal`. |
| `ministerio` | Por iglesia. **Sin `red_id`**, y esa ausencia es la regla. |
| `ministerio_persona` | Historial de participación. `es_lider`. |
| `departamento` | Los 4, por iglesia, activables. |

### Reporte — [04](../04-reporte-cdp/)

| Tabla | Qué guarda |
|-------|-----------|
| `cdp_libro` | Los 7 tomos. Global. |
| `cdp_tema` | Temas. `iglesia_id` nulable: global o propio. |
| `casa_de_paz_reporte` | La reunión semanal. |
| `casa_de_paz_asistencia` | **Una fila por persona presente.** No hay filas de ausentes. |

### Estados — [05](../05-estados-ssva/)

| Tabla | Qué guarda |
|-------|-----------|
| `estado` | SIM, NC, CRE, RE activos. DA y DI inactivos. |
| `persona_estado` | Historial de estado. `motivo`, `es_automatico`. |
| `migracion_propuesta` | Migración detectada, pendiente de que un líder la resuelva. |

### Evangelismo — [06](../06-evangelismo-cdp/)

| Tabla | Qué guarda |
|-------|-----------|
| `evangelismo` | `escala` con 4 valores, restringida a `CASA_DE_PAZ` por `CHECK`. |
| `meta_evangelismo_asignada` | Meta con vigencia. Sin solapamiento por `EXCLUDE`. |

### Calendario — [07](../07-calendario-eventos/)

| Tabla | Qué guarda |
|-------|-----------|
| `tipo_evento` | Catálogo. `iglesia_id` nulable. |
| `evento` | Rango de fechas y horas. CdP o Red, exactamente una. |

### Finanzas — [08](../08-finanzas-cdp/)

| Tabla | Qué guarda |
|-------|-----------|
| `finanzas_tipo_ingreso` | Catálogo. `iglesia_id` nulable. |
| `finanzas_ingreso` | `NUMERIC(12,2)` + moneda. Nunca `FLOAT`. |

### Configuración — [10](../10-panel-supervisor/)

| Tabla | Qué guarda |
|-------|-----------|
| `configuracion_definicion` | Catálogo global de perillas, con tipos y rangos. |
| `configuracion_valor` | Valor por iglesia. |

> **`criterio_definicion` y `criterio_valor` NO se crean.** Son el mismo motor que `configuracion_*`. [05-estados-ssva](../05-estados-ssva/design.md) las describe para explicar el motor en su contexto, pero la implementación es única. `fn_criterio` es un alias de `fn_config_num`.

## Orden de aplicación

El orden lo dictan las dependencias, no el número de área. Hay dos ciclos que resolver.

```
00_extensiones.sql
    pgcrypto (gen_random_uuid), btree_gist (EXCLUDE de metas)

01_enums.sql
    sexo, estado_civil, grado_instruccion, rol_sistema (6 valores de dominio),
    tipo_cargo, escala_evangelismo, tipo_configuracion, familia_override_tipo
    -- moneda YA NO es enum: es tabla, ver 03_tenancy.sql

02_funciones_base.sql
    fn_auditoria(), fn_bloquear_delete()

03_tenancy.sql
    cobertura, moneda, iglesia_moneda, iglesia (SIN pastor_id ni supervisor_id todavia)

04_persona.sql
    persona, persona_detalle
    ALTER TABLE iglesia ADD pastor_id, supervisor_id   <-- cierra el ciclo 1

05_funciones_acceso.sql
    fn_es_super_admin, fn_mi_persona_id, fn_mis_iglesias,
    fn_es_pastor_en, fn_es_operativo_en
    usuario_rol + su disparador de validacion

06_configuracion.sql                                   <-- ANTES que los disparadores de estado
    configuracion_definicion, configuracion_valor
    fn_config_raw/bool/num/txt, fn_criterio

07_contacto.sql
    direccion, telefono y sus asignaciones (SIN casa_de_paz_id)
    tipo_telefono, motivo_llegada, persona_llegada

08_estructura.sql
    red, casa_de_paz, casa_de_paz_red
    cargo, persona_cargo, red_cargo, casa_de_paz_cargo
    casa_de_paz_membresia, ministerio, ministerio_persona, departamento
    ALTER TABLE direccion_asignacion ADD casa_de_paz_id  <-- cierra el ciclo 2
    ALTER TABLE telefono_asignacion  ADD casa_de_paz_id

09_parentela.sql
    tipo_relacion, familia, familia_override, referencia_familiar
    fn_familia_simetria, fn_nucleos_familiares, fn_total_familias

10_reporte.sql
    cdp_libro, cdp_tema, casa_de_paz_reporte, casa_de_paz_asistencia
    v_reporte_totales, fn_visitas_consecutivas

11_estados.sql                                         <-- despues de 06 y 10
    estado, persona_estado, migracion_propuesta
    fn_transicionar_estado, fn_evaluar_estado_por_asistencia
    trg_evaluar_estado sobre casa_de_paz_asistencia

12_evangelismo.sql
    evangelismo, meta_evangelismo_asignada
    ALTER TABLE casa_de_paz ADD meta_evangelismo
    fn_meta_efectiva, fn_tasa_evangelismo
    v_reporte_evangelismo   <-- necesita evangelismo + reporte

13_calendario.sql
    tipo_evento, evento, fn_eventos_cdp, fn_cumpleanos_cdp
    ALTER TABLE casa_de_paz_reporte ADD evento_megafiesta_id  <-- cierra el ciclo 3
    fn_validar_reporte_megafiesta + su disparador

14_finanzas.sql
    finanzas_tipo_ingreso, finanzas_ingreso
    fn_ingresos_cdp/red/iglesia, fn_registrar_ingresos_reporte

15_permisos.sql
    fn_puede_reportar_cdp, fn_es_lider_cdp, fn_es_sublider_cdp,
    fn_es_rol_superior_de_cdp, fn_es_lider_de_red, fn_mi_rol_operativo

16_rls.sql                                             <-- despues de TODAS las funciones
    ENABLE ROW LEVEL SECURITY + politicas de las 40 tablas

17_dashboards.sql
    fn_dashboard_*, fn_alertas_supervisor, fn_conteo_estados

18_validaciones.sql
    fn_validar_campos_reporte y demas disparadores que leen configuracion

19_registro_publico.sql                                <-- 13-registro-publico-cdp
    casa_paz_url, fn_resolver_url_registro, fn_registrar_persona_via_url
    ALTER TABLE persona_llegada ADD casa_paz_url_id

20_permisos_explicitos.sql                             <-- al final de todo
    GRANT/REVOKE explicito de tabla para anon/authenticated (ver Riesgos:
    ninguna migracion anterior lo declaraba a proposito, incluido este mismo
    comentario, que decia "REVOKE anon" en 16_rls.sql sin que el archivo
    realmente lo hiciera -- corregido el 2026-07-18)
```

### Los tres ciclos

**`iglesia.pastor_id` → `persona.iglesia_id` → `iglesia`.** La primera iglesia se inserta antes que su pastor, porque el pastor es una persona que necesita una iglesia. Se rompe creando `iglesia` sin esas dos columnas en `03` y agregándolas con `ALTER TABLE` en `04`.

**`direccion_asignacion.casa_de_paz_id` → `casa_de_paz`.** Las direcciones se crean antes que la estructura porque `persona` las necesita. Se rompe con `ALTER TABLE` en `08`.

**`casa_de_paz_reporte.evento_megafiesta_id` → `evento`.** El reporte semanal ([04-reporte-cdp](../04-reporte-cdp/design.md#megafiesta-de-casas-de-paz), agregado 2026-07-17) se crea en `10`, antes de que exista `evento` en `13`. Se rompe igual que los otros dos: `casa_de_paz_reporte` nace sin esa columna en `10`, y se agrega con `ALTER TABLE` en `13`, junto con el disparador que la valida.

### El orden que más importa

`06_configuracion.sql` va **antes** que `11_estados.sql`. Los disparadores de estado llaman a `fn_criterio`, que vive en el motor de configuración. Al revés, `11` falla al crear la función.

`16_rls.sql` va **al final**. Las políticas invocan funciones que tienen que existir. Poner RLS junto a cada tabla parece más ordenado y no funciona: `pol_persona_select` llama a `fn_mis_iglesias`, que consulta `iglesia` y `usuario_rol`, que se crean después.

## Semillas

```
seed_01_catalogos_globales.sql
    moneda (5: BOB, USD, BRL, ARS, PYG)
    cargo (21), estado (6), tipo_relacion (12), tipo_telefono (5),
    motivo_llegada (5), cdp_libro (7),
    cdp_tema (9: Libros 1-3 x Temas 1-3, provisional -- ver 04-reporte-cdp)
    tipo_evento (8: RMS, AVIVATE, ELITE_LINAJE_ESCOGIDO, MUJERES_DEL_AHORA, MOS,
                 REUNION, MEGA_FIESTA, CUMPLEANOS)
    finanzas_tipo_ingreso (4)

seed_02_configuracion.sql
    configuracion_definicion (~25 + 12 FAMILIA_CUENTA_* + 2 DIAS_SEMAFORO_* = ~39)

seed_03_despliegue.sql
    cobertura "Red Apostolica del Ap. Edgar Ortuno"
    iglesia (prefijo "Centro de Vida", sufijo "4 Anillo") -- Santa Cruz
    iglesia (prefijo "Centro de Vida", sufijo "Montero")  -- Montero
    -- Cochabamba NO
    iglesia_moneda: BOB activa=true y USD activa=true, para cada una de las 2 iglesias

seed_04_por_iglesia.sql
    Por cada iglesia: 14 ministerios, 4 departamentos
    -- Los temas (52 x 7 libros) NO se siembran por iglesia: ver seed_01, son 9 provisionales
```

Idempotencia (Requisito 4.4):

```sql
INSERT INTO cargo (codigo, nombre, tipo, nivel, orden)
VALUES ('PASTOR', 'Pastor', 'A', 'IGLESIA', 2)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, nivel = EXCLUDED.nivel;
```

`ON CONFLICT DO UPDATE` y no `DO NOTHING`: permite corregir un nombre mal escrito reejecutando la semilla. `DO NOTHING` dejaría el error para siempre.

Los enlaces de inverso van en un segundo paso, porque el tipo al que apuntar no existe en el primero:

```sql
UPDATE tipo_relacion t SET inverso_id = i.id
FROM tipo_relacion i
WHERE (t.codigo, i.codigo) IN (
  ('PADRE','HIJO'), ('HIJO','PADRE'), ('ABUELO','NIETO'), ('NIETO','ABUELO'),
  ('CONYUGE','CONYUGE'), ('HERMANO','HERMANO'), ('PRIMO','PRIMO'),
  ('TIO','SOBRINO'), ('SOBRINO','TIO'), ('CUNADO','CUNADO'),
  ('SUEGRO','YERNO'), ('YERNO','SUEGRO')
);
ALTER TABLE tipo_relacion VALIDATE CONSTRAINT chk_tipo_relacion_inverso;
```

## Auditoría del esquema

Las tres consultas del Requisito 3. Las tres tienen que devolver **cero filas**.

### Tablas sin RLS

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
```

### Tablas de dominio sin auditoría

```sql
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.tablename
      AND c.column_name = 'fecha_creacion'
  );
```

### Funciones SECURITY DEFINER sin search_path

```sql
SELECT p.proname
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prosecdef
  AND (p.proconfig IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM unnest(p.proconfig) cfg
         WHERE cfg LIKE 'search_path=%'
       ));
```

Esta última es de seguridad real: una función `SECURITY DEFINER` sin `search_path` fijo se puede secuestrar creando un objeto homónimo en un esquema anterior del path. Corre con privilegios de su dueño, así que el secuestro es total.

### Tablas sin bloqueo de DELETE

```sql
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tr
    JOIN pg_class c ON c.oid = tr.tgrelid
    WHERE c.relname = t.tablename
      AND tr.tgname LIKE 'trg_no_delete%'
  );
```

### Privilegios de tabla otorgados a `anon` (agregada 2026-07-18, `20_permisos_explicitos.sql`)

```sql
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon';
```

Cero filas esperadas. Las tres consultas anteriores auditan RLS, auditoría y `DELETE`; ninguna audita el permiso de tabla en sí — un `GRANT` directo a `anon` en una tabla sin RLS pasaría las otras tres y de todos modos filtraría datos. Esta consulta es la que hubiera detectado que, hasta el 2026-07-18, ninguna migración revocaba explícitamente el acceso de tabla de `anon` (ver Riesgos).

## Índices

Los que no son obvios y hay que crear a propósito:

| Índice | Por qué |
|--------|---------|
| `idx_persona_iglesia` | RLS filtra por `iglesia_id` en cada consulta de persona. |
| `idx_asistencia_persona` | `fn_visitas_consecutivas` lo consulta 3 veces por asistencia registrada. |
| `idx_reporte_cdp_fecha` (DESC) | "Últimas 8 reuniones" y "última reunión" ordenan descendente. |
| `casa_de_paz_membresia (persona_id) WHERE es_principal AND fecha_fin IS NULL` | El cruce red × ministerio pasa por acá. |
| `casa_de_paz_red (casa_de_paz_id) WHERE fecha_fin IS NULL` | Todo dashboard resuelve "la red de esta CdP". |
| `idx_ingreso_cdp_fecha` | Los totales financieros filtran por CdP y rango. |
| `idx_evangelismo_cdp_fecha` | La tasa de evangelismo y la vista de discrepancia. |

### Índice o disparador

El Requisito 5.4 dice: índice cuando alcanza, disparador cuando no. La frontera es si el predicado es **inmutable**.

| Regla | Cómo | Por qué |
|-------|------|---------|
| Un líder vigente por CdP | Disparador | El código del cargo vive en `cargo`. Un índice necesitaría subconsulta, y el predicado no sería inmutable. |
| Una membresía principal por persona | **Índice** | `es_principal` es columna de la misma tabla. |
| Un estado vigente por persona | **Índice** | `fecha_fin IS NULL`, misma tabla. |
| Un cargo Tipo A por persona | Disparador | El tipo vive en `cargo`. |
| Metas sin solapar | **`EXCLUDE`** | `daterange` de la misma tabla. |
| Un reporte por CdP y fecha | **Índice** | Ambas columnas de la misma tabla. |

Intentar un índice con subconsulta falla al crearlo, no en tiempo de ejecución. PostgreSQL lo rechaza directo.

## Datos de prueba

```
test_01_estructura.sql
    2 iglesias, 6 redes, 30 CdP, con lideres y encargados
test_02_personas.sql
    3.000 personas con edades y estados variados
test_03_reportes.sql
    52 semanas de reportes con asistencia por persona
test_04_finanzas.sql
    Ingresos en BOB y algunos en USD
```

Separados de las semillas (Requisito 1.6) y **nunca** en producción. `test_03` es el que importa: sin 52 semanas de asistencia por persona no se puede verificar ni un solo criterio de estado.

## Reversibilidad

Mientras no haya datos reales, el esquema se borra y se recrea (Requisito 6.2):

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
```

Es lo más rápido para iterar en la fase de documentación y pruebas. **Deja de ser una opción el día que entre la primera CdP real**, y desde ahí toda migración exige respaldo previo (Requisito 6.3).

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| RLS en un archivo al final | RLS junto a cada tabla | Las políticas invocan funciones que se crean después. |
| Configuración antes que estados | Orden por número de área | Los disparadores de estado llaman a `fn_criterio`. |
| `ALTER TABLE` para los ciclos | Tablas gigantes en una migración | Dos `ALTER` explícitos y documentados contra un archivo ilegible. |
| `ON CONFLICT DO UPDATE` en semillas | `DO NOTHING` | Permite corregir reejecutando. |
| Un motor de configuración | `criterio_*` + `configuracion_*` | Son idénticos. Dos tablas menos y un solo lugar donde auditar. |
| Consultas de auditoría en el harness | Confiar en la revisión | Una tabla sin RLS es una fuga de datos entre iglesias. Se verifica con SQL, no con la vista. |
| Tercer ciclo (`casa_de_paz_reporte` → `evento`) resuelto con `ALTER TABLE` | Crear `evento` antes que `casa_de_paz_reporte` | Reordenar el archivo de reportes rompería la numeración por área que el resto del harness ya usa como referencia cruzada. Un `ALTER TABLE` explícito en `13` es más legible que reordenar todo. |
| `GRANT`/`REVOKE` explícito de tabla en `20_permisos_explicitos.sql`, un archivo aparte al final | Agregar el `REVOKE` a `02_funciones_base.sql` y reaplicarlo | `02_funciones_base.sql` corre antes de que exista ninguna tabla de dominio (`ALL TABLES IN SCHEMA public` en ese punto solo alcanzaría tablas del sistema). El permiso de tabla solo se puede fijar a propósito una vez que todas las tablas existen — igual que RLS, por eso ambos van al final. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Una tabla nueva se crea sin RLS y queda abierta a todas las iglesias. | Es **el** riesgo del sistema. La consulta de auditoría corre en cada despliegue y tiene que dar cero filas. Idealmente, en CI. |
| Una función `SECURITY DEFINER` sin `search_path` se secuestra. | Consulta de auditoría. Cero filas. |
| El permiso de tabla de `anon`/`authenticated` dependía de lo que Supabase otorga por defecto al crear un proyecto, no de una declaración explícita en el repositorio (hallazgo del 2026-07-18, al escribir [13-registro-publico-cdp](../13-registro-publico-cdp/)). Si el esquema se reaplica desde cero en un proyecto nuevo, nada garantiza que ese default coincida. | `20_permisos_explicitos.sql`, al final de la cadena: `REVOKE ALL` de tabla a `anon` y `GRANT` explícito de `SELECT/INSERT/UPDATE` a `authenticated`, ambos fijados también en `ALTER DEFAULT PRIVILEGES` para que las tablas futuras hereden lo mismo sin depender del proyecto. Cuarta consulta de auditoría agregada arriba. |
| El orden de migraciones se rompe al agregar un área nueva. | El orden está en este documento. Toda migración nueva declara sus dependencias antes de escribirse. |
| Las 52 semanas de datos de prueba no se generan y los criterios nunca se prueban de verdad. | `test_03` es prerequisito de las pruebas de [05-estados-ssva](../05-estados-ssva/tasks.md). Sin datos, esas pruebas no corren. |
| El esquema se aplica en Supabase antes de que el owner lo apruebe. | Requisito 7.3. La aprobación es un paso explícito del flujo, no una formalidad. |
