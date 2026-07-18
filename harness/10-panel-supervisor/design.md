# Diseño — Panel del Supervisor

## Resumen

Un solo motor de configuración para todo el sistema: `configuracion_definicion` (global, con tipos y rangos) y `configuracion_valor` (por iglesia). Los criterios numéricos de [05-estados-ssva](../05-estados-ssva/design.md) son un caso particular del mismo motor.

## Un motor, no cinco

La tentación es una tabla por área: `config_dashboard`, `config_formulario`, `config_notificacion`. Cada una con su forma, su función de lectura y su política.

Se descarta. Todas responden la misma pregunta — *¿cuánto vale X en la iglesia Y?* — y un motor único significa una tabla, dos funciones de lectura, una política y un lugar donde auditar quién cambió qué. Agregar una perilla nueva es un `INSERT` en el catálogo, no una migración. Es el OCP de `Skills/solid.md` aplicado a la configuración: abierto a extensión, cerrado a modificación.

## Esquema

```sql
CREATE TYPE tipo_configuracion_enum AS ENUM ('BOOLEANO', 'NUMERICO', 'TEXTO');

CREATE TABLE configuracion_definicion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         VARCHAR(60) NOT NULL UNIQUE,
  nombre         VARCHAR(150) NOT NULL,
  descripcion    TEXT NOT NULL,
  tipo           tipo_configuracion_enum NOT NULL,
  valor_defecto  TEXT NOT NULL,
  valor_min      NUMERIC,
  valor_max      NUMERIC,
  unidad         VARCHAR(20),
  categoria      VARCHAR(40) NOT NULL,
  modulo         SMALLINT NOT NULL DEFAULT 1,
  activo         BOOLEAN NOT NULL DEFAULT true,
  orden          SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);

CREATE TABLE configuracion_valor (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id   UUID NOT NULL REFERENCES iglesia(id),
  definicion_id UUID NOT NULL REFERENCES configuracion_definicion(id),
  valor        TEXT NOT NULL
  -- auditoria: creado_por / actualizado_por responden el Req 1.6
);

CREATE UNIQUE INDEX uq_configuracion_valor
  ON configuracion_valor (iglesia_id, definicion_id) WHERE fecha_eliminacion IS NULL;
```

`valor` es `TEXT` y no una columna por tipo. Tres columnas nulables (`valor_bool`, `valor_num`, `valor_txt`) obligarían a un `CHECK` de "exactamente una llena" y a un `CASE` en cada lectura. `TEXT` más el `tipo` de la definición más validación en disparador es más simple, y el casteo lo hace la función de lectura.

`modulo` permite sembrar hoy las configuraciones de módulos futuros y ocultarlas del panel (Requisito 4.2). Igual que `DA` y `DI` en `estado`.

`descripcion` es `NOT NULL`: el Requisito 3.3 exige que el panel explique en español qué hace cada perilla. Una perilla sin explicación es una perilla que nadie toca o que alguien toca mal.

### Relación con `criterio_definicion`

[05-estados-ssva](../05-estados-ssva/design.md) define `criterio_definicion` y `criterio_valor` con la misma forma. **Son el mismo motor.**

Se unifican: `criterio_definicion` **es** `configuracion_definicion` con `categoria IN ('CDP', 'SSVA')`, y `fn_criterio()` es un alias de `fn_config_num()`:

```sql
CREATE OR REPLACE FUNCTION fn_criterio(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_config_num(p_iglesia_id, p_codigo);
$$;
```

Se mantiene el nombre `fn_criterio` porque es el vocabulario del dominio: `domain_knowledge/casas-de-paz/criterios.md` habla de criterios, no de configuraciones. El alias cuesta nada y hace que el código se lea como habla la iglesia.

**Al implementar: crear solo `configuracion_definicion` / `configuracion_valor`.** No crear las tablas `criterio_*` de [05-estados-ssva](../05-estados-ssva/design.md) — ese documento las describe para explicar el motor en su contexto, pero la implementación es única. Es una duplicación deliberada en la documentación, no en la base.

## Funciones de lectura

```sql
CREATE OR REPLACE FUNCTION fn_config_raw(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cv.valor FROM configuracion_valor cv
     JOIN configuracion_definicion cd ON cd.id = cv.definicion_id
     WHERE cv.iglesia_id = p_iglesia_id AND cd.codigo = p_codigo
       AND cv.fecha_eliminacion IS NULL),
    (SELECT cd.valor_defecto FROM configuracion_definicion cd WHERE cd.codigo = p_codigo)
  );
$$;

CREATE OR REPLACE FUNCTION fn_config_bool(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(fn_config_raw(p_iglesia_id, p_codigo)::boolean, false);
$$;

CREATE OR REPLACE FUNCTION fn_config_num(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_config_raw(p_iglesia_id, p_codigo)::numeric;
$$;

CREATE OR REPLACE FUNCTION fn_config_txt(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_config_raw(p_iglesia_id, p_codigo);
$$;
```

`fn_config_bool` devuelve `false` ante un código inexistente en vez de `NULL`. Es el valor seguro: si alguien escribe mal `SUBLIDER_VE_OFRENDAS`, el sublíder **no** ve las ofrendas. Un `NULL` en una condición `AND` también daría falso, pero devolver `false` explícito hace que el comportamiento no dependa de la lógica ternaria de SQL.

`fn_config_num` **no** hace `COALESCE`: un código de criterio inexistente debe explotar, no devolver cero. Un `VISITAS_PARA_CRE` que devuelve cero por un typo promovería a todo el mundo a CRE en silencio. Mejor un error ruidoso.

## Validación

```sql
CREATE OR REPLACE FUNCTION fn_validar_configuracion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d configuracion_definicion;
  v_num NUMERIC;
BEGIN
  SELECT * INTO d FROM configuracion_definicion WHERE id = NEW.definicion_id;

  -- Req 1.5: solo dentro de las iglesias accesibles
  IF NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'CONFIG_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Req 1.1: solo ADMIN de esa iglesia
  IF NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor en la iglesia %', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Req 2.5: tipo correcto
  CASE d.tipo
    WHEN 'BOOLEANO' THEN
      IF NEW.valor NOT IN ('true', 'false') THEN
        RAISE EXCEPTION 'CONFIG_TIPO_INVALIDO: % es booleano; recibido "%"', d.codigo, NEW.valor
          USING ERRCODE = 'P0001';
      END IF;

    WHEN 'NUMERICO' THEN
      BEGIN
        v_num := NEW.valor::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'CONFIG_TIPO_INVALIDO: % es numerico; recibido "%"', d.codigo, NEW.valor
          USING ERRCODE = 'P0001';
      END;

      -- Req 2.6: rango
      IF d.valor_min IS NOT NULL AND v_num < d.valor_min THEN
        RAISE EXCEPTION 'CONFIG_FUERA_DE_RANGO: % debe ser >= % (recibido %)', d.codigo, d.valor_min, v_num
          USING ERRCODE = 'P0001';
      END IF;
      IF d.valor_max IS NOT NULL AND v_num > d.valor_max THEN
        RAISE EXCEPTION 'CONFIG_FUERA_DE_RANGO: % debe ser <= % (recibido %)', d.codigo, d.valor_max, v_num
          USING ERRCODE = 'P0001';
      END IF;

    WHEN 'TEXTO' THEN
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;
```

El `BEGIN ... EXCEPTION` alrededor del casteo atrapa el error de PostgreSQL y lo cambia por uno con nombre de regla y código, en vez de dejar salir un `invalid input syntax for type numeric` que el front no puede interpretar. Cumple los Requisitos 9.1 y 9.2 de [00-fundacion](../00-fundacion/requirements.md).

## Semilla

### Criterios de CdP y SSVA

Los 8 de [05-estados-ssva](../05-estados-ssva/design.md#motor-de-criterios), con `categoria` `CDP` o `SSVA`. `CLASES_PARA_DI` y `ASISTENCIAS_PARA_DA` van con `modulo = 4` para que no aparezcan en el panel (Requisito 4.2).

### Familia

Los 12 códigos que reemplazan a `tipo_relacion.cuenta_para_familia` (ver [02-persona-parentela](../02-persona-parentela/design.md#tipo_relacion)), categoría `FAMILIA`, tipo `BOOLEANO`: `FAMILIA_CUENTA_CONYUGE` (defecto `true`), `FAMILIA_CUENTA_PADRE` (`true`), `FAMILIA_CUENTA_HIJO` (`true`), `FAMILIA_CUENTA_ABUELO` (`true`), `FAMILIA_CUENTA_NIETO` (`true`), `FAMILIA_CUENTA_HERMANO` (`false`), `FAMILIA_CUENTA_TIO` (`false`), `FAMILIA_CUENTA_SOBRINO` (`false`), `FAMILIA_CUENTA_PRIMO` (`false`), `FAMILIA_CUENTA_CUNADO` (`false`), `FAMILIA_CUENTA_SUEGRO` (`false`), `FAMILIA_CUENTA_YERNO` (`false`).

### Semáforo de inactividad de CdP

`DIAS_SEMAFORO_AMARILLO` (defecto 14, min 1, max 365, unidad días, categoría `CDP`) y `DIAS_SEMAFORO_ROJO` (defecto 28, min 1, max 365, unidad días, categoría `CDP`) — ver [09-dashboards](../09-dashboards/design.md#últimas-8-reuniones-no-últimas-8-semanas). Confirmado por el owner (PENDIENTES.md #7).

### Sublíder

| codigo | tipo | defecto | categoría |
|--------|------|---------|-----------|
| `SUBLIDER_VE_OFRENDAS` | BOOLEANO | `false` | DASHBOARD_SUBLIDER |
| `SUBLIDER_VE_GRAFICOS` | BOOLEANO | `false` | DASHBOARD_SUBLIDER |
| `SUBLIDER_VE_HISTORIAL` | BOOLEANO | `false` | DASHBOARD_SUBLIDER |
| `SUBLIDER_PUEDE_EDITAR_REPORTE` | BOOLEANO | `false` | DASHBOARD_SUBLIDER |
| `SUBLIDER_RECIBE_NOTIFICACIONES` | BOOLEANO | `false` | DASHBOARD_SUBLIDER |

Las cinco en `false` (Requisito 5.3), siguiendo `software/dashboards/sublider-cdp.md`. Es el mínimo privilegio de `Skills/solid.md`: se arranca cerrado y el Supervisor abre lo que decida.

### Formularios

| codigo | tipo | defecto |
|--------|------|---------|
| `MEMBRESIA_OCUPACION_OBLIGATORIO` | BOOLEANO | `false` |
| `MEMBRESIA_CI_OBLIGATORIO` | BOOLEANO | `false` |
| `MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO` | BOOLEANO | `false` |
| `MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO` | BOOLEANO | `false` |
| `REPORTE_TESTIMONIOS_OBLIGATORIO` | BOOLEANO | `false` |
| `REPORTE_COMENTARIOS_OBLIGATORIO` | BOOLEANO | `false` |
| `REPORTE_DISERTADOR_OBLIGATORIO` | BOOLEANO | `true` |
| `REPORTE_TEMA_OBLIGATORIO` | BOOLEANO | `true` |
| `REPORTE_SALIO_EVANGELIZAR_VISIBLE` | BOOLEANO | `true` |

### Otros

| codigo | tipo | defecto | categoría |
|--------|------|---------|-----------|
| `DIAS_AVISO_EVENTO` | NUMERICO | `7` | NOTIFICACION |
| `LIDER_VE_GRAFICOS` | BOOLEANO | `true` | DASHBOARD_LIDER |
| `LIDER_RED_VE_COMPARATIVAS` | BOOLEANO | `true` | DASHBOARD_RED |

## Obligatoriedad configurable

El Requisito 6.3 exige validar en la base. Es la parte incómoda: el esquema no puede tener `NOT NULL` en un campo cuya obligatoriedad se decide en tiempo de ejecución (por eso `libro_id`, `tema_id` y `disertador_id` son nulables en [04-reporte-cdp](../04-reporte-cdp/design.md)).

```sql
CREATE OR REPLACE FUNCTION fn_validar_campos_reporte()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TEMA_OBLIGATORIO')
     AND NEW.tema_id IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "tema" es obligatorio en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_DISERTADOR_OBLIGATORIO')
     AND NEW.disertador_id IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "disertador" es obligatorio en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TESTIMONIOS_OBLIGATORIO')
     AND (NEW.testimonios IS NULL OR btrim(NEW.testimonios) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "testimonios" es obligatorio en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_COMENTARIOS_OBLIGATORIO')
     AND (NEW.comentarios IS NULL OR btrim(NEW.comentarios) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "comentarios" es obligatorio en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
```

El mensaje nombra el campo (Requisito 6.4) para que el front pueda marcarlo en rojo sin adivinar.

Los campos de texto se validan contra vacío y no solo contra nulo: `""` pasa un `NOT NULL` y no es un testimonio.

El Requisito 6.5 — no permitir marcar opcional un campo `NOT NULL` del esquema — se cumple no sembrando esas configuraciones. `fecha_reunion` es `NOT NULL` y no tiene perilla. Si alguien agrega `REPORTE_FECHA_OBLIGATORIO`, no rompe nada, pero es una perilla que no hace nada. Se revisa en la tarea 5.5.

Para el asterisco del front (Requisito 6.6):

```sql
CREATE OR REPLACE FUNCTION fn_config_formulario(p_iglesia_id UUID, p_formulario VARCHAR)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_object_agg(cd.codigo, fn_config_bool(p_iglesia_id, cd.codigo))
  FROM configuracion_definicion cd
  WHERE cd.categoria = p_formulario
    AND cd.activo
    AND cd.modulo <= 1
    AND cd.fecha_eliminacion IS NULL;
$$;
```

## El panel

```sql
CREATE OR REPLACE FUNCTION fn_panel_configuracion(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'iglesia', (SELECT jsonb_build_object('id', id, 'nombre', nombre,
                  'moneda_defecto', (SELECT codigo FROM moneda WHERE id = moneda_defecto_id))
                FROM iglesia WHERE id = p_iglesia_id),
    'categorias', (
      SELECT jsonb_object_agg(categoria, items)
      FROM (
        SELECT cd.categoria,
               jsonb_agg(jsonb_build_object(
                 'codigo', cd.codigo,
                 'nombre', cd.nombre,
                 'descripcion', cd.descripcion,      -- Req 3.3
                 'tipo', cd.tipo,
                 'valor_actual', fn_config_raw(p_iglesia_id, cd.codigo),
                 'valor_defecto', cd.valor_defecto,  -- Req 3.2
                 'valor_min', cd.valor_min,
                 'valor_max', cd.valor_max,
                 'unidad', cd.unidad,
                 'es_personalizado', EXISTS (
                   SELECT 1 FROM configuracion_valor cv
                   WHERE cv.iglesia_id = p_iglesia_id AND cv.definicion_id = cd.id
                     AND cv.fecha_eliminacion IS NULL
                 )
               ) ORDER BY cd.orden) AS items
        FROM configuracion_definicion cd
        WHERE cd.activo
          AND cd.modulo <= 1                          -- Req 4.2
          AND cd.fecha_eliminacion IS NULL
        GROUP BY cd.categoria
      ) x
    ),
    'departamentos', (
      SELECT jsonb_agg(jsonb_build_object('id', id, 'codigo', codigo, 'nombre', nombre, 'activo', activo))
      FROM departamento WHERE iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL
    ),
    'advertencia', 'Los cambios se aplican desde este momento. No se recalcula lo ya procesado.'
  );
END;
$$;
```

`es_personalizado` distingue "esta iglesia lo cambió" de "está usando el valor por defecto". El panel puede mostrar un "restablecer" solo donde tiene sentido.

`advertencia` viaja en la respuesta (Requisitos 3.4, 4.3, 9.3) para que el front no la tenga hardcodeada y el texto se cambie en un solo lugar.

## Catálogos editables

El Requisito 8.3 dice que las filas globales no se tocan. Es el mismo patrón `iglesia_id IS NULL` de `cdp_tema`, `tipo_evento` y `finanzas_tipo_ingreso`:

```sql
CREATE POLICY pol_catalogo_update ON finanzas_tipo_ingreso
  FOR UPDATE TO authenticated
  USING (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id))
  WITH CHECK (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id));
```

`iglesia_id IS NOT NULL` excluye las filas globales: no hay `UPDATE` posible sobre ellas desde la API, sin importar el rol. Se mueven solo por migración.

**Resuelto (2026-07-17): el Requisito 8.6 ya no se implementa como `UPDATE` sobre una columna de `tipo_relacion`.** Esta sección quedó obsoleta apenas se escribió, porque el problema que describía —"si el Supervisor de Montero marca `ABUELO`, también cambia el conteo de Santa Cruz"— es exactamente lo que el owner pidió evitar (PENDIENTES.md #8). Se tomó la opción que este documento ya recomendaba: `cuenta_para_familia` no es una columna de `tipo_relacion` (catálogo global) sino doce códigos de `configuracion_valor` (`FAMILIA_CUENTA_CONYUGE`, `FAMILIA_CUENTA_PADRE`, etc. — ver [02-persona-parentela](../02-persona-parentela/design.md#tipo_relacion)), cada uno con su fila por iglesia. No hace falta la política `pol_tipo_relacion_update`: el ajuste es un `UPSERT` normal sobre `configuracion_valor`, con la política estándar de esa tabla (`fn_es_operativo_en`), igual que cualquier otra perilla del panel.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Un motor único | Una tabla por área | Todas responden la misma pregunta. Una tabla, dos funciones, una política, un lugar donde auditar. |
| `valor TEXT` + tipo en la definición | Tres columnas nulables | Evita el `CHECK` de "exactamente una" y el `CASE` en cada lectura. |
| `criterio_*` unificado con `configuracion_*` | Dos motores paralelos | Son idénticos. `fn_criterio` queda como alias por vocabulario del dominio. |
| `fn_config_bool` devuelve `false` ante código inexistente | `NULL` | Valor seguro: un typo en `SUBLIDER_VE_OFRENDAS` **cierra**, no abre. |
| `fn_config_num` explota ante código inexistente | `COALESCE(…, 0)` | Un criterio que devuelve cero por un typo promovería a todos en silencio. |
| `descripcion NOT NULL` | Opcional | Una perilla sin explicación es una perilla mal usada. |
| `modulo` en la definición | Sembrar después | Permite tener las perillas del Módulo 4 ocultas hoy. |
| Obligatoriedad por disparador | `NOT NULL` en el esquema | Apagarla requeriría `ALTER TABLE`. |
| Texto vacío es tan inválido como nulo | Solo `NOT NULL` | `""` pasa un `NOT NULL` y no es un testimonio. |
| Advertencia en la respuesta | Hardcodeada en el front | Se cambia en un solo lugar y la app móvil la recibe igual. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El Supervisor mueve una perilla y no entiende por qué el pasado no cambia. | `advertencia` en la respuesta. Está en los Requisitos 3.4, 4.3 y 9.3 porque es la confusión más previsible. |
| Alguien agrega una configuración de obligatoriedad para un campo `NOT NULL` y la perilla no hace nada. | No rompe, pero engaña. Revisar en la tarea 5.5 que toda perilla de obligatoriedad apunte a una columna nulable. |
| `fn_config_bool` se llama por fila en las políticas RLS y frena las consultas. | Es `STABLE`: PostgreSQL la cachea dentro de la consulta. Verificar con `EXPLAIN ANALYZE` (tarea 8.3). |
| El front cachea la configuración y no ve los cambios del Supervisor. | La configuración se lee en cada carga de dashboard, no se cachea en el cliente. Si se cachea, invalidar al guardar. Revisar al conectar el front. |
