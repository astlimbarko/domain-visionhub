# Diseño — Evangelismo de Casa de Paz

## Resumen

Una tabla `evangelismo` con `escala`, restringida a `CASA_DE_PAZ` en el Módulo 1. Más el sistema de metas que el frontend ya construido espera: meta propia del líder, meta asignada por un rol superior, y la efectiva que da prioridad a la segunda.

## Alineación con el frontend existente

Este módulo es el único del Módulo 1 cuyo front ya está hecho. Sus specs (`iu/rediseno-modulo-evangelismo/requirements.md`) definen el modelo de datos que espera consumir. Se respeta, con tres adaptaciones obligadas por el cambio de arquitectura:

| El front especifica | Aquí se implementa | Por qué |
|--------------------|-------------------|---------|
| Tabla `usuario` para `asignador_usuario_id` | `asignador_id` → `persona(id)` | No hay tabla `usuario`: la auth es de Supabase. Y quien asigna es una persona con cargo, no una cuenta. |
| `created_at`, `updated_at`, `deleted_at`, `created_by`… | `fecha_creacion`, `fecha_actualizacion`, `fecha_eliminacion`, `creado_por`… | La convención de [00-fundacion](../00-fundacion/design.md) es español. Son los mismos seis campos con otro nombre. |
| NestJS + Prisma | PostgREST + funciones SQL | El backend NestJS está descartado. Supabase lo reemplaza. |

El resto — `meta_evangelismo` nulable en `casa_de_paz`, la tabla `meta_evangelismo_asignada`, la prioridad de la asignada sobre la propia, la tasa como porcentaje — se implementa tal cual.

## El desajuste de roles (mayormente resuelto)

Esta sección documentaba una fricción real con el front `iu/` original. Con la decisión del owner de 2026-07-17 (roles de dominio en `usuario_rol`, ver [01-tenancy-iglesias](../01-tenancy-iglesias/design.md)), la fricción **casi desaparece**, porque ahora `Rol_Sistema` usa exactamente los mismos nombres que el front espera: `PASTOR`, `SUPERVISOR_VISION_ACCION`, `LIDER_RED`, `LIDER_CDP`, `SUBLIDER_CDP`.

El front usa roles organizacionales como si fueran roles de autenticación; su `RoleGuard` enruta por ese valor. Antes, nuestro modelo los separaba (`Rol_Sistema` genérico vs. cargo de dominio en `persona_cargo`/`casa_de_paz_cargo`) y hacía falta una función sintética (`fn_mi_rol_operativo`) que fingiera un cargo a partir de las tablas de dominio. Con roles de dominio en `usuario_rol`, esa función deja de ser necesaria: el rol que el front necesita para enrutar **es** el mismo dato que ya autoriza en RLS.

```sql
CREATE OR REPLACE FUNCTION fn_mi_rol_operativo(p_iglesia_id UUID)
RETURNS VARCHAR
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rol::VARCHAR
  FROM usuario_rol
  WHERE usuario_id = auth.uid()
    AND iglesia_id = p_iglesia_id
    AND fecha_eliminacion IS NULL
  ORDER BY CASE rol
    WHEN 'PASTOR' THEN 1
    WHEN 'SUPERVISOR_VISION_ACCION' THEN 2
    WHEN 'LIDER_RED' THEN 3
    WHEN 'LIDER_CDP' THEN 4
    WHEN 'SUBLIDER_CDP' THEN 5
    ELSE 99
  END
  LIMIT 1;
$$;
```

Se mantiene la función (ahora una simple lectura de `usuario_rol`, no una derivación desde cargos) porque el front sigue esperando una RPC con ese nombre; cambiar el contrato de la API por una consulta directa a la tabla sería un cambio de interfaz sin necesidad. **La base sigue sin usar este valor para autorizar**: la autorización real vive en RLS y en las funciones de permiso (`fn_es_operativo_en`, `fn_es_lider_cdp`, etc.), nunca en lo que el front cree que el usuario es.

`SUBLIDER_RED` — que el front también nombra en su `RoleGuard` — no tiene equivalente en `usuario_rol`: sigue siendo un cargo de dominio (`red_cargo`, [03-estructura](../03-estructura/design.md)), no un rol de sistema. Si el front necesita enrutar también por ese cargo, debe consultarlo aparte; no se agrega a `rol_sistema_enum` porque no controla ningún permiso distinto de `LIDER_RED` en el Módulo 1.

## Esquema

```sql
CREATE TYPE escala_evangelismo_enum AS ENUM ('CASA_DE_PAZ', 'RED', 'IGLESIA', 'COBERTURA');

CREATE TABLE evangelismo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  persona_id        UUID NOT NULL REFERENCES persona(id),
  casa_de_paz_id    UUID REFERENCES casa_de_paz(id),
  escala            escala_evangelismo_enum NOT NULL DEFAULT 'CASA_DE_PAZ',
  fecha             DATE NOT NULL,
  domicilio         TEXT,
  evangelizado_por_id UUID REFERENCES persona(id),
  observaciones     TEXT,
  -- auditoria

  CONSTRAINT chk_evangelismo_fecha CHECK (fecha <= CURRENT_DATE),

  -- Req 1.5: escala CASA_DE_PAZ exige la CdP
  CONSTRAINT chk_evangelismo_escala_cdp CHECK (
    escala <> 'CASA_DE_PAZ' OR casa_de_paz_id IS NOT NULL
  ),

  -- Req 1.3 y 1.4: Modulo 1 solo admite escala CdP.
  -- Se quita en el Modulo 2. Es la unica restriccion que el Modulo 2 debe tocar.
  CONSTRAINT chk_evangelismo_solo_cdp_modulo1 CHECK (escala = 'CASA_DE_PAZ')
);

CREATE UNIQUE INDEX uq_evangelismo_persona_cdp_fecha
  ON evangelismo (persona_id, casa_de_paz_id, fecha)
  WHERE fecha_eliminacion IS NULL;

CREATE INDEX idx_evangelismo_cdp_fecha ON evangelismo (casa_de_paz_id, fecha)
  WHERE fecha_eliminacion IS NULL;
```

El enum tiene los cuatro valores desde hoy aunque solo uno sea usable. El `CHECK` nombrado `..._modulo1` es lo que restringe, y quitarlo es una línea:

```sql
-- Migracion del Modulo 2, cuando llegue:
ALTER TABLE evangelismo DROP CONSTRAINT chk_evangelismo_solo_cdp_modulo1;
```

Agregar un valor a un enum de PostgreSQL exige `ALTER TYPE` y no se puede hacer dentro de una transacción con otras operaciones. Dejar los cuatro sembrados ahora evita ese problema después. El `CHECK` cuesta nada y se va de una línea.

`domicilio` es texto libre. `software/pendientes.md` pregunta por el flujo de normalización: se deja texto en el Módulo 1 y se normaliza al Modelo_Hibrido cuando el Departamento de Evangelismo (Módulo 2) lo necesite. Normalizar la dirección de alguien que se evangelizó en la calle y a quien quizá no se vuelva a ver es trabajo que no rinde.

`software/pendientes.md` también pregunta si `telefono_persona_id` es el teléfono del evangelizado o del evangelizador. **Resolución:** del evangelizado, y no se guarda acá. Va por el Modelo_Hibrido: `telefono_asignacion.persona_id = evangelismo.persona_id`. Una columna de teléfono en `evangelismo` duplicaría lo que ya modela [02-persona-parentela](../02-persona-parentela/). `evangelizado_por_id` cubre al evangelizador (Requisito 2.6).

### Persona por evangelismo

```sql
CREATE OR REPLACE FUNCTION fn_evangelismo_crear_persona()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_iglesia_persona UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'EVANGELISMO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  -- Req 2.2: si la persona no tiene estado, nace SIM
  IF NOT EXISTS (
    SELECT 1 FROM persona_estado
    WHERE persona_id = NEW.persona_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) THEN
    PERFORM fn_transicionar_estado(NEW.persona_id, 'SIM', NEW.fecha, 'Registrado por evangelismo', true);
  END IF;

  RETURN NEW;
END;
$$;
```

`IF NOT EXISTS`: si la persona ya existe y es CRE, evangelizarla de nuevo **no** la devuelve a SIM. El Requisito 2.4 permite vincular a una persona ya registrada, y un CRE que asiste a una salida evangelística no retrocede.

## Metas

```sql
ALTER TABLE casa_de_paz
  ADD COLUMN meta_evangelismo INTEGER,
  ADD CONSTRAINT chk_meta_propia_positiva CHECK (meta_evangelismo IS NULL OR meta_evangelismo > 0);
```

Nulable, por defecto nulo (Requisitos 3.1, 3.2) — tal como pide `iu/meta-evangelismo-kpi/requirements.md`.

```sql
CREATE TABLE meta_evangelismo_asignada (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  asignador_id    UUID NOT NULL REFERENCES persona(id),
  meta            INTEGER NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  observaciones   TEXT,
  -- auditoria

  CONSTRAINT chk_meta_asignada_positiva CHECK (meta > 0),
  CONSTRAINT chk_meta_asignada_fechas CHECK (fecha_fin >= fecha_inicio),

  -- Req 4.9: sin solapamiento
  CONSTRAINT excl_meta_asignada_solapada EXCLUDE USING gist (
    casa_de_paz_id WITH =,
    daterange(fecha_inicio, fecha_fin, '[]') WITH &&
  ) WHERE (fecha_eliminacion IS NULL)
);
```

`EXCLUDE USING gist` es la forma correcta de impedir solapamientos de rangos. Un `UNIQUE` no sirve: dos metas con fechas distintas pero superpuestas serían filas distintas y pasarían. La restricción de exclusión compara los rangos con `&&` (se solapan) y rechaza. PostgreSQL lo verifica en cada escritura, sin carreras.

Requiere `btree_gist`:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Sin esa extensión, no se puede mezclar `uuid WITH =` y `daterange WITH &&` en la misma restricción. Supabase la trae disponible.

`daterange(..., '[]')` incluye ambos extremos: una meta del 1 al 31 y otra que empieza el 31 se solapan. Es lo correcto — el 31 no puede tener dos metas.

### Quién puede asignar

```sql
CREATE OR REPLACE FUNCTION fn_es_rol_superior_de_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Pastor o supervisor de la iglesia de esa CdP
    fn_es_operativo_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR
    -- Lider o sublider de la red a la que pertenece esa CdP
    EXISTS (
      SELECT 1
      FROM casa_de_paz_red cdr
      JOIN red_cargo rc ON rc.red_id = cdr.red_id
      JOIN cargo c ON c.id = rc.cargo_id
      WHERE cdr.casa_de_paz_id = p_casa_de_paz_id
        AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
        AND rc.persona_id = fn_mi_persona_id()
        AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED')
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    );
$$;

CREATE POLICY pol_meta_asignada_insert ON meta_evangelismo_asignada
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fn_es_rol_superior_de_cdp(casa_de_paz_id)
  );

CREATE POLICY pol_meta_asignada_select ON meta_evangelismo_asignada
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);
```

`SELECT` amplio (Requisito 4.10): el líder tiene que ver la meta que le pusieron. `INSERT` solo para roles superiores (Requisito 4.5).

El Requisito 4.6 — el líder no se asigna metas a sí mismo — sale gratis: `fn_es_rol_superior_de_cdp` no incluye `LIDER_CDP`. Si el líder de la CdP es además líder de esa red, sí puede: es un rol superior de verdad, y el dominio lo admite (`cargos.md` permite acumular cargos).

## Meta efectiva y tasa

```sql
CREATE OR REPLACE FUNCTION fn_meta_efectiva(p_casa_de_paz_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (meta INTEGER, origen VARCHAR)
LANGUAGE sql STABLE
AS $$
  SELECT ma.meta, 'ASIGNADA'::VARCHAR
  FROM meta_evangelismo_asignada ma
  WHERE ma.casa_de_paz_id = p_casa_de_paz_id
    AND p_fecha BETWEEN ma.fecha_inicio AND ma.fecha_fin
    AND ma.fecha_eliminacion IS NULL
  LIMIT 1

  UNION ALL

  SELECT c.meta_evangelismo, 'PROPIA'::VARCHAR
  FROM casa_de_paz c
  WHERE c.id = p_casa_de_paz_id
    AND c.meta_evangelismo IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM meta_evangelismo_asignada ma2
      WHERE ma2.casa_de_paz_id = p_casa_de_paz_id
        AND p_fecha BETWEEN ma2.fecha_inicio AND ma2.fecha_fin
        AND ma2.fecha_eliminacion IS NULL
    )

  LIMIT 1;
$$;
```

El `NOT EXISTS` de la segunda rama implementa la prioridad del Requisito 5.2: la propia solo aparece si no hay asignada vigente. Sin él, el `UNION ALL` devolvería las dos y el `LIMIT 1` elegiría por orden accidental.

Devuelve cero filas cuando no hay ninguna meta (Requisito 5.3). El llamador distingue "sin meta" de "meta cero".

```sql
CREATE OR REPLACE FUNCTION fn_tasa_evangelismo(
  p_casa_de_paz_id UUID,
  p_desde DATE,
  p_hasta DATE
)
RETURNS TABLE (evangelizados BIGINT, meta INTEGER, origen VARCHAR, tasa NUMERIC)
LANGUAGE sql STABLE
AS $$
  WITH
  conteo AS (
    SELECT count(*) AS n
    FROM evangelismo e
    WHERE e.casa_de_paz_id = p_casa_de_paz_id
      AND e.fecha BETWEEN p_desde AND p_hasta
      AND e.fecha_eliminacion IS NULL
  ),
  m AS (
    SELECT * FROM fn_meta_efectiva(p_casa_de_paz_id, p_hasta)
  )
  SELECT
    c.n,
    m.meta,
    m.origen,
    -- Req 5.5: sin division por cero
    CASE
      WHEN m.meta IS NULL OR m.meta = 0 THEN NULL
      ELSE round((c.n::numeric / m.meta) * 100, 2)
    END
  FROM conteo c
  LEFT JOIN m ON true;
$$;
```

`LEFT JOIN m ON true` para que la fila salga aunque no haya meta: se devuelven los evangelizados y `tasa = NULL`. Un `JOIN` normal escondería el conteo, que es dato útil por sí solo.

El `CASE` cubre el Requisito 5.5. `NULL` y no `0`: "no tengo meta" no es "voy 0%".

No hay tope al 100% (Requisito 5.6): superar la meta es la noticia buena y el número tiene que verse.

La meta efectiva se evalúa a `p_hasta`, el final del período. Si el rango cruza dos metas asignadas, gana la del final. **Es una simplificación**: lo exacto sería prorratear por día. Se deja así porque los períodos de meta que la iglesia usa son mensuales o trimestrales y los reportes se piden por el mismo período. Si aparecen rangos que cruzan metas, hay que revisarlo.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Enum con las 4 escalas desde hoy | Agregar valores en el Módulo 2 | `ALTER TYPE ... ADD VALUE` no corre en transacción con otras operaciones. Sembrar los 4 ahora evita eso. |
| `CHECK` para limitar al Módulo 1 | Disparador | Un `DROP CONSTRAINT` de una línea abre el Módulo 2. |
| `EXCLUDE USING gist` | `UNIQUE` o disparador | Es la única forma declarativa de impedir solapamiento de rangos sin carreras. |
| `asignador_id` → `persona` | → `usuario`, como pide el front | No hay tabla `usuario`. Quien asigna es una persona con cargo. |
| `domicilio` texto libre | Modelo híbrido | Normalizar la dirección de alguien a quien tal vez no se vuelva a ver no rinde. Módulo 2. |
| Teléfono por Modelo_Hibrido | Columna en `evangelismo` | Cierra el pendiente. Duplicaría lo que ya modela `telefono_asignacion`. |
| `fn_mi_rol_operativo` lee `usuario_rol` directo | Derivar desde `persona_cargo`/`red_cargo`/`casa_de_paz_cargo` | Con roles de dominio (2026-07-17), el rol de sistema ya coincide con lo que el front espera. Mantener la RPC evita romper el contrato de API, pero ya no hace falta fingir nada. |
| Meta efectiva a `p_hasta` | Prorrateo por día | Los períodos reales son mensuales. Revisar si aparecen rangos que cruzan metas. |
| `SIM` solo si no tiene estado | `SIM` siempre | Un CRE que va a una salida evangelística no retrocede a SIM. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El front espera nombres de campo en inglés (`created_at`, `meta_evangelismo_asignada.deleted_at`). | Son los mismos seis campos con otro nombre. El front los toca poco; se ajusta al conectar. Documentar el mapeo. |
| `fn_mi_rol_operativo` se usa para autorizar por error. | La autorización real está en RLS. Que el front crea otra cosa no le da acceso. Verificar con la tarea 7.4: con un JWT de líder de CdP, forzar el rol en el cliente y confirmar que RLS igual bloquea. |
| El rango de la tasa cruza dos metas asignadas y el número engaña. | Gana la meta del final del período. Aceptable con metas mensuales. Revisar si aparecen otros usos. |
| Duplicados de personas evangelizadas: se registra al mismo Juan cada salida. | `uq_evangelismo_persona_cdp_fecha` solo evita el duplicado del mismo día. Mismo problema que el alta rápida de [04-reporte-cdp](../04-reporte-cdp/design.md). Búsqueda de coincidencias antes de crear. **Pendiente.** |
