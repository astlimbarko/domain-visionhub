# Diseño — Dashboards

## Resumen

Una función RPC por dashboard, que devuelve un JSON con todo lo que la pantalla necesita. El frontend pinta; no calcula.

## Una llamada por dashboard

El Requisito 7.3 dice "una o pocas llamadas". La alternativa — una llamada por tarjeta — daría diez peticiones para pintar el dashboard del líder, cada una con su latencia y su chance de fallar, y un dashboard a medio cargar donde los KPI de arriba no cuadran con la lista de abajo porque se leyeron en momentos distintos.

Una función, un JSON, una foto coherente:

```sql
CREATE OR REPLACE FUNCTION fn_dashboard_lider_cdp(
  p_casa_de_paz_id UUID,
  p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_resultado  JSONB;
  v_mes_desde  DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta  DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;

  -- SECURITY DEFINER salta RLS: hay que verificar a mano. No es opcional.
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin acceso a la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (fn_es_lider_cdp(p_casa_de_paz_id)
          OR fn_es_sublider_cdp(p_casa_de_paz_id)
          OR fn_es_rol_superior_de_cdp(p_casa_de_paz_id)) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: sin cargo vigente en la casa de paz %', p_casa_de_paz_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'casa_de_paz', (
      SELECT jsonb_build_object(
        'id', c.id, 'nombre', c.nombre,
        'red', (SELECT r.nombre FROM casa_de_paz_red cdr
                JOIN red r ON r.id = cdr.red_id
                WHERE cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL
                  AND cdr.fecha_eliminacion IS NULL),
        'miembros_total', (SELECT count(*) FROM casa_de_paz_membresia m
                           WHERE m.casa_de_paz_id = c.id AND m.fecha_fin IS NULL
                             AND m.fecha_eliminacion IS NULL),
        'ultima_reunion', (SELECT max(rep.fecha_reunion) FROM casa_de_paz_reporte rep
                           WHERE rep.casa_de_paz_id = c.id AND rep.fecha_eliminacion IS NULL)
      )
      FROM casa_de_paz c WHERE c.id = p_casa_de_paz_id
    ),

    'kpi', jsonb_build_object(
      'miembros_activos',   fn_kpi_miembros_activos(p_casa_de_paz_id, p_fecha),
      'asistencia_ultima',  fn_kpi_asistencia_ultima(p_casa_de_paz_id),
      'ingresos_mes',       (SELECT jsonb_agg(to_jsonb(x))
                             FROM fn_ingresos_cdp(p_casa_de_paz_id, v_mes_desde, v_mes_hasta) x)
    ),

    -- Req 2.3 y 2.7: ultimas 8 REUNIONES REPORTADAS, no ultimas 8 semanas
    'asistencia_historico', (
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.fecha_reunion)
      FROM (
        SELECT vt.fecha_reunion, vt.total_asistentes, vt.total_menores, vt.total_mayores
        FROM v_reporte_totales vt
        WHERE vt.casa_de_paz_id = p_casa_de_paz_id
        ORDER BY vt.fecha_reunion DESC
        LIMIT 8
      ) t
    ),

    'miembros', (
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.semanas_sin_venir DESC NULLS FIRST)
      FROM fn_lista_miembros_cdp(p_casa_de_paz_id) m
    ),

    'alertas', jsonb_build_object(
      'inactivos',    (SELECT jsonb_agg(to_jsonb(i))
                       FROM fn_inactividad_cdp(p_casa_de_paz_id) i WHERE i.supera_umbral),
      'reconciliados', (SELECT jsonb_agg(to_jsonb(r)) FROM fn_reconciliados_cdp(p_casa_de_paz_id) r),
      'simpatizantes', (SELECT jsonb_agg(to_jsonb(s)) FROM fn_simpatizantes_cdp(p_casa_de_paz_id) s)
    ),

    'proximos', (SELECT jsonb_agg(to_jsonb(p)) FROM fn_proximos_cdp(p_casa_de_paz_id) p)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
```

### La verificación de acceso no es opcional

Toda función de dashboard es `SECURITY DEFINER`, porque tiene que agregar sobre tablas que el usuario no lee fila por fila. Eso **salta RLS**. Sin la verificación explícita del principio, cualquier usuario autenticado pasaría el `casa_de_paz_id` de otra iglesia y recibiría el dashboard completo.

Es el mismo patrón de `fn_nucleos_familiares` en [02-persona-parentela](../02-persona-parentela/design.md). Se repite en cada función `SECURITY DEFINER` del sistema y es la tarea que no se puede saltear.

## Últimas 8 reuniones, no últimas 8 semanas

`software/dashboards/lider-cdp.md` dice "asistencia de las últimas 8 semanas". El Requisito 2.7 lo cambia a las últimas 8 **reuniones reportadas**.

Si la CdP no se reunió tres semanas por Navidad, el gráfico por semanas mostraría tres barras en cero y el líder leería "mi casa se cayó". No se cayó: no hubo reunión. Es coherente con `fn_visitas_consecutivas` de [05-estados-ssva](../05-estados-ssva/design.md), que también cuenta reuniones y no semanas.

## KPI con comparación

El Requisito 2.2 pide el valor anterior de cada KPI:

```sql
CREATE OR REPLACE FUNCTION fn_kpi_asistencia_ultima(p_casa_de_paz_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  WITH ultimas AS (
    SELECT vt.total_asistentes, vt.fecha_reunion,
           ROW_NUMBER() OVER (ORDER BY vt.fecha_reunion DESC) AS pos
    FROM v_reporte_totales vt
    WHERE vt.casa_de_paz_id = p_casa_de_paz_id
  )
  SELECT jsonb_build_object(
    'valor',    (SELECT total_asistentes FROM ultimas WHERE pos = 1),
    'anterior', (SELECT total_asistentes FROM ultimas WHERE pos = 2),
    'fecha',    (SELECT fecha_reunion    FROM ultimas WHERE pos = 1),
    'variacion_pct', (
      SELECT CASE
        WHEN (SELECT total_asistentes FROM ultimas WHERE pos = 2) IN (0, NULL) THEN NULL
        ELSE round((
          ((SELECT total_asistentes FROM ultimas WHERE pos = 1)::numeric
           - (SELECT total_asistentes FROM ultimas WHERE pos = 2))
          / (SELECT total_asistentes FROM ultimas WHERE pos = 2)
        ) * 100, 1)
      END
    )
  );
$$;
```

`variacion_pct = NULL` cuando el anterior es cero (Requisito 7.5). Mismo criterio que en [08-finanzas-cdp](../08-finanzas-cdp/design.md): crecer desde cero no es 100%, y el front pinta "—".

## Lista de miembros

```sql
CREATE OR REPLACE FUNCTION fn_lista_miembros_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (
  persona_id UUID, nombre TEXT, estado_sigla VARCHAR, estado_nombre VARCHAR,
  ultima_asistencia DATE, semanas_sin_venir INT, estado_civil estado_civil_enum,
  es_menor BOOLEAN, semaforo VARCHAR
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT
      p.id, fn_nombre_completo(p) AS nombre,
      e.sigla, e.nombre AS estado_nombre,
      pd.estado_civil,
      (p.fecha_nacimiento IS NOT NULL
       AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento))
           < fn_criterio(m.iglesia_id, 'EDAD_MINIMA_CREYENTE')) AS es_menor,
      (SELECT max(r.fecha_reunion)
       FROM casa_de_paz_asistencia a
       JOIN casa_de_paz_reporte r ON r.id = a.reporte_id
       WHERE a.persona_id = p.id
         AND r.casa_de_paz_id = p_casa_de_paz_id
         AND a.fecha_eliminacion IS NULL
         AND r.fecha_eliminacion IS NULL) AS ultima,
      m.iglesia_id
    FROM casa_de_paz_membresia m
    JOIN persona p ON p.id = m.persona_id AND p.fecha_eliminacion IS NULL
    LEFT JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
    LEFT JOIN persona_estado pe ON pe.persona_id = p.id
         AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    LEFT JOIN estado e ON e.id = pe.estado_id
    WHERE m.casa_de_paz_id = p_casa_de_paz_id
      AND m.fecha_fin IS NULL
      AND m.fecha_eliminacion IS NULL
  )
  SELECT
    b.id, b.nombre, b.sigla, b.estado_nombre, b.ultima,
    CASE WHEN b.ultima IS NULL THEN NULL
         ELSE ((CURRENT_DATE - b.ultima) / 7)::int END,
    b.estado_civil, b.es_menor,
    CASE
      WHEN b.ultima IS NULL THEN 'ROJO'
      WHEN (CURRENT_DATE - b.ultima) >= fn_criterio(b.iglesia_id, 'DIAS_SEMAFORO_ROJO') THEN 'ROJO'
      WHEN (CURRENT_DATE - b.ultima) >= fn_criterio(b.iglesia_id, 'DIAS_SEMAFORO_AMARILLO') THEN 'AMARILLO'
      ELSE 'VERDE'
    END::VARCHAR
  FROM base b;
$$;
```

`software/dashboards/lider-cdp.md` pide que "los que no asistieron hace mucho aparezcan en amarillo o rojo" sin decir a partir de cuándo. El semáforo lo calcula la base, no el front: si lo calculara el front, la app móvil tendría que reimplementar los mismos umbrales y se desviarían.

**Confirmado y hecho configurable (PENDIENTES.md #7, 2026-07-17).** El owner fijó los valores de arranque en 2 semanas (14 días) para amarillo y 4 semanas (28 días) para rojo, pero pidió que sean ajustables por iglesia desde el Panel del Supervisor. Se agregan al motor de configuración de [10-panel-supervisor](../10-panel-supervisor/design.md): `DIAS_SEMAFORO_AMARILLO` (defecto 14, rango 1-365) y `DIAS_SEMAFORO_ROJO` (defecto 28, rango 1-365), categoría `CDP`. Son **independientes** de `INASISTENCIAS_PARA_INACTIVO` ([05-estados-ssva](../05-estados-ssva/design.md)): ese criterio cuenta reuniones reportadas consecutivas para la alerta de membresía en riesgo; este semáforo cuenta días corridos desde la última asistencia, para pintar la lista del líder. Son dos señales distintas que conviven.

## Alertas del Supervisor

```sql
CREATE OR REPLACE FUNCTION fn_alertas_supervisor(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'DASHBOARD_FUERA_DE_ALCANCE: se requiere ser Pastor o Supervisor en la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    -- Req 5.5
    'cdp_sin_reporte', (
      SELECT jsonb_agg(to_jsonb(x)) FROM fn_cdp_sin_reporte(p_iglesia_id) x
    ),
    -- Req 5.6
    'redes_incompletas', (
      SELECT jsonb_agg(to_jsonb(x)) FROM fn_redes_incompletas(p_iglesia_id) x
      WHERE x.falta_departamentos OR x.falta_ministerio
    ),
    -- Req 5.8
    'evangelismo_discrepante', (
      SELECT jsonb_agg(to_jsonb(x))
      FROM v_reporte_evangelismo x
      JOIN casa_de_paz c ON c.id = x.casa_de_paz_id
      WHERE c.iglesia_id = p_iglesia_id
        AND x.diferencia <> 0
        AND x.fecha_reunion >= CURRENT_DATE - 30
    ),
    -- Req 5.9
    'cdp_sin_red', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre))
      FROM casa_de_paz c
      WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM casa_de_paz_red cdr
          WHERE cdr.casa_de_paz_id = c.id AND cdr.fecha_fin IS NULL
            AND cdr.fecha_eliminacion IS NULL
        )
    ),
    -- Req 5.10
    'iglesia_sin_autoridad', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', i.nombre,
        'falta_pastor', i.pastor_id IS NULL,
        'falta_supervisor', i.supervisor_id IS NULL
      ))
      FROM iglesia i
      WHERE i.id = p_iglesia_id
        AND (i.pastor_id IS NULL OR i.supervisor_id IS NULL)
    ),
    -- Req 5.7
    'miembros_inactivos', (
      SELECT jsonb_agg(jsonb_build_object(
        'casa_de_paz', c.nombre, 'cantidad', sub.n
      ))
      FROM casa_de_paz c
      CROSS JOIN LATERAL (
        SELECT count(*) AS n FROM fn_inactividad_cdp(c.id) i WHERE i.supera_umbral
      ) sub
      WHERE c.iglesia_id = p_iglesia_id AND c.activo AND c.fecha_eliminacion IS NULL
        AND sub.n > 0
    )
  );
END;
$$;
```

Las alertas no se descartan (Requisito 5.11). No hay tabla de "alerta leída": se calculan al vuelo y desaparecen cuando la causa se arregla. Una red sin encargados sigue apareciendo hasta que alguien designe a los encargados — que es exactamente lo que hace falta, dado que la obligatoriedad se hace cumplir avisando y no bloqueando (ver [03-estructura](../03-estructura/design.md)).

`cdp_sin_red` cubre el hueco que dejó [03-estructura](../03-estructura/design.md): el índice único parcial impide **dos** redes vigentes pero no **cero**.

## Dashboard del Pastor

```sql
CREATE OR REPLACE FUNCTION fn_dashboard_pastor(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
BEGIN
  RETURN jsonb_build_object(
    'iglesias', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', i.nombre, 'ciudad', i.ciudad,
        'moneda_defecto', (SELECT codigo FROM moneda WHERE id = i.moneda_defecto_id),
        'redes',    (SELECT count(*) FROM red r
                     WHERE r.iglesia_id = i.id AND r.activo AND r.fecha_eliminacion IS NULL),
        'cdp',      (SELECT count(*) FROM casa_de_paz c
                     WHERE c.iglesia_id = i.id AND c.activo AND c.fecha_eliminacion IS NULL),
        'miembros_cdp', (SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
                         WHERE m.iglesia_id = i.id AND m.fecha_fin IS NULL
                           AND m.fecha_eliminacion IS NULL),
        'familias', fn_total_familias(i.id),
        'activa', i.activo
      ) ORDER BY i.nombre)
      FROM iglesia i
      WHERE i.id IN (SELECT fn_mis_iglesias()) AND i.fecha_eliminacion IS NULL
    ),

    -- Req 6.6: por moneda, NUNCA sumadas entre si
    'ingresos_por_moneda', (
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT i.nombre AS iglesia, m.codigo AS moneda, t.codigo AS tipo, sum(fi.monto) AS total
        FROM finanzas_ingreso fi
        JOIN iglesia i ON i.id = fi.iglesia_id
        JOIN moneda m ON m.id = fi.moneda_id
        JOIN finanzas_tipo_ingreso t ON t.id = fi.tipo_ingreso_id
        WHERE fi.iglesia_id IN (SELECT fn_mis_iglesias())
          AND fi.fecha BETWEEN v_mes_desde AND v_mes_hasta
          AND fi.fecha_eliminacion IS NULL
        GROUP BY i.nombre, m.codigo, t.codigo
        ORDER BY i.nombre, m.codigo
      ) x
    )
  );
END;
$$;
```

Acá no hace falta verificación explícita: `fn_mis_iglesias()` **es** el filtro. Un usuario sin iglesias recibe listas vacías, no un error.

`ingresos_por_moneda` está agrupado por moneda (Requisito 6.6). Si Santa Cruz recibe en BOB y una futura iglesia en USD, salen filas separadas. **Nunca hay un "total consolidado" de un solo número**, porque no existe sin un tipo de cambio, y el Módulo 1 no lo tiene ([08-finanzas-cdp](../08-finanzas-cdp/design.md), Requisito 3.8).

Esto contradice `software/dashboards/pastor.md`, que pide "Ofrendas totales: suma de todas las iglesias" como un número. **Con una sola moneda funciona; con dos, no.** Como hoy ambas iglesias usan BOB, el front puede mostrar un número mientras `ingresos_por_moneda` devuelva una sola fila de moneda. Si devuelve dos, tiene que mostrar dos. El dato viene listo para las dos situaciones.

## Terminología en la pantalla

El Requisito 8.2 prohíbe decir "miembros" a secas. Los campos se llaman `miembros_cdp` y no `miembros`, para que quien escriba el front no tenga que acordarse de la diferencia: el nombre se la dice.

El Requisito 8.4 prohíbe sumar los NC menores con los mayores:

```sql
CREATE OR REPLACE FUNCTION fn_conteo_estados(p_iglesia_id UUID)
RETURNS TABLE (estado_sigla VARCHAR, es_menor BOOLEAN, cantidad BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.sigla,
         (p.fecha_nacimiento IS NOT NULL
          AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento))
              < fn_criterio(p_iglesia_id, 'EDAD_MINIMA_CREYENTE')),
         count(*)
  FROM persona_estado pe
  JOIN persona p ON p.id = pe.persona_id AND p.fecha_eliminacion IS NULL
  JOIN estado e ON e.id = pe.estado_id
  WHERE p.iglesia_id = p_iglesia_id
    AND pe.fecha_fin IS NULL
    AND pe.fecha_eliminacion IS NULL
  GROUP BY e.sigla, 2
  ORDER BY e.sigla;
$$;
```

`es_menor` está en el `GROUP BY`, así que es imposible pedir "cuántos NC hay" y recibir un solo número. Es la mitigación del riesgo de los menores atascados en NC ([05-estados-ssva](../05-estados-ssva/design.md)): el número existe, pero siempre partido en dos.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Una RPC por dashboard | Una llamada por tarjeta | Diez peticiones, diez latencias, y KPI que no cuadran con la lista porque se leyeron en momentos distintos. |
| JSONB de retorno | Varias tablas de retorno | PostgREST devuelve el JSON directo. El front no arma nada. |
| Verificación explícita en cada `SECURITY DEFINER` | Confiar en RLS | `SECURITY DEFINER` **salta** RLS. Sin verificar, cualquiera pasa un UUID ajeno y recibe el dashboard. |
| Últimas 8 reuniones | Últimas 8 semanas | Tres semanas sin reunión pintarían tres barras en cero y el líder leería una caída que no existe. |
| Semáforo en la base | Semáforo en el front | La app móvil tendría que reimplementar los umbrales y se desviarían. |
| Umbrales del semáforo configurables (`DIAS_SEMAFORO_AMARILLO`/`ROJO`) | Valores literales en el código | Confirmado por el owner (PENDIENTES.md #7): defaults 14/28 días, pero ajustables por iglesia desde el panel sin migración. |
| Alertas al vuelo | Tabla de alertas con "leída" | Se resuelven arreglando la causa, no descartándolas. |
| `miembros_cdp` y no `miembros` | Nombre genérico | El nombre del campo le recuerda la diferencia a quien escribe el front. |
| `es_menor` en el `GROUP BY` de estados | Conteo total por estado | Impide el número engañoso de NC que incluye niños de 8 años. |
| Ingresos siempre por moneda | Total consolidado | No existe sin tipo de cambio. Con una moneda el front muestra un número; con dos, dos. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Una función de dashboard se escribe sin la verificación de acceso y filtra datos de otra iglesia. | Es **el** riesgo de seguridad del sistema. Auditoría obligatoria: toda función `SECURITY DEFINER` que reciba un UUID de ámbito verifica `fn_mis_iglesias()` en su primera línea. Tarea 6.1 y prueba 7.2. |
| El dashboard del Supervisor agrega sobre toda la iglesia y pasa de 2 segundos. | Con 2 iglesias, decenas de CdP y miles de personas, no debería. Medir con `EXPLAIN ANALYZE` (tarea 6.5). Si pasa, materializar `v_reporte_totales`. **Medir antes de optimizar.** |
| `fn_alertas_supervisor` llama a `fn_inactividad_cdp` por cada CdP (N+1). | Con 30 CdP son 30 ejecuciones. Si molesta, reescribir como una sola consulta agregada. Medir primero. |
| El front suma monedas por su cuenta al pintar. | La API nunca devuelve un total sin moneda. Si el front suma, es un bug del front, detectable en revisión. |
