# Diseño — Finanzas de Casa de Paz

## Resumen

Una tabla `finanzas_ingreso` con tipo, monto, moneda y origen. El formulario del reporte captura dos totales (ofrendas y diezmos) y el sistema los convierte en filas de ingreso.

La regla que gobierna todo: **las monedas no se suman entre sí, nunca**.

## Esquema

```sql
CREATE TABLE finanzas_tipo_ingreso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID REFERENCES iglesia(id),   -- NULL = global
  codigo      VARCHAR(30) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);

CREATE UNIQUE INDEX uq_tipo_ingreso_codigo
  ON finanzas_tipo_ingreso (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo)
  WHERE fecha_eliminacion IS NULL;
```

Semilla global: `OFRENDA`, `DIEZMO`, `PRIMICIA`, `PACTO`.

```sql
CREATE TABLE finanzas_ingreso (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id       UUID NOT NULL REFERENCES iglesia(id),
  tipo_ingreso_id  UUID NOT NULL REFERENCES finanzas_tipo_ingreso(id),
  reporte_id       UUID REFERENCES casa_de_paz_reporte(id),
  casa_de_paz_id   UUID REFERENCES casa_de_paz(id),
  persona_id       UUID REFERENCES persona(id),
  monto            NUMERIC(12,2) NOT NULL,
  moneda_id        UUID NOT NULL REFERENCES moneda(id),
  fecha            DATE NOT NULL,
  observaciones    TEXT,
  -- auditoria

  CONSTRAINT chk_ingreso_monto CHECK (monto > 0),
  CONSTRAINT chk_ingreso_fecha CHECK (fecha <= CURRENT_DATE)
);

CREATE INDEX idx_ingreso_cdp_fecha ON finanzas_ingreso (casa_de_paz_id, fecha)
  WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_ingreso_reporte ON finanzas_ingreso (reporte_id)
  WHERE fecha_eliminacion IS NULL;
```

### NUMERIC y no FLOAT

`NUMERIC(12,2)` es obligatorio. `FLOAT` y `DOUBLE PRECISION` son binarios y no representan exactamente los decimales: `0.1 + 0.2` da `0.30000000000000004`. Con dinero eso significa que el total de la iglesia no cuadra con la suma de las casas, y nadie va a saber por qué.

`NUMERIC` es decimal exacto. 12 dígitos con 2 decimales llegan a 9.999.999.999,99 — sobra para una ofrenda de casa de paz en bolivianos por varias vidas.

### persona_id nulable

El Requisito 1.3 lo exige. La ofrenda de una reunión es un monto en una bolsa: nadie sabe quién puso cuánto, y preguntarlo sería contrario a cómo funciona.

El diezmo sí viene en sobre con nombre (`domain_knowledge/casas-de-paz/reporte.md`), así que **podría** ser nominal. Pero el formulario actual solo pide el total. Se deja `persona_id` disponible para cuando se quiera registrar el diezmo por persona, sin migración.

## Moneda

**Tabla catálogo, no ENUM** (decisión del owner, mirar.txt #2, 2026-07-19): la plataforma debe soportar agregar monedas — Real, Peso argentino, Guaraní — sin exigir una migración por cada una. Un `ENUM` obligaría a `ALTER TYPE` cada vez; una tabla es un `INSERT`. Las tablas `moneda` e `iglesia_moneda` se definen en [01-tenancy-iglesias](../01-tenancy-iglesias/design.md#moneda) junto con `iglesia.moneda_defecto_id`, porque esa tabla las referencia.

Semilla: `BOB` (Boliviano, principal), `USD` (Dólar, secundaria pero ya activa por defecto en ambas iglesias), y `BRL`/`ARS`/`PYG` en el catálogo pero inactivas hasta que el Supervisor las active — tal como pidió el owner: "no tan notable, debe ser secundario".

```sql
CREATE OR REPLACE FUNCTION fn_ingreso_moneda_defecto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.moneda_id IS NULL THEN
    SELECT moneda_defecto_id INTO NEW.moneda_id FROM iglesia WHERE id = NEW.iglesia_id;
  END IF;
  RETURN NEW;
END;
$$;
```

Cierra el pendiente de `software/bd-modelo.md` (*"definir si se requiere una moneda por defecto"*): **sí**, y es `BOB` para las dos iglesias del despliegue.

### Solo monedas activadas por la iglesia

Que una moneda exista en el catálogo global no significa que esa iglesia la use. `iglesia_moneda.activa` decide qué monedas puede elegir el líder al registrar un ingreso:

```sql
CREATE OR REPLACE FUNCTION fn_validar_moneda_activa_iglesia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM iglesia_moneda im
    WHERE im.iglesia_id = NEW.iglesia_id
      AND im.moneda_id = NEW.moneda_id
      AND im.activa
      AND im.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'MONEDA_NO_ACTIVA: la moneda % no esta activada para esta iglesia', NEW.moneda_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_moneda_activa
  BEFORE INSERT OR UPDATE ON finanzas_ingreso
  FOR EACH ROW EXECUTE FUNCTION fn_validar_moneda_activa_iglesia();
```

Esto es lo que hace que agregar el Real o el Guaraní sea "secundario, no tan notable" tal como pidió el owner: la moneda existe en el catálogo apenas se siembra, pero no aparece como opción en el formulario de ninguna iglesia hasta que su Supervisor la activa explícitamente desde el panel.

### El agrupado obligatorio

El Requisito 3.5 dice que sumar monedas distintas sin agrupar es una consulta inválida. No se puede expresar como restricción de tabla: es una regla sobre cómo se consulta. Se hace cumplir con el diseño de las funciones — **ninguna** devuelve un total sin moneda.

```sql
CREATE OR REPLACE FUNCTION fn_ingresos_cdp(
  p_casa_de_paz_id UUID,
  p_desde DATE,
  p_hasta DATE
)
RETURNS TABLE (tipo_codigo VARCHAR, tipo_nombre VARCHAR, moneda_codigo CHAR(3), moneda_simbolo VARCHAR, total NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.codigo, t.nombre, m.codigo, m.simbolo, sum(i.monto)
  FROM finanzas_ingreso i
  JOIN finanzas_tipo_ingreso t ON t.id = i.tipo_ingreso_id
  JOIN moneda m ON m.id = i.moneda_id
  WHERE i.casa_de_paz_id = p_casa_de_paz_id
    AND i.fecha BETWEEN p_desde AND p_hasta
    AND i.fecha_eliminacion IS NULL
  GROUP BY t.codigo, t.nombre, m.codigo, m.simbolo, t.orden, m.orden
  ORDER BY t.orden, m.orden;
$$;
```

`moneda_codigo` está en el `GROUP BY` y en el retorno. No hay forma de llamar a esta función y obtener un número sin saber de qué moneda es. Esa es la protección: no se confía en que quien consulta se acuerde, se hace imposible olvidarlo. El cambio de `moneda_enum` a la tabla `moneda` (ver arriba) no toca esta garantía: se agrupa por moneda igual, ahora vía `moneda_id`/`m.codigo` en vez de un valor de enum.

Lo mismo en red e iglesia:

```sql
CREATE OR REPLACE FUNCTION fn_ingresos_red(p_red_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (casa_de_paz_nombre VARCHAR, tipo_codigo VARCHAR, moneda_codigo CHAR(3), moneda_simbolo VARCHAR, total NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.nombre, t.codigo, m.codigo, m.simbolo, sum(i.monto)
  FROM finanzas_ingreso i
  JOIN finanzas_tipo_ingreso t ON t.id = i.tipo_ingreso_id
  JOIN moneda m ON m.id = i.moneda_id
  JOIN casa_de_paz c ON c.id = i.casa_de_paz_id
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  WHERE cdr.red_id = p_red_id
    AND i.fecha BETWEEN p_desde AND p_hasta
    AND i.fecha_eliminacion IS NULL
  GROUP BY c.nombre, t.codigo, m.codigo, m.simbolo, t.orden, m.orden
  ORDER BY c.nombre, t.orden, m.orden;
$$;
```

### Comparación de períodos

```sql
CREATE OR REPLACE FUNCTION fn_ingresos_comparativo(
  p_casa_de_paz_id UUID,
  p_desde DATE,
  p_hasta DATE
)
RETURNS TABLE (
  moneda_id UUID,
  moneda_codigo CHAR(3),
  total_actual NUMERIC,
  total_anterior NUMERIC,
  variacion_pct NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH
  dias AS (SELECT (p_hasta - p_desde) AS n),
  actual AS (
    SELECT i.moneda_id, sum(i.monto) AS total
    FROM finanzas_ingreso i
    WHERE i.casa_de_paz_id = p_casa_de_paz_id
      AND i.fecha BETWEEN p_desde AND p_hasta
      AND i.fecha_eliminacion IS NULL
    GROUP BY i.moneda_id
  ),
  anterior AS (
    SELECT i.moneda_id, sum(i.monto) AS total
    FROM finanzas_ingreso i, dias d
    WHERE i.casa_de_paz_id = p_casa_de_paz_id
      AND i.fecha BETWEEN (p_desde - d.n - 1) AND (p_desde - 1)
      AND i.fecha_eliminacion IS NULL
    GROUP BY i.moneda_id
  ),
  monedas AS (
    SELECT moneda_id FROM actual UNION SELECT moneda_id FROM anterior
  )
  SELECT mo.moneda_id, m.codigo,
         COALESCE(a.total, 0),      -- Req 4.6: cero, no ausencia de fila
         COALESCE(p.total, 0),
         CASE
           WHEN COALESCE(p.total, 0) = 0 THEN NULL
           ELSE round(((COALESCE(a.total,0) - p.total) / p.total) * 100, 2)
         END
  FROM monedas mo
  JOIN moneda m ON m.id = mo.moneda_id
  LEFT JOIN actual a   ON a.moneda_id = mo.moneda_id
  LEFT JOIN anterior p ON p.moneda_id = mo.moneda_id;
$$;
```

El `UNION` de monedas más los `LEFT JOIN` cubren el Requisito 4.6: si este mes hubo dólares y el anterior no, sale la fila con `total_anterior = 0` en lugar de desaparecer. Una ausencia de fila se lee como "no hay datos"; un cero se lee como "no entró nada". Son cosas distintas.

`variacion_pct = NULL` cuando el período anterior fue cero: el crecimiento desde cero es infinito, no 100%. El front muestra "—" y no una flecha mentirosa.

## Integración con el reporte

El formulario pide dos totales (`domain_knowledge/casas-de-paz/reporte.md`): "Total ofrendas" y "Total diezmos". No son columnas de `casa_de_paz_reporte`: son ingresos.

```sql
CREATE OR REPLACE FUNCTION fn_registrar_ingresos_reporte(
  p_reporte_id UUID,
  p_total_ofrendas NUMERIC,
  p_total_diezmos NUMERIC,
  p_moneda_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte  casa_de_paz_reporte;
  v_moneda_id UUID;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  IF NOT fn_puede_reportar_cdp(v_reporte.casa_de_paz_id) THEN
    RAISE EXCEPTION 'INGRESO_SIN_PERMISO: no puede registrar ingresos de esta casa de paz'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(p_moneda_id, moneda_defecto_id) INTO v_moneda_id
  FROM iglesia WHERE id = v_reporte.iglesia_id;

  PERFORM fn_upsert_ingreso_reporte(p_reporte_id, 'OFRENDA', p_total_ofrendas, v_moneda_id);
  PERFORM fn_upsert_ingreso_reporte(p_reporte_id, 'DIEZMO',  p_total_diezmos,  v_moneda_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_upsert_ingreso_reporte(
  p_reporte_id UUID, p_tipo VARCHAR, p_monto NUMERIC, p_moneda_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte casa_de_paz_reporte;
  v_tipo_id UUID;
  v_existente UUID;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  SELECT id INTO v_tipo_id FROM finanzas_tipo_ingreso
  WHERE codigo = p_tipo AND (iglesia_id = v_reporte.iglesia_id OR iglesia_id IS NULL)
  ORDER BY iglesia_id NULLS LAST LIMIT 1;

  SELECT id INTO v_existente FROM finanzas_ingreso
  WHERE reporte_id = p_reporte_id AND tipo_ingreso_id = v_tipo_id
    AND moneda_id = p_moneda_id AND persona_id IS NULL
    AND fecha_eliminacion IS NULL;

  -- Req 6.4: cero o nulo no crea ingreso
  IF COALESCE(p_monto, 0) = 0 THEN
    IF v_existente IS NOT NULL THEN
      UPDATE finanzas_ingreso SET fecha_eliminacion = now() WHERE id = v_existente;
    END IF;
    RETURN;
  END IF;

  -- Req 6.5: actualizar, no crear otro
  IF v_existente IS NOT NULL THEN
    UPDATE finanzas_ingreso SET monto = p_monto WHERE id = v_existente;
  ELSE
    INSERT INTO finanzas_ingreso (
      iglesia_id, tipo_ingreso_id, reporte_id, casa_de_paz_id, monto, moneda_id, fecha
    ) VALUES (
      v_reporte.iglesia_id, v_tipo_id, p_reporte_id, v_reporte.casa_de_paz_id,
      p_monto, p_moneda_id, v_reporte.fecha_reunion
    );
  END IF;
END;
$$;
```

El *upsert* del Requisito 6.5 importa: sin él, el líder que corrige "500" a "550" deja dos ingresos y la ofrenda de esa noche pasa a ser 1.050.

`ORDER BY iglesia_id NULLS LAST` hace que el tipo propio de la iglesia gane sobre el global si ambos tienen el mismo código.

Reporte borrado, ingresos borrados (Requisito 6.6):

```sql
CREATE OR REPLACE FUNCTION fn_reporte_cascada_ingresos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_eliminacion IS NOT NULL AND OLD.fecha_eliminacion IS NULL THEN
    UPDATE finanzas_ingreso
    SET fecha_eliminacion = now()
    WHERE reporte_id = NEW.id AND fecha_eliminacion IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

Es la única cascada del sistema y es deliberada: un ingreso cuyo reporte no existe es un monto sin reunión, imposible de auditar. La regla general de [00-fundacion](../00-fundacion/design.md) (no borrar en cascada) protege el historial; acá el historial del ingreso **es** el reporte.

## Visibilidad

El Requisito 5.7 exige que la restricción esté en la base. Ocultar el monto solo en el front sería decorativo: el sublíder abre la consola del navegador y lee la respuesta de la API.

```sql
CREATE OR REPLACE FUNCTION fn_puede_ver_ingresos_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    fn_es_rol_superior_de_cdp(p_casa_de_paz_id)   -- pastor, supervisor, lider de red
    OR fn_es_lider_cdp(p_casa_de_paz_id)          -- Req 5.1
    OR (
      fn_es_sublider_cdp(p_casa_de_paz_id)        -- Req 5.2
      AND fn_config_bool(
        (SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id),
        'SUBLIDER_VE_OFRENDAS'
      )
    );
$$;

CREATE POLICY pol_ingreso_select ON finanzas_ingreso
  FOR SELECT TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fecha_eliminacion IS NULL
    AND (casa_de_paz_id IS NULL OR fn_puede_ver_ingresos_cdp(casa_de_paz_id))
  );
```

Con `SUBLIDER_VE_OFRENDAS = false`, el sublíder pide `/rest/v1/finanzas_ingreso` y recibe `[]`. No un 403: las filas simplemente no existen para él, coherente con el Requisito 4.4 de [01-tenancy](../01-tenancy-iglesias/requirements.md).

`fn_config_bool` se define en [10-panel-supervisor](../10-panel-supervisor/design.md).

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| `NUMERIC(12,2)` | `FLOAT` / `DOUBLE PRECISION` | El binario no representa decimales exactos. Los totales dejarían de cuadrar sin explicación. |
| Moneda en el `GROUP BY` de toda función | Confiar en quien consulta | Hace imposible olvidarla, en vez de pedir que se acuerde. |
| Sin conversión de monedas | Tabla de tipo de cambio | El Requisito 3.8 lo excluye. Un tipo de cambio implica fecha, fuente y política. Módulo 6. |
| Ingresos como filas, no columnas del reporte | `total_ofrendas` en `casa_de_paz_reporte` | Impediría desglosar por moneda, registrar primicias o el diezmo nominal. |
| Upsert por reporte + tipo + moneda | Insertar siempre | Corregir 500 a 550 dejaría dos filas y la ofrenda sería 1.050. |
| Cascada reporte → ingresos | Sin cascada | Única excepción a la regla de Fundación. Un ingreso sin reunión no se puede auditar. |
| `variacion_pct = NULL` si el anterior es cero | `100` o `0` | Crecer desde cero no es 100%. El front muestra "—". |
| `persona_id` nulable | Exigir persona | La ofrenda va en bolsa: nadie sabe quién puso cuánto. |
| `moneda` como tabla catálogo + `iglesia_moneda` | `moneda_enum` fijo | Decisión del owner (mirar.txt #2): agregar Real, Guaraní o Peso argentino debe ser un `INSERT`, no una migración con `ALTER TYPE`. La activación por iglesia (`iglesia_moneda.activa`) mantiene esas monedas "secundarias, no tan notables" hasta que el Supervisor las prenda. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Alguien escribe una consulta que suma `BOB` y `USD`. | Ninguna función expuesta lo permite. El riesgo queda en SQL ad-hoc. Documentarlo en [11-esquema-bd](../11-esquema-bd/) y revisarlo en cada consulta nueva de dashboard. |
| El líder registra en dólares por error y el total de la red se ve raro. | Los totales van agrupados por moneda, así que un `USD 500` aparece como fila aparte y se ve al instante. El formulario usa la moneda por defecto de la iglesia salvo que se cambie explícitamente. |
| `fn_puede_ver_ingresos_cdp` se ejecuta por fila y frena el dashboard financiero. | Envolver en `IN (SELECT ...)` cuando se pueda, y medir con `EXPLAIN ANALYZE`. Con decenas de CdP y cuatro filas por reporte, es irrelevante. |
| El diezmo nominal nunca se usa y `persona_id` queda muerta. | Una columna nulable sin uso no cuesta nada. Cuando se quiera el diezmo por persona, está. |
