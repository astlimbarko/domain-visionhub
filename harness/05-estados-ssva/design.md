# Diseño — Estados SSVA

## Resumen

Cuatro estados en el Módulo 1: SIM, NC, CRE, RE. Una sola transición es manual (SIM → NC, porque aceptar a Jesús es un evento que solo el líder conoce); las demás las calcula la base al registrarse la asistencia.

No hay proceso nocturno. Todas las reglas del Módulo 1 se disparan por asistencia, y la asistencia es un `INSERT`. El disparador evalúa y transiciona en la misma transacción.

## Por qué DA y DI no entran

`estados/criterios.md` define sus transiciones así:

| Transición | Criterio |
|-----------|----------|
| NC/CRE → DA | asiste a discipulado |
| DA → DI | 3 clases ausentes |
| DI → DA | retoma asistencia |
| RE → DA | asiste a discipulado |

Las cuatro necesitan **asistencia a clases de discipulado**. El Discipulado es el Módulo 4: no existe la tabla, no existe la clase, no existe la lista. En el Módulo 1 el sistema no tiene con qué evaluarlas, y todos quedarían atascados antes de DA.

Se siembran `DA` y `DI` como filas inactivas (Requisito 1.2). Cuando llegue el Módulo 4, se activan y se agregan sus disparadores. No hace falta migración de datos.

## El diagrama del Módulo 1

```
   (evangelismo / alta rapida)
              |
              v
            [SIM] ------ ora de fe (MANUAL) ------> [NC]
                                                      |
                                        2 visitas consecutivas
                                         Y edad >= 12 (AUTO)
                                                      |
                                                      v
                                                    [CRE]
                                                      |
              +---------------------------------------+
              |
    +3 meses sin asistir y vuelve (AUTO)
              |
              v
            [RE] ---- 2 visitas consecutivas ----> [CRE]
                       (o [NC] si es menor)

   DA y DI: Modulo 4. No alcanzables hoy.
```

Los menores de 12 se quedan en `NC` de por vida. Es decisión explícita del owner. El riesgo está al final de este documento.

## Motor de criterios

Todo umbral es una fila, no una constante.

```sql
CREATE TABLE criterio_definicion (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       VARCHAR(50) NOT NULL UNIQUE,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  valor_defecto NUMERIC NOT NULL,
  valor_min    NUMERIC,
  valor_max    NUMERIC,
  unidad       VARCHAR(20),    -- visitas | dias | anios | clases
  categoria    VARCHAR(30),    -- CDP | SSVA
  orden        SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);

CREATE TABLE criterio_valor (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id   UUID NOT NULL REFERENCES iglesia(id),
  criterio_id  UUID NOT NULL REFERENCES criterio_definicion(id),
  valor        NUMERIC NOT NULL
  -- auditoria: creado_por / actualizado_por responden el Req 11.8
);

CREATE UNIQUE INDEX uq_criterio_valor
  ON criterio_valor (iglesia_id, criterio_id) WHERE fecha_eliminacion IS NULL;
```

Dos tablas y no una: `criterio_definicion` es global (el catálogo de perillas que existen, con sus rangos), `criterio_valor` es por iglesia (solo las que ese Supervisor tocó). Una iglesia que nunca tocó nada no tiene ninguna fila y usa los valores por defecto.

Semilla de `criterio_definicion`, tomada de `casas-de-paz/criterios.md` y `estados/criterios.md`:

| codigo | defecto | min | max | unidad | categoría | significado |
|--------|---------|-----|-----|--------|-----------|-------------|
| `VISITAS_PARA_MIEMBRO` | 2 | 1 | 20 | visitas | CDP | Visitas seguidas para ser Miembro_CdP |
| `VISITAS_PARA_CRE` | 2 | 1 | 20 | visitas | SSVA | Visitas seguidas para pasar de NC a CRE |
| `VISITAS_PARA_MIGRAR` | 8 | 2 | 50 | visitas | CDP | Visitas seguidas a otra CdP para proponer migración |
| `INASISTENCIAS_PARA_INACTIVO` | 12 | 1 | 100 | visitas | CDP | Inasistencias seguidas para alertar inactividad |
| `DIAS_PARA_RE` | 90 | 7 | 730 | días | SSVA | Días sin asistir para volver como Reconciliado |
| `EDAD_MINIMA_CREYENTE` | 12 | 0 | 30 | años | SSVA | Edad mínima para ser CRE |
| `CLASES_PARA_DI` | 3 | 1 | 20 | clases | SSVA | **Módulo 4.** Se siembra inactiva. |
| `ASISTENCIAS_PARA_DA` | 1 | 1 | 20 | clases | SSVA | **Módulo 4.** Se siembra inactiva. |

`VISITAS_PARA_MIEMBRO` y `VISITAS_PARA_CRE` valen 2 los dos y suenan redundantes. Se dejan separados a propósito: son conceptos distintos (uno es pertenencia a una casa, otro es estado espiritual) y el Supervisor podría querer que ser miembro cueste 2 visitas y ser creyente cueste 4. Fusionarlos ahora obligaría a separarlos después.

```sql
CREATE OR REPLACE FUNCTION fn_criterio(p_iglesia_id UUID, p_codigo VARCHAR)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cv.valor
     FROM criterio_valor cv
     JOIN criterio_definicion cd ON cd.id = cv.criterio_id
     WHERE cv.iglesia_id = p_iglesia_id
       AND cd.codigo = p_codigo
       AND cv.fecha_eliminacion IS NULL),
    (SELECT cd.valor_defecto
     FROM criterio_definicion cd
     WHERE cd.codigo = p_codigo)
  );
$$;
```

El `COALESCE` implementa el Requisito 11.3: si la iglesia no lo definió, cae al valor por defecto. Cero filas para arrancar.

Rango (Requisito 11.9):

```sql
CREATE OR REPLACE FUNCTION fn_validar_criterio_valor()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE d criterio_definicion;
BEGIN
  SELECT * INTO d FROM criterio_definicion WHERE id = NEW.criterio_id;

  IF d.valor_min IS NOT NULL AND NEW.valor < d.valor_min THEN
    RAISE EXCEPTION 'CRITERIO_FUERA_DE_RANGO: % debe ser >= % (recibido %)', d.codigo, d.valor_min, NEW.valor
      USING ERRCODE = 'P0001';
  END IF;

  IF d.valor_max IS NOT NULL AND NEW.valor > d.valor_max THEN
    RAISE EXCEPTION 'CRITERIO_FUERA_DE_RANGO: % debe ser <= % (recibido %)', d.codigo, d.valor_max, NEW.valor
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
```

Sin rango, un Supervisor pone `VISITAS_PARA_CRE = 0` y todo el mundo se vuelve CRE al instante.

## Estados

```sql
CREATE TABLE estado (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla        VARCHAR(5) NOT NULL UNIQUE,
  nombre       VARCHAR(50) NOT NULL,
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  orden        SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);
```

| sigla | nombre | orden | activo |
|-------|--------|-------|--------|
| `SIM` | Simpatizante | 1 | true |
| `NC` | Nuevo Convertido | 2 | true |
| `CRE` | Creyente | 3 | true |
| `RE` | Reconciliado | 4 | true |
| `DA` | Discípulo Activo | 5 | **false** |
| `DI` | Discípulo Inactivo | 6 | **false** |

```sql
CREATE TABLE persona_estado (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  persona_id    UUID NOT NULL REFERENCES persona(id),
  estado_id     UUID NOT NULL REFERENCES estado(id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  motivo        VARCHAR(200),
  es_automatico BOOLEAN NOT NULL DEFAULT true,
  -- auditoria
  CONSTRAINT chk_persona_estado_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_persona_estado_vigente
  ON persona_estado (persona_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;

CREATE INDEX idx_persona_estado_persona ON persona_estado (persona_id, fecha_inicio DESC);
```

`uq_persona_estado_vigente` implementa el Requisito 2.2. `motivo` y `es_automatico` cumplen 2.4 y 2.5: hay que poder distinguir "el sistema lo movió por 2 visitas" de "el líder lo movió a mano".

Estados inactivos bloqueados (Requisito 1.3):

```sql
CREATE OR REPLACE FUNCTION fn_validar_estado_activo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_sigla VARCHAR; v_activo BOOLEAN;
BEGIN
  SELECT sigla, activo INTO v_sigla, v_activo FROM estado WHERE id = NEW.estado_id;
  IF NOT v_activo THEN
    RAISE EXCEPTION 'ESTADO_NO_DISPONIBLE: el estado % no esta activo en este modulo', v_sigla
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
```

Cuando llegue el Módulo 4, activar `DA` y `DI` es un `UPDATE`. Nada más.

### Transición

```sql
CREATE OR REPLACE FUNCTION fn_transicionar_estado(
  p_persona_id   UUID,
  p_sigla        VARCHAR,
  p_fecha        DATE,
  p_motivo       VARCHAR,
  p_automatico   BOOLEAN DEFAULT true
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_estado_id  UUID;
  v_iglesia_id UUID;
  v_actual     UUID;
BEGIN
  SELECT id INTO v_estado_id FROM estado WHERE sigla = p_sigla;
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id;

  SELECT estado_id INTO v_actual
  FROM persona_estado
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  -- Ya esta ahi: no hacer nada (evita filas de historial identicas)
  IF v_actual = v_estado_id THEN RETURN; END IF;

  -- Req 2.3: cerrar y abrir en la misma transaccion
  UPDATE persona_estado
  SET fecha_fin = p_fecha
  WHERE persona_id = p_persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, motivo, es_automatico)
  VALUES (v_iglesia_id, p_persona_id, v_estado_id, p_fecha, p_motivo, p_automatico);
END;
$$;
```

La guarda `v_actual = v_estado_id` importa: sin ella, cada asistencia de un CRE cerraría y reabriría su estado, y el historial se llenaría de filas idénticas.

## Visitas consecutivas

Es el cálculo del que dependen tres reglas. Merece cuidado.

"Consecutivas" significa **sin faltar a ninguna reunión intermedia de esa CdP**. No es "las últimas N asistencias": si María vino el 1, faltó el 8 y vino el 15, tiene 1 visita consecutiva, no 2.

```sql
CREATE OR REPLACE FUNCTION fn_visitas_consecutivas(p_persona_id UUID, p_casa_de_paz_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH reuniones AS (
    -- Todas las reuniones de la CdP, de la mas reciente a la mas antigua
    SELECT r.id, r.fecha_reunion,
           ROW_NUMBER() OVER (ORDER BY r.fecha_reunion DESC) AS pos
    FROM casa_de_paz_reporte r
    WHERE r.casa_de_paz_id = p_casa_de_paz_id
      AND r.fecha_eliminacion IS NULL
  ),
  marcadas AS (
    SELECT rn.pos,
           EXISTS (
             SELECT 1 FROM casa_de_paz_asistencia a
             WHERE a.reporte_id = rn.id
               AND a.persona_id = p_persona_id
               AND a.fecha_eliminacion IS NULL
           ) AS asistio
    FROM reuniones rn
  ),
  -- La primera reunion (desde la mas reciente) a la que NO asistio
  primera_falta AS (
    SELECT COALESCE(MIN(pos), (SELECT COUNT(*) + 1 FROM marcadas)) AS pos
    FROM marcadas WHERE NOT asistio
  )
  SELECT (SELECT pos FROM primera_falta) - 1;
$$;
```

Se recorre hacia atrás desde la reunión más reciente y se cuenta hasta la primera falta. Si nunca faltó, son todas.

Se cuenta sobre **reuniones reportadas**, no sobre semanas del calendario. Si la CdP no se reunió una semana (feriado, enfermedad del líder), esa semana no existe y no rompe la racha de nadie. Es lo correcto: nadie faltó a una reunión que no ocurrió.

Eso tiene una consecuencia: si el líder deja de reportar dos meses, las rachas se congelan. Nadie avanza ni retrocede. Aceptable — sin reportes el sistema no sabe nada, y esa es la razón de la alerta de reportes faltantes.

## El disparador central

Todas las transiciones automáticas del Módulo 1 cuelgan de aquí.

```sql
CREATE OR REPLACE FUNCTION fn_evaluar_estado_por_asistencia()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte      casa_de_paz_reporte;
  v_persona      persona;
  v_estado_sigla VARCHAR;
  v_asistencia_previa DATE;
  v_dias_ausente INT;
  v_es_menor     BOOLEAN;
  v_edad_min     NUMERIC;
  v_visitas      INT;
  v_cdp_principal UUID;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = NEW.reporte_id;
  SELECT * INTO v_persona FROM persona WHERE id = NEW.persona_id;

  SELECT e.sigla INTO v_estado_sigla
  FROM persona_estado pe
  JOIN estado e ON e.id = pe.estado_id
  WHERE pe.persona_id = NEW.persona_id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL;

  -- ============ 1. RECONCILIADO (Req 6) ============
  -- Se evalua primero: tiene prioridad sobre NC -> CRE
  SELECT MAX(r2.fecha_reunion) INTO v_asistencia_previa
  FROM casa_de_paz_asistencia a2
  JOIN casa_de_paz_reporte r2 ON r2.id = a2.reporte_id
  WHERE a2.persona_id = NEW.persona_id
    AND a2.id <> NEW.id
    AND a2.fecha_eliminacion IS NULL
    AND r2.fecha_reunion < v_reporte.fecha_reunion;

  -- Req 6.5: sin asistencia previa no hay reconciliacion
  IF v_asistencia_previa IS NOT NULL THEN
    v_dias_ausente := v_reporte.fecha_reunion - v_asistencia_previa;

    IF v_dias_ausente >= fn_criterio(v_persona.iglesia_id, 'DIAS_PARA_RE') THEN
      PERFORM fn_transicionar_estado(
        NEW.persona_id, 'RE', v_reporte.fecha_reunion,
        format('Retorno tras %s dias sin asistir', v_dias_ausente), true
      );
      -- Recien reconciliado: no evaluar CRE en la misma asistencia
      PERFORM fn_evaluar_membresia_cdp(NEW.persona_id, v_reporte.casa_de_paz_id, v_reporte.fecha_reunion);
      RETURN NEW;
    END IF;
  END IF;

  -- ============ 2. NC/RE -> CRE (Req 5, Req 7) ============
  IF v_estado_sigla IN ('NC', 'RE') THEN
    v_edad_min := fn_criterio(v_persona.iglesia_id, 'EDAD_MINIMA_CREYENTE');

    -- Req 5.6 y 5.7: edad a la fecha de reunion; es_menor de respaldo
    IF v_persona.fecha_nacimiento IS NOT NULL THEN
      v_es_menor := EXTRACT(YEAR FROM age(v_reporte.fecha_reunion, v_persona.fecha_nacimiento)) < v_edad_min;
    ELSE
      v_es_menor := COALESCE(NEW.es_menor, true);  -- sin dato: se asume menor, es lo conservador
    END IF;

    IF NOT v_es_menor THEN
      v_visitas := fn_visitas_consecutivas(NEW.persona_id, v_reporte.casa_de_paz_id);

      IF v_visitas >= fn_criterio(v_persona.iglesia_id, 'VISITAS_PARA_CRE') THEN
        PERFORM fn_transicionar_estado(
          NEW.persona_id, 'CRE', v_reporte.fecha_reunion,
          format('%s visitas consecutivas', v_visitas), true
        );
      END IF;
    END IF;
    -- Req 5.4: si es menor, se queda en NC. Sin rama else: no hacer nada es la regla.
  END IF;

  -- ============ 3. MEMBRESIA Y MIGRACION (Req 8, Req 9) ============
  PERFORM fn_evaluar_membresia_cdp(NEW.persona_id, v_reporte.casa_de_paz_id, v_reporte.fecha_reunion);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evaluar_estado
  AFTER INSERT ON casa_de_paz_asistencia
  FOR EACH ROW EXECUTE FUNCTION fn_evaluar_estado_por_asistencia();
```

Tres decisiones de orden que importan:

**RE se evalúa antes que CRE.** Alguien que vuelve tras seis meses tiene que aparecer como Reconciliado, no saltar a Creyente. El `RETURN NEW` temprano lo garantiza.

**Sin fecha de nacimiento se asume menor.** Es lo conservador: dejar a alguien en NC de más es reversible a mano; promoverlo a CRE por error, no tanto. Y el líder que quiere que avance solo tiene que cargar la fecha.

**`AFTER INSERT` y no `BEFORE`.** `fn_visitas_consecutivas` tiene que ver la fila nueva para contarla.

### Membresía y migración

```sql
CREATE OR REPLACE FUNCTION fn_evaluar_membresia_cdp(
  p_persona_id UUID, p_casa_de_paz_id UUID, p_fecha DATE
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_visitas    INT;
  v_es_miembro BOOLEAN;
  v_principal  UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id;
  v_visitas := fn_visitas_consecutivas(p_persona_id, p_casa_de_paz_id);

  SELECT EXISTS (
    SELECT 1 FROM casa_de_paz_membresia
    WHERE persona_id = p_persona_id AND casa_de_paz_id = p_casa_de_paz_id
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) INTO v_es_miembro;

  SELECT casa_de_paz_id INTO v_principal
  FROM casa_de_paz_membresia
  WHERE persona_id = p_persona_id AND es_principal
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  -- Req 9.1: nueva membresia por visitas consecutivas
  IF NOT v_es_miembro AND v_visitas >= fn_criterio(v_iglesia_id, 'VISITAS_PARA_MIEMBRO') THEN
    INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
    VALUES (v_iglesia_id, p_casa_de_paz_id, p_persona_id, v_principal IS NULL, p_fecha);
    -- Req 9.3: principal solo si no tenia otra
  END IF;

  -- Req 8.1: proponer migracion, NO ejecutarla
  IF v_principal IS NOT NULL
     AND v_principal <> p_casa_de_paz_id
     AND v_visitas >= fn_criterio(v_iglesia_id, 'VISITAS_PARA_MIGRAR') THEN

    INSERT INTO migracion_propuesta (
      iglesia_id, persona_id, cdp_origen_id, cdp_destino_id, visitas, fecha_propuesta
    )
    VALUES (v_iglesia_id, p_persona_id, v_principal, p_casa_de_paz_id, v_visitas, p_fecha)
    ON CONFLICT (persona_id, cdp_destino_id) WHERE resuelta = false DO NOTHING;
  END IF;
END;
$$;
```

El Requisito 8.4 es explícito: la migración **no** se ejecuta sola. `criterios.md` dice que *"la migración formal se realiza entre líderes"*. El sistema detecta el patrón y avisa; el traslado lo aprueba una persona.

```sql
CREATE TABLE migracion_propuesta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  persona_id      UUID NOT NULL REFERENCES persona(id),
  cdp_origen_id   UUID NOT NULL REFERENCES casa_de_paz(id),
  cdp_destino_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  visitas         SMALLINT NOT NULL,
  fecha_propuesta DATE NOT NULL,
  resuelta        BOOLEAN NOT NULL DEFAULT false,
  aceptada        BOOLEAN,
  resuelta_por    UUID REFERENCES auth.users(id),
  fecha_resolucion TIMESTAMPTZ
  -- auditoria
);

CREATE UNIQUE INDEX uq_migracion_pendiente
  ON migracion_propuesta (persona_id, cdp_destino_id) WHERE NOT resuelta;
```

`uq_migracion_pendiente` + `ON CONFLICT DO NOTHING` evita que se acumule una propuesta por semana mientras la persona sigue yendo. Una sola, hasta que un líder la resuelva.

## Inactividad

No es un estado (Requisito 10.2). `criterios.md` dice: *"Esta regla NO es oficial, es solo práctica para documentación"*. Meterla al SSVA le daría un peso que la iglesia no le da.

Es una vista para pintar de amarillo y rojo la lista del líder:

```sql
CREATE OR REPLACE FUNCTION fn_inactividad_cdp(p_casa_de_paz_id UUID)
RETURNS TABLE (
  persona_id UUID,
  nombre TEXT,
  ultima_asistencia DATE,
  reuniones_faltadas INT,
  supera_umbral BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH miembros AS (
    SELECT m.persona_id, m.iglesia_id
    FROM casa_de_paz_membresia m
    WHERE m.casa_de_paz_id = p_casa_de_paz_id
      AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  ),
  ultima AS (
    SELECT mi.persona_id,
           MAX(r.fecha_reunion) AS ultima_fecha
    FROM miembros mi
    LEFT JOIN casa_de_paz_asistencia a
      ON a.persona_id = mi.persona_id AND a.fecha_eliminacion IS NULL
    LEFT JOIN casa_de_paz_reporte r
      ON r.id = a.reporte_id AND r.casa_de_paz_id = p_casa_de_paz_id
      AND r.fecha_eliminacion IS NULL
    GROUP BY mi.persona_id
  )
  SELECT u.persona_id,
         fn_nombre_completo(p),
         u.ultima_fecha,
         (SELECT count(*)::int FROM casa_de_paz_reporte r2
          WHERE r2.casa_de_paz_id = p_casa_de_paz_id
            AND r2.fecha_eliminacion IS NULL
            AND (u.ultima_fecha IS NULL OR r2.fecha_reunion > u.ultima_fecha)) AS faltadas,
         (SELECT count(*) FROM casa_de_paz_reporte r3
          WHERE r3.casa_de_paz_id = p_casa_de_paz_id
            AND r3.fecha_eliminacion IS NULL
            AND (u.ultima_fecha IS NULL OR r3.fecha_reunion > u.ultima_fecha))
         >= fn_criterio(mi.iglesia_id, 'INASISTENCIAS_PARA_INACTIVO') AS supera_umbral
  FROM ultima u
  JOIN persona p ON p.id = u.persona_id
  JOIN miembros mi ON mi.persona_id = u.persona_id
  ORDER BY u.ultima_fecha NULLS FIRST;
$$;
```

Se cuentan **reuniones reportadas posteriores a su última asistencia**, no semanas transcurridas. Coherente con `fn_visitas_consecutivas`.

La membresía nunca se cierra sola (Requisito 10.6). `criterios.md` dice que no hay número oficial de inasistencias para perder la membresía. Un sistema que da de baja gente sola, con un criterio que la iglesia no reconoce, haría desaparecer personas de las listas sin que nadie lo decida.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| DA/DI sembrados inactivos | No sembrarlos | Activarlos en el Módulo 4 es un `UPDATE`, no una migración. |
| Todo por disparador de asistencia | Proceso nocturno | Ninguna regla del Módulo 1 es puramente temporal: todas se disparan al volver. El cron sería para nada. |
| RE se evalúa antes que CRE | Orden inverso | Quien vuelve tras seis meses debe verse como Reconciliado, no saltar a Creyente. |
| Sin fecha de nacimiento ⇒ menor | ⇒ mayor | Conservador. Dejar en NC de más es reversible; promover por error, menos. |
| Migración propuesta, no automática | Migrar solo a las 8 visitas | `criterios.md`: la migración formal la coordinan los líderes. |
| Inactivo como vista | Estado del SSVA | `criterios.md` dice que la regla no es oficial. |
| Membresía nunca se cierra sola | Cerrar a las 12 inasistencias | No hay número oficial. Nadie desaparece de una lista por un umbral inventado. |
| `criterio_definicion` + `criterio_valor` | Una sola tabla | Una iglesia que no tocó nada no tiene filas. Los rangos viven una vez, no repetidos por iglesia. |
| `VISITAS_PARA_MIEMBRO` ≠ `VISITAS_PARA_CRE` | Un solo criterio | Valen 2 los dos hoy, pero son conceptos distintos. Fusionarlos ahora obliga a separarlos después. |
| Consecutivas sobre reuniones reportadas | Sobre semanas del calendario | Nadie faltó a una reunión que no ocurrió. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| **Los menores se quedan en NC de por vida.** Decisión explícita del owner (`EDAD_MINIMA_CREYENTE = 12`). El conteo de "nuevos convertidos" se infla con niños que llevan años viniendo. | Tres cosas. Uno: el reporte separa menores de mayores, así que los dashboards los muestran aparte y el número de NC nunca se lee solo. Dos: `EDAD_MINIMA_CREYENTE` es configurable — bajarlo a 0 arregla todo sin tocar código. Tres: los dashboards muestran "NC mayores de 12" y "NC menores" como dos cifras, nunca sumadas. |
| RE nunca sale de RE si el owner rechaza la regla RE → CRE. | **Confirmado por el owner (PENDIENTES.md #2, 2026-07-17): sí, RE → CRE con 2 visitas consecutivas, mismo criterio que NC → CRE.** Ya no es condicional; `fn_evaluar_estado_por_asistencia` de arriba implementa exactamente esto. |
| `fn_visitas_consecutivas` se ejecuta 3 veces por asistencia (CRE, membresía, migración). | Con 20 asistentes son 60 ejecuciones sobre un índice, en una operación que ocurre una vez por semana por CdP. Si molesta, se calcula una vez y se pasa como parámetro. **Medir antes de optimizar.** |
| El líder deja de reportar y las rachas se congelan. | Es correcto: sin datos no hay inferencia. Lo cubre la alerta de reportes faltantes de [04-reporte-cdp](../04-reporte-cdp/). |
| Bajar `VISITAS_PARA_CRE` no promueve retroactivamente a los que ya cumplían el criterio viejo. | Es lo que exige el Requisito 11.7 y `modulos.md`. Debe decirse en el panel del Supervisor: "los cambios aplican desde ahora". Si el owner quiere recálculo retroactivo, es una función aparte y explícita, nunca un efecto secundario de mover una perilla. |
| El disparador se ejecuta dentro del `INSERT` de asistencia y si falla, tumba el reporte entero. | Correcto: es una transacción. Un estado mal calculado es peor que un reporte rechazado. Los errores son `P0001` con nombre de regla. |
