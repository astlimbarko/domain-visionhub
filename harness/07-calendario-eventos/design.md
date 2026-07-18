# Diseño — Calendario y Eventos

## Resumen

Una tabla `evento` con rango de fechas y horas, más un catálogo de tipos. Los cumpleaños **no** se almacenan: se derivan de `persona.fecha_nacimiento` y se generan al consultar.

## Esquema

```sql
CREATE TABLE tipo_evento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID REFERENCES iglesia(id),   -- NULL = catalogo global
  codigo      VARCHAR(30) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(200),
  color       CHAR(7) NOT NULL DEFAULT '#6B7280',
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0,
  -- auditoria
  CONSTRAINT chk_tipo_evento_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX uq_tipo_evento_codigo
  ON tipo_evento (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo)
  WHERE fecha_eliminacion IS NULL;
```

`iglesia_id` nulable, mismo patrón que `cdp_tema`: `NULL` es catálogo global, con valor es tipo propio de esa iglesia (Requisito 1.6).

`CHAR(7)` con `CHECK` de expresión regular para el color (Requisito 1.3). Sin el `CHECK`, alguien guarda `"rojo"` y el front pinta gris.

`icono` es la ruta al PNG, no el binario (Requisito 1.4). Los archivos van a Supabase Storage; la base guarda la referencia. Meter binarios en PostgreSQL infla los backups y no aporta nada.

Semilla (significados y renombres confirmados por el owner, PENDIENTES.md #4, 2026-07-17):

| codigo | nombre | descripcion | color |
|--------|--------|-------------|-------|
| `RMS` | RMS (Remanente) | Congreso de jóvenes. Evento masivo a nivel ciudad, regional o nacional. | `#8B5CF6` |
| `AVIVATE` | Avívate | Evento evangelístico de gran alcance, orientado a la predicación del evangelio y la invitación de nuevos asistentes. | `#EC4899` |
| `ELITE_LINAJE_ESCOGIDO` | Élite Linaje Escogido | Evento masivo dirigido al ministerio de hombres (antes llamado Hombres). | `#3B82F6` |
| `MUJERES_DEL_AHORA` | Mujeres del Ahora | Evento masivo dirigido al ministerio de mujeres (antes llamado Débora/Déboras). | `#F59E0B` |
| `MOS` | MOS (Movimiento Sobrenatural) | Evento congregacional de gran magnitud enfocado en ministración, renovación espiritual y crecimiento de la iglesia. | `#10B981` |
| `REUNION` | Reunión | Reunión general sin categoría especial. | `#6B7280` |
| `MEGA_FIESTA` | Mega Fiesta de Casa de Paz | Reunión especial de casas de paz a nivel de red, en lugar de la reunión semanal normal. | `#EF4444` |
| `CUMPLEANOS` | Cumpleaños | Generado, no registrado — ver más abajo. | `#F472B6` |

Los colores siguen siendo provisionales: se toman del front al conectar. **Pendiente** (cosmético, no bloquea el esquema).

`ELITE_LINAJE_ESCOGIDO` y `MUJERES_DEL_AHORA` reemplazan a los códigos `HOMBRES` y `DEBORAS`: el owner aclaró que esos nombres corresponden a denominaciones anteriores de los mismos ministerios. Como el frontend se construye desde cero (no hay `frontend/` previo que migrar), se adopta directamente el código y nombre nuevos, sin necesidad de mantener el viejo como alias.

### evento

```sql
CREATE TABLE evento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID REFERENCES casa_de_paz(id),
  red_id          UUID REFERENCES red(id),
  tipo_evento_id  UUID NOT NULL REFERENCES tipo_evento(id),
  titulo          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  hora_inicio     TIME,
  hora_fin        TIME,
  -- auditoria

  CONSTRAINT chk_evento_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),

  -- Req 2.5 y 2.6: las horas solo se comparan si es el mismo dia
  CONSTRAINT chk_evento_horas CHECK (
    hora_fin IS NULL
    OR hora_inicio IS NULL
    OR fecha_fin IS DISTINCT FROM fecha_inicio
    OR hora_fin >= hora_inicio
  ),

  -- Un evento es de una CdP o de una Red (Mega Fiesta), nunca de las dos ni de ninguna
  CONSTRAINT chk_evento_ambito CHECK (
    (casa_de_paz_id IS NOT NULL)::int + (red_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_evento_cdp_fecha ON evento (casa_de_paz_id, fecha_inicio)
  WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_evento_red_fecha ON evento (red_id, fecha_inicio)
  WHERE fecha_eliminacion IS NULL;
```

`chk_evento_horas` es la restricción sutil. El Requisito 2.6 dice que un retiro puede empezar el viernes a las 18:00 y terminar el domingo a las 12:00, y ahí `hora_fin < hora_inicio` es **correcto**. Comparar horas sin mirar las fechas rechazaría todo retiro. Por eso solo se comparan cuando `fecha_fin = fecha_inicio`.

`fecha_fin IS DISTINCT FROM fecha_inicio` y no `<>`: si `fecha_fin` es nula, `<>` da `NULL` y el `CHECK` pasa por accidente. `IS DISTINCT FROM` trata el nulo como valor y devuelve `true`, que es lo que se quiere — un evento sin `fecha_fin` es de un día y sus horas sí deben compararse.

`chk_evento_ambito` implementa el Requisito 5.4: la Mega Fiesta cuelga de la red, los demás eventos de la CdP. Mismo patrón "exactamente uno" del modelo híbrido.

No hay `CHECK` de fecha futura: el Requisito 2.7 permite registrar lo ya ocurrido.

## Consulta por rango

El Requisito 3.2 es donde se equivoca casi todo calendario. Un evento del 28 de julio al 3 de agosto **tiene que aparecer** cuando se pide la semana del 1 al 7 de agosto, aunque empiece antes.

Filtrar por `fecha_inicio BETWEEN p_desde AND p_hasta` lo perdería.

```sql
CREATE OR REPLACE FUNCTION fn_eventos_cdp(
  p_casa_de_paz_id UUID,
  p_desde DATE,
  p_hasta DATE,
  p_tipo_evento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, titulo VARCHAR, descripcion TEXT,
  tipo_codigo VARCHAR, tipo_nombre VARCHAR, color CHAR(7), icono VARCHAR,
  fecha_inicio DATE, fecha_fin DATE, hora_inicio TIME, hora_fin TIME,
  es_multi_dia BOOLEAN, ambito VARCHAR
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.titulo, e.descripcion,
         t.codigo, t.nombre, t.color, t.icono,
         e.fecha_inicio, e.fecha_fin, e.hora_inicio, e.hora_fin,
         COALESCE(e.fecha_fin, e.fecha_inicio) > e.fecha_inicio AS es_multi_dia,
         CASE WHEN e.red_id IS NOT NULL THEN 'RED' ELSE 'CDP' END::VARCHAR
  FROM evento e
  JOIN tipo_evento t ON t.id = e.tipo_evento_id
  WHERE e.fecha_eliminacion IS NULL
    AND (
      -- Eventos propios de la CdP
      e.casa_de_paz_id = p_casa_de_paz_id
      OR
      -- Req 5.3: Mega Fiesta de la red a la que pertenece la CdP
      e.red_id = (
        SELECT cdr.red_id FROM casa_de_paz_red cdr
        WHERE cdr.casa_de_paz_id = p_casa_de_paz_id
          AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
      )
    )
    -- Req 3.2: interseccion de rangos, no contencion
    AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin, e.fecha_inicio), '[]')
        && daterange(p_desde, p_hasta, '[]')
    AND (p_tipo_evento_id IS NULL OR e.tipo_evento_id = p_tipo_evento_id)
  ORDER BY e.fecha_inicio, e.hora_inicio NULLS LAST;
$$;
```

El operador `&&` de `daterange` es "se solapan". Es una línea y cubre los cinco casos (evento dentro del rango, que empieza antes, que termina después, que envuelve al rango, que coincide). Escribirlo con `OR` de comparaciones son seis condiciones y siempre falta una.

`COALESCE(e.fecha_fin, e.fecha_inicio)` trata el evento de un día como un rango de un día.

`NULLS LAST` en el orden (Requisito 3.5): los eventos sin hora van al final del día, no al principio.

La Mega Fiesta aparece en el calendario de toda CdP de esa red (Requisito 5.3) por la segunda rama del `OR`, sin duplicar filas.

## Cumpleaños

No se almacenan (Requisito 4.2). Guardarlos como filas de `evento` obligaría a un job anual que genere el cumpleaños de cada persona de cada año, a borrarlos cuando alguien cambia su fecha de nacimiento y a limpiarlos cuando se va. Todo eso para expresar algo que ya está en `persona.fecha_nacimiento`.

Se generan al consultar:

```sql
CREATE OR REPLACE FUNCTION fn_cumpleanos_cdp(
  p_casa_de_paz_id UUID,
  p_desde DATE,
  p_hasta DATE
)
RETURNS TABLE (
  persona_id UUID, nombre TEXT, fecha_cumpleanos DATE, edad_cumple INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH anios AS (
    -- Los años que toca el rango (uno o dos si cruza el 31/12)
    SELECT generate_series(
      EXTRACT(YEAR FROM p_desde)::int,
      EXTRACT(YEAR FROM p_hasta)::int
    ) AS anio
  ),
  miembros AS (
    SELECT p.id, p.fecha_nacimiento, fn_nombre_completo(p) AS nombre
    FROM casa_de_paz_membresia m
    JOIN persona p ON p.id = m.persona_id
    WHERE m.casa_de_paz_id = p_casa_de_paz_id
      AND m.fecha_fin IS NULL
      AND m.fecha_eliminacion IS NULL
      AND p.fecha_nacimiento IS NOT NULL   -- Req 4.5
      AND p.fecha_eliminacion IS NULL
  ),
  cumples AS (
    SELECT
      mi.id, mi.nombre, mi.fecha_nacimiento,
      make_date(
        a.anio,
        EXTRACT(MONTH FROM mi.fecha_nacimiento)::int,
        -- Req 4.7: el 29/02 se corre al 28 en anios no bisiestos
        CASE
          WHEN EXTRACT(MONTH FROM mi.fecha_nacimiento) = 2
           AND EXTRACT(DAY FROM mi.fecha_nacimiento) = 29
           AND NOT (a.anio % 4 = 0 AND (a.anio % 100 <> 0 OR a.anio % 400 = 0))
          THEN 28
          ELSE EXTRACT(DAY FROM mi.fecha_nacimiento)::int
        END
      ) AS fecha_cumple,
      a.anio
    FROM miembros mi
    CROSS JOIN anios a
  )
  SELECT id, nombre, fecha_cumple, (anio - EXTRACT(YEAR FROM fecha_nacimiento)::int)
  FROM cumples
  WHERE fecha_cumple BETWEEN p_desde AND p_hasta
  ORDER BY fecha_cumple;
$$;
```

`generate_series` sobre los años maneja el rango que cruza el 31 de diciembre: pedir del 20/12 al 10/01 toca dos años, y ambos generan candidatos.

El 29 de febrero (Requisito 4.7) se corre al 28 en años no bisiestos. Sin ese `CASE`, `make_date(2027, 2, 29)` lanza excepción y tumba la consulta entera del calendario por una sola persona. La regla de bisiesto va completa (`%4 AND (%100 o %400)`) porque 2100 no es bisiesto.

`edad_cumple` (Requisito 4.6) es la edad que cumple, no la que tiene.

## Permisos

```sql
CREATE OR REPLACE FUNCTION fn_puede_crear_evento(p_casa_de_paz_id UUID, p_tipo_evento_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_codigo VARCHAR;
BEGIN
  SELECT codigo INTO v_codigo FROM tipo_evento WHERE id = p_tipo_evento_id;

  -- Req 5.1 y 5.2: Mega Fiesta solo lider de red o superior
  IF v_codigo = 'MEGA_FIESTA' THEN
    RETURN fn_es_rol_superior_de_cdp(p_casa_de_paz_id);
  END IF;

  RETURN fn_puede_reportar_cdp(p_casa_de_paz_id);
END;
$$;
```

`fn_puede_reportar_cdp` (de [04-reporte-cdp](../04-reporte-cdp/design.md)) ya devuelve "líder o sublíder de esta CdP, o admin de la iglesia", que es exactamente lo que pide el Requisito 2.8. Se reutiliza en lugar de escribir la misma consulta otra vez.

El reporte semanal de una CdP puede vincularse a este evento cuando esa reunión fue la Megafiesta de la red: ver `casa_de_paz_reporte.evento_megafiesta_id` y `fn_validar_reporte_megafiesta` en [04-reporte-cdp](../04-reporte-cdp/design.md#megafiesta-de-casas-de-paz). El diseño vive allá para no duplicarlo; acá solo se crea el evento.

La Mega Fiesta se crea con `red_id`, no con `casa_de_paz_id`, así que su política mira la red:

```sql
CREATE POLICY pol_evento_insert ON evento
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR
      (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
    )
  );
```

## Notificaciones

```sql
CREATE OR REPLACE FUNCTION fn_proximos_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (clase VARCHAR, titulo TEXT, fecha DATE, dias_faltantes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ventana AS (
    SELECT CURRENT_DATE AS desde,
           (CURRENT_DATE + (fn_criterio(
              (SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id),
              'DIAS_AVISO_EVENTO'
            ) || ' days')::interval)::date AS hasta
  )
  SELECT 'EVENTO'::VARCHAR, e.titulo::TEXT, e.fecha_inicio, (e.fecha_inicio - CURRENT_DATE)::int
  FROM fn_eventos_cdp(p_casa_de_paz_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) e

  UNION ALL

  SELECT 'CUMPLEANOS'::VARCHAR,
         (c.nombre || ' cumple ' || c.edad_cumple || ' anios')::TEXT,
         c.fecha_cumpleanos,
         (c.fecha_cumpleanos - CURRENT_DATE)::int
  FROM fn_cumpleanos_cdp(p_casa_de_paz_id, (SELECT desde FROM ventana), (SELECT hasta FROM ventana)) c

  ORDER BY fecha;
$$;
```

`DIAS_AVISO_EVENTO` se agrega a `criterio_definicion` (defecto 7, rango 1 a 90). Reutiliza el motor de [05-estados-ssva](../05-estados-ssva/design.md#motor-de-criterios) en vez de inventar otra tabla de configuración.

El Módulo 1 **no envía** nada (Requisito 5.5): expone la consulta y el front la pinta. Correos y push son otra infraestructura y otra decisión.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Cumpleaños derivados | Filas de `evento` generadas por job anual | Un job que genere, borre y limpie filas para expresar algo que ya está en `fecha_nacimiento`. |
| `daterange && daterange` | Seis `OR` de comparaciones | Una línea contra seis condiciones donde siempre falta un caso. |
| `IS DISTINCT FROM` en `chk_evento_horas` | `<>` | Con `fecha_fin` nula, `<>` da `NULL` y el `CHECK` pasa por accidente. |
| Horas comparadas solo el mismo día | Comparar siempre | Rechazaría todo retiro que termina más temprano de lo que empezó. |
| `chk_evento_ambito` (CdP o Red) | `casa_de_paz_id` nulable sin regla | La Mega Fiesta es de la red. Sin la restricción, aparecen eventos huérfanos. |
| `icono` como ruta | `BYTEA` | Los binarios inflan los backups. Van a Storage. |
| `DIAS_AVISO_EVENTO` en `criterio_definicion` | Tabla de configuración nueva | El motor de criterios ya existe. |
| Sin envío de notificaciones | Correos desde el Módulo 1 | Otra infraestructura, otra decisión. El Módulo 1 expone la consulta. |
| Renombrar `HOMBRES`→`ELITE_LINAJE_ESCOGIDO` y `DEBORAS`→`MUJERES_DEL_AHORA` | Mantener los códigos viejos como alias | No hay frontend previo que dependa de esos códigos (se construye desde cero); adoptar el nombre correcto de una vez evita arrastrar un alias sin motivo. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Los colores no coinciden con los del front ya construido. | Tomarlos del front al conectar. **Pendiente.** |
| `fn_cumpleanos_cdp` recorre todos los miembros por cada año del rango. | Con 20 miembros y un rango de un mes, son 20 filas. Si alguien pide un rango de 5 años, son 100. Irrelevante. |
| El 29 de febrero tumba la consulta del calendario entero. | Cubierto por el `CASE`. Es la tarea 4.5 y hay que probarla con un año no bisiesto real. |
| La Mega Fiesta aparece duplicada si la CdP cambió de red. | `fn_eventos_cdp` usa la red **vigente**. Una CdP que se cambió de red deja de ver las fiestas de la anterior, que es lo correcto. |
