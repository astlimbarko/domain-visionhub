# Diseño — Persona y Parentela

## Resumen

`persona` es la tabla central. Se mantiene delgada: identidad y poco más. Todo lo demás cuelga de ella — detalle censal, direcciones, teléfonos, llegada, familia — para que la tabla que todo el sistema consulta no cargue con columnas que casi nadie lee.

Lo nuevo de esta área es el **conteo de familias**, que `software/bd-modelo.md` dejó abierto ("se recibirán ideas de Claude Code"). La propuesta está más abajo.

## Esquema

### persona

```sql
CREATE TYPE sexo_enum AS ENUM ('M', 'F');

CREATE TABLE persona (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  usuario_id        UUID REFERENCES auth.users(id),
  primer_nombre     VARCHAR(100) NOT NULL,
  segundo_nombre    VARCHAR(100),
  primer_apellido   VARCHAR(100) NOT NULL,
  segundo_apellido  VARCHAR(100),
  apellido_casada   VARCHAR(100),
  mostrar_apellido_casada BOOLEAN NOT NULL DEFAULT true,
  sexo              sexo_enum NOT NULL,
  fecha_nacimiento  DATE,
  ci                VARCHAR(20),
  correo            VARCHAR(150),
  oculto            BOOLEAN NOT NULL DEFAULT false,
  -- auditoria

  CONSTRAINT chk_persona_nacimiento CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE)
);

CREATE UNIQUE INDEX uq_persona_ci ON persona (ci)
  WHERE ci IS NOT NULL AND fecha_eliminacion IS NULL;

CREATE UNIQUE INDEX uq_persona_usuario ON persona (usuario_id)
  WHERE usuario_id IS NOT NULL AND fecha_eliminacion IS NULL;

CREATE INDEX idx_persona_iglesia ON persona (iglesia_id) WHERE fecha_eliminacion IS NULL;
```

`uq_persona_ci` es global y no por iglesia (Requisito 1.5). Un CI identifica a un boliviano, no a un miembro de una congregación. Si la misma persona se registra en Santa Cruz y en Montero, el índice lo impide y obliga a resolverlo — que es lo correcto: es una persona, no dos.

`ci` es nulable (Requisito 1.6) porque los menores no lo tienen. El índice único parcial ignora los nulos, así que mil niños sin CI no colisionan entre sí.

`VARCHAR(20)` para `ci`: el CI boliviano lleva número más extensión (`12345678 SC`) y a veces un alfanumérico. `VARCHAR` y no entero: los ceros a la izquierda importan.

#### Normalización del correo

```sql
CREATE OR REPLACE FUNCTION fn_persona_normalizar()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.correo IS NOT NULL THEN
    NEW.correo := lower(btrim(NEW.correo));
    IF NEW.correo = '' THEN NEW.correo := NULL; END IF;
  END IF;

  -- Req 3.2: apellido_casada solo si esta casada
  IF NEW.apellido_casada IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM persona_detalle
    WHERE persona_id = NEW.id AND estado_civil = 'CASADO' AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'APELLIDO_CASADA_SIN_MATRIMONIO: apellido_casada requiere estado_civil = CASADO'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
```

### persona_detalle

```sql
CREATE TYPE estado_civil_enum AS ENUM ('SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO');

CREATE TYPE grado_instruccion_enum AS ENUM (
  'SIN_INSTRUCCION', 'PRIMARIA_INCOMPLETA', 'PRIMARIA_COMPLETA',
  'SECUNDARIA_INCOMPLETA', 'SECUNDARIA_COMPLETA', 'TECNICO_MEDIO',
  'TECNICO_SUPERIOR', 'LICENCIATURA_INGENIERIA', 'DIPLOMADO',
  'MAESTRIA', 'DOCTORADO'
);

CREATE TABLE persona_detalle (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id         UUID NOT NULL REFERENCES persona(id),
  nacimiento_ciudad  VARCHAR(100),
  estado_civil       estado_civil_enum,
  grado_instruccion  grado_instruccion_enum,
  ocupacion          VARCHAR(150),
  -- auditoria
  CONSTRAINT uq_persona_detalle UNIQUE (persona_id)
);
```

`UNIQUE (persona_id)` fuerza el uno a uno del Requisito 2.3.

Por qué tabla aparte: `persona` la lee todo el sistema — dashboards, listas de asistencia, reportes. `persona_detalle` la lee el formulario de membresía y poco más. Separarlas mantiene angosta la fila caliente. Es SRP aplicado a tablas.

Estos campos son enum y no catálogo porque nadie los cambia por iglesia: el estado civil lo define la ley boliviana y el grado de instrucción el sistema educativo.

### Nombre completo

`software/bd-modelo.md` propone una vista con `CASE`. Tiene dos problemas.

El primero: concatenar con `||` y un `COALESCE(segundo_nombre, '')` produce espacios dobles cuando el segundo nombre es nulo — `"Maria  Lopez"`. El segundo, más serio: incluye `segundo_apellido` **y** `apellido_casada` a la vez, lo que da `"Maria Elena Lopez Garcia de Perez"`. Pero el ejemplo del propio documento dice que una casada es `"Maria Lopez de Perez"`: al casarse, el apellido materno se reemplaza, no se acumula. El Requisito 4.3 sigue el ejemplo, no el `CASE`.

```sql
CREATE OR REPLACE FUNCTION fn_nombre_completo(p persona)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT array_to_string(
    ARRAY[
      p.primer_nombre,
      p.segundo_nombre,
      p.primer_apellido,
      CASE WHEN p.apellido_casada IS NOT NULL AND p.mostrar_apellido_casada
           THEN p.apellido_casada
           ELSE p.segundo_apellido
      END
    ]::text[],
    ' '
  );
$$;
```

### El interruptor `mostrar_apellido_casada`

Decisión del owner (2026-07-17): en vez de reconstruir el nombre completo cada vez que cambia el estado civil, se separa "tener un apellido de casada guardado" de "mostrarlo". `apellido_casada` conserva el valor aunque la persona decida no exhibirlo; `mostrar_apellido_casada` (por defecto `true`) es el interruptor que decide si `fn_nombre_completo` lo usa.

Con esto, cambiar la forma en que aparece el nombre es un `UPDATE mostrar_apellido_casada = false` — un clic desde el front, sin perder el dato ni reescribir nombres completos, y reversible igual de fácil. Si la persona más adelante quiere que vuelva a aparecer, es el mismo `UPDATE` en sentido contrario.

`array_to_string` sobre un array con nulos los descarta y no deja espacios dobles. Es más corto y más correcto que encadenar `COALESCE`.

Al declararla con el parámetro de tipo `persona`, PostgreSQL permite invocarla como si fuera una columna:

```sql
SELECT p.id, p.fn_nombre_completo FROM persona p;   -- notacion de campo calculado
SELECT id, fn_nombre_completo(persona) FROM persona; -- equivalente
```

PostgREST la expone como columna calculada, así que el frontend pide `select=id,fn_nombre_completo` sin construir nada.

### Sugerencia de apellido de casada

`software/bd-modelo.md` dice: *"concatenar apellido del esposo + 'de' + primer apellido de la mujer"*. Eso daría `"Perez de Lopez"`, al revés del ejemplo del mismo documento (`"Maria Lopez de Perez"`). El texto está invertido; se sigue el ejemplo, que coincide con el uso boliviano real.

```sql
CREATE OR REPLACE FUNCTION fn_sugerir_apellido_casada(p_persona_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT 'de ' || c.primer_apellido
  FROM persona p
  JOIN persona_detalle pd ON pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
  JOIN familia f ON f.persona_id = p.id AND f.fecha_eliminacion IS NULL
  JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id AND tr.codigo = 'CONYUGE'
  JOIN persona c ON c.id = f.familiar_id AND c.fecha_eliminacion IS NULL
  WHERE p.id = p_persona_id
    AND p.sexo = 'F'
    AND pd.estado_civil = 'CASADO'
  LIMIT 1;
$$;
```

Devuelve `NULL` cuando el cónyuge no está registrado, y entonces el Nombre_Completo usa los apellidos de nacimiento (Requisito 3.8) sin código adicional: `apellido_casada` sigue nulo y `fn_nombre_completo` cae en la rama del `ELSE`.

Es **sugerencia**, nunca asignación (Requisito 3.5). El frontend la pide, la muestra en el campo y la secretaria confirma o corrige. Hay mujeres que no adoptan el apellido del esposo y el sistema no puede decidir por ellas.

Al divorciarse se vacía (Requisito 3.7):

```sql
CREATE OR REPLACE FUNCTION fn_limpiar_apellido_casada()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado_civil IN ('SOLTERO', 'DIVORCIADO')
     AND OLD.estado_civil = 'CASADO' THEN
    UPDATE persona SET apellido_casada = NULL WHERE id = NEW.persona_id;
  END IF;
  RETURN NEW;
END;
$$;
```

`VIUDO` no está en la lista a propósito: en Bolivia la viuda conserva el apellido del esposo. Confirmado por el owner (2026-07-17): es el comportamiento por defecto. Si la persona prefiere dejar de mostrarlo, no hace falta tocar esta lógica de limpieza — alcanza con `mostrar_apellido_casada = false` (ver arriba), que no borra el dato ni pasa por este disparador.

### Direcciones y teléfonos

Modelo híbrido de [00-fundacion](../00-fundacion/design.md#modelo-híbrido). Dos tablas por cada uno:

```sql
CREATE TABLE direccion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id     UUID NOT NULL REFERENCES iglesia(id),
  ciudad         VARCHAR(100),
  zona           VARCHAR(100),
  anillo         VARCHAR(20),
  calle          VARCHAR(150),
  numero         VARCHAR(20),
  referencia     TEXT,
  url_gps        TEXT,
  observaciones  TEXT
  -- auditoria
);

CREATE TABLE direccion_asignacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  direccion_id    UUID NOT NULL REFERENCES direccion(id),
  persona_id      UUID REFERENCES persona(id),
  iglesia_ref_id  UUID REFERENCES iglesia(id),
  casa_de_paz_id  UUID REFERENCES casa_de_paz(id),
  es_principal    BOOLEAN NOT NULL DEFAULT false,
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- auditoria
  CONSTRAINT chk_direccion_una_sola_entidad CHECK (
    (persona_id IS NOT NULL)::int +
    (iglesia_ref_id IS NOT NULL)::int +
    (casa_de_paz_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX uq_direccion_principal_persona
  ON direccion_asignacion (persona_id)
  WHERE es_principal AND activo AND persona_id IS NOT NULL AND fecha_eliminacion IS NULL;
```

`iglesia_id` (el tenant, para RLS) e `iglesia_ref_id` (la iglesia dueña de la dirección) son columnas distintas. Sin esa separación, la política RLS no sabría cuál mirar.

`anillo` es `VARCHAR` y no entero: en Santa Cruz se dice "4to anillo" pero también "entre 3er y 4to".

Teléfonos, igual, con `tipo_telefono_id` a catálogo (Requisito 5.4).

### Llegada

```sql
CREATE TABLE persona_llegada (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id         UUID NOT NULL REFERENCES iglesia(id),
  persona_id         UUID NOT NULL REFERENCES persona(id),
  motivo_llegada_id  UUID NOT NULL REFERENCES motivo_llegada(id),
  fecha_ingreso      DATE NOT NULL,
  invitado_por_id    UUID REFERENCES persona(id),
  invitado_por_txt   VARCHAR(200),
  comentarios        TEXT,
  -- auditoria
  CONSTRAINT chk_llegada_invitador CHECK (
    NOT (invitado_por_id IS NOT NULL AND invitado_por_txt IS NOT NULL)
  ),
  CONSTRAINT chk_llegada_fecha CHECK (fecha_ingreso <= CURRENT_DATE)
);
```

El `CHECK` permite que ambos sean nulos (llegó por decisión propia) pero no que ambos tengan valor (Requisito 6.3).

Varias filas por persona (Requisito 6.5): quien se muda de Santa Cruz a Montero tiene dos llegadas. El historial queda.

## Parentela

### tipo_relacion

```sql
CREATE TABLE tipo_relacion (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               VARCHAR(30) NOT NULL UNIQUE,
  nombre               VARCHAR(100) NOT NULL,
  inverso_id           UUID REFERENCES tipo_relacion(id),
  activo               BOOLEAN NOT NULL DEFAULT true,
  orden                SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);
```

Semilla:

| codigo | nombre | inverso |
|--------|--------|---------|
| `CONYUGE` | Cónyuge | `CONYUGE` |
| `PADRE` | Padre/Madre | `HIJO` |
| `HIJO` | Hijo/Hija | `PADRE` |
| `ABUELO` | Abuelo/Abuela | `NIETO` |
| `NIETO` | Nieto/Nieta | `ABUELO` |
| `HERMANO` | Hermano/Hermana | `HERMANO` |
| `TIO` | Tío/Tía | `SOBRINO` |
| `SOBRINO` | Sobrino/Sobrina | `TIO` |
| `PRIMO` | Primo/Prima | `PRIMO` |
| `CUNADO` | Cuñado/Cuñada | `CUNADO` |
| `SUEGRO` | Suegro/Suegra | `YERNO` |
| `YERNO` | Yerno/Nuera | `SUEGRO` |

`CONYUGE`, `HERMANO` y `PRIMO` son sus propios inversos: si A es cónyuge de B, B es cónyuge de A. No hay que inventar dos tipos.

**`cuenta_para_familia` ya no es una columna de este catálogo** (decisión del owner, 2026-07-17, resolviendo el "pendiente" que dejó [10-panel-supervisor](../10-panel-supervisor/design.md)). `tipo_relacion` es un catálogo **global**, compartido por todas las iglesias; si viviera ahí, el Supervisor de Montero cambiando un valor movería también el conteo de familias de Santa Cruz — una iglesia tocando el dato de otra. Se mueve al motor de configuración (`configuracion_definicion`/`configuracion_valor` de [10-panel-supervisor](../10-panel-supervisor/design.md)), con un código booleano por cada tipo de relación, categoría `FAMILIA`:

| Código de configuración | Defecto | Corresponde a |
|--------------------------|---------|---------------|
| `FAMILIA_CUENTA_CONYUGE` | `true` | Cónyuge |
| `FAMILIA_CUENTA_PADRE` | `true` | Padre/Madre |
| `FAMILIA_CUENTA_HIJO` | `true` | Hijo/Hija |
| `FAMILIA_CUENTA_ABUELO` | `true` | Abuelo/Abuela |
| `FAMILIA_CUENTA_NIETO` | `true` | Nieto/Nieta |
| `FAMILIA_CUENTA_HERMANO` | `false` | Hermano/Hermana |
| `FAMILIA_CUENTA_TIO` | `false` | Tío/Tía |
| `FAMILIA_CUENTA_SOBRINO` | `false` | Sobrino/Sobrina |
| `FAMILIA_CUENTA_PRIMO` | `false` | Primo/Prima |
| `FAMILIA_CUENTA_CUNADO` | `false` | Cuñado/Cuñada |
| `FAMILIA_CUENTA_SUEGRO` | `false` | Suegro/Suegra |
| `FAMILIA_CUENTA_YERNO` | `false` | Yerno/Nuera |

Esto resuelve dos preguntas de PENDIENTES.md a la vez:

1. **"¿Hogar o linaje?" (pregunta 1).** Es el mismo continuo que ya ofrecía `cuenta_para_familia`, ahora configurable de verdad: poner `FAMILIA_CUENTA_ABUELO` y `FAMILIA_CUENTA_NIETO` en `false` da el modo "hogar" (una pareja con sus hijos, sin colapsar generaciones); dejarlos en `true` da el modo "linaje" (el valor de arranque, siguiendo `software/bd-modelo.md`). No hace falta un `ENUM` `HOGAR`/`LINAJE` aparte: ya es el resultado de estas perillas.
2. **"¿Quién decide?" (pregunta 8).** Cada iglesia tiene su propia fila en `configuracion_valor`, así que el Supervisor de Montero cambia su criterio sin tocar el de Santa Cruz. Lo hace `fn_es_operativo_en` (Pastor o Supervisor), igual que el resto del panel — no hace falta la política especial `pol_tipo_relacion_update` que proponía 10-panel-supervisor; el ajuste es un `UPSERT` normal sobre `configuracion_valor`, con la política estándar de esa tabla.

Los valores por defecto siguen a `software/bd-modelo.md`: *"Solo se toman en cuenta familiares directos: esposo/esposa, hijos, abuelos. No se incluyen primos, tíos"*. Hermano queda en `false` — se explica abajo.

Un tipo sin inverso rompe la simetría, así que se exige (Requisito 7.7):

```sql
ALTER TABLE tipo_relacion
  ADD CONSTRAINT chk_tipo_relacion_inverso CHECK (inverso_id IS NOT NULL) NOT VALID;
```

`NOT VALID` permite crear los tipos y enlazar los inversos en un segundo paso; después se valida con `VALIDATE CONSTRAINT`. Sin eso, el primer `INSERT` sería imposible: no existe todavía el tipo al que apuntar.

### familia

```sql
CREATE TABLE familia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  persona_id        UUID NOT NULL REFERENCES persona(id),
  familiar_id       UUID NOT NULL REFERENCES persona(id),
  tipo_relacion_id  UUID NOT NULL REFERENCES tipo_relacion(id),
  -- auditoria
  CONSTRAINT chk_familia_no_autorelacion CHECK (persona_id <> familiar_id)
);

CREATE UNIQUE INDEX uq_familia_par
  ON familia (persona_id, familiar_id)
  WHERE fecha_eliminacion IS NULL;
```

`uq_familia_par` cumple el Requisito 7.6: un solo vínculo vigente por par ordenado. No se puede ser padre e hijo de la misma persona.

### Simetría automática

El Requisito 7.3 exige que registrar A→B cree B→A. Sin esto, "¿quiénes son los hijos de Juan?" tendría que consultar las dos direcciones y unirlas, en cada consulta y para siempre.

```sql
CREATE OR REPLACE FUNCTION fn_familia_simetria()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inverso_id UUID;
  v_iglesia_a  UUID;
  v_iglesia_b  UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Req 7.9: misma iglesia
    SELECT iglesia_id INTO v_iglesia_a FROM persona WHERE id = NEW.persona_id;
    SELECT iglesia_id INTO v_iglesia_b FROM persona WHERE id = NEW.familiar_id;
    IF v_iglesia_a IS DISTINCT FROM v_iglesia_b THEN
      RAISE EXCEPTION 'FAMILIA_IGLESIAS_DISTINTAS: no se puede relacionar personas de iglesias distintas'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT inverso_id INTO v_inverso_id FROM tipo_relacion WHERE id = NEW.tipo_relacion_id;
    IF v_inverso_id IS NULL THEN
      RAISE EXCEPTION 'TIPO_RELACION_SIN_INVERSO: el tipo % no tiene inverso definido', NEW.tipo_relacion_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Crear la inversa si no existe (evita recursion del trigger)
    IF NOT EXISTS (
      SELECT 1 FROM familia
      WHERE persona_id = NEW.familiar_id
        AND familiar_id = NEW.persona_id
        AND fecha_eliminacion IS NULL
    ) THEN
      INSERT INTO familia (iglesia_id, persona_id, familiar_id, tipo_relacion_id)
      VALUES (NEW.iglesia_id, NEW.familiar_id, NEW.persona_id, v_inverso_id);
    END IF;
  END IF;

  -- Req 7.4: eliminar la inversa junto con la directa
  IF TG_OP = 'UPDATE'
     AND NEW.fecha_eliminacion IS NOT NULL
     AND OLD.fecha_eliminacion IS NULL THEN
    UPDATE familia
    SET fecha_eliminacion = now()
    WHERE persona_id = NEW.familiar_id
      AND familiar_id = NEW.persona_id
      AND fecha_eliminacion IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_familia_simetria
  AFTER INSERT OR UPDATE ON familia
  FOR EACH ROW EXECUTE FUNCTION fn_familia_simetria();
```

El `IF NOT EXISTS` corta la recursión: el `INSERT` de la inversa dispara el trigger de nuevo, encuentra que la directa ya existe y para. Sin esa guarda, se cuelga en bucle infinito.

`AFTER` y no `BEFORE`: la fila original tiene que existir antes de que la inversa la busque.

### familia_override

Ajuste manual, para los casos que el grafo de parentesco no puede resolver por sí solo (decisión del owner, 2026-07-17, respuesta a la pregunta 1 de PENDIENTES.md). Alcance deliberadamente acotado: se puede **incluir o excluir a una persona**, nunca fusionar o partir núcleos familiares completos — eso quedó explícitamente descartado para no arriesgar la consistencia del conteo.

```sql
CREATE TYPE familia_override_tipo_enum AS ENUM ('EXCLUIR', 'INCLUIR_CON');

CREATE TABLE familia_override (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id             UUID NOT NULL REFERENCES iglesia(id),
  persona_id             UUID NOT NULL REFERENCES persona(id),
  tipo                   familia_override_tipo_enum NOT NULL,
  persona_referencia_id  UUID REFERENCES persona(id),
  motivo                 TEXT,
  -- auditoria
  CONSTRAINT chk_familia_override_referencia CHECK (
    (tipo = 'EXCLUIR' AND persona_referencia_id IS NULL) OR
    (tipo = 'INCLUIR_CON' AND persona_referencia_id IS NOT NULL AND persona_referencia_id <> persona_id)
  )
);

CREATE UNIQUE INDEX uq_familia_override_persona
  ON familia_override (persona_id) WHERE fecha_eliminacion IS NULL;
```

`EXCLUIR`: la persona queda como una familia de uno, sin importar sus relaciones reales — el caso típico es alguien que vive registrado con parientes pero que la iglesia considera un hogar aparte. `INCLUIR_CON`: agrega a la persona al núcleo de `persona_referencia_id` aunque no exista relación de parentesco registrada entre ambas — el caso típico es una pareja de hecho o un familiar de crianza sin vínculo formal en `familia`.

Un solo override vigente por persona (`uq_familia_override_persona`): no tiene sentido estar excluido e incluido a la vez.

### referencia_familiar

```sql
CREATE TABLE referencia_familiar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id        UUID NOT NULL REFERENCES iglesia(id),
  persona_id        UUID NOT NULL REFERENCES persona(id),
  nombre_familiar   VARCHAR(200) NOT NULL,
  tipo_relacion_id  UUID NOT NULL REFERENCES tipo_relacion(id)
  -- auditoria
);
```

No entra en el conteo de familias (Requisito 8.3): es texto libre y no se puede saber si "Juan Pérez" es una persona o tres homónimos.

## Conteo de familias

`software/bd-modelo.md` lo dejó abierto. Esta es la propuesta.

### El problema

La iglesia quiere saber cuántas familias tiene. Tres definiciones posibles:

| Definición | Problema |
|-----------|----------|
| Una tabla `familia` con miembros, llenada a mano | Duplica lo que ya dicen las relaciones. Se desincroniza el día uno: alguien registra "Juan es hijo de Pedro" y olvida meterlo al núcleo. |
| Familia = pareja + hijos, calculada desde el cónyuge | No cuenta a los solteros, ni a las madres solas, ni a los viudos. Deja gente fuera del total. |
| **Familia = componente conexo del grafo de relaciones directas** | Ninguno de los dos. Se explica abajo. |

### La propuesta

Un Nucleo_Familiar es un **componente conexo** del grafo cuyos nodos son personas y cuyas aristas son las relaciones con `cuenta_para_familia = true`.

En cristiano: si puedo llegar de Juan a María saltando de pariente directo en pariente directo, son la misma familia. Si no, son dos.

```
Juan --conyuge-- Maria
 |                 |
hijo              hijo
 |                 |
Pedro           Pedro     -> un solo nucleo: {Juan, Maria, Pedro}

Ana (sin relaciones)      -> un nucleo: {Ana}
```

Tres ventajas:

1. **No se desincroniza.** Se deriva de las relaciones que el líder ya registra. No hay un segundo lugar que mantener.
2. **Nadie queda fuera.** El Requisito 9.6 hace que una persona sola sea una familia de uno. El total de personas nunca supera al total de familias por accidente.
3. **Es configurable.** Cambiar qué cuenta como directo es un `UPDATE` a `cuenta_para_familia`, no una migración (Requisito 9.5).

### Implementación

```sql
CREATE OR REPLACE FUNCTION fn_nucleos_familiares(p_iglesia_id UUID)
RETURNS TABLE (persona_id UUID, nucleo_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE
  -- Personas con override EXCLUIR vigente: quedan aisladas, sus aristas reales se descartan
  excluida AS (
    SELECT persona_id FROM familia_override
    WHERE iglesia_id = p_iglesia_id AND tipo = 'EXCLUIR' AND fecha_eliminacion IS NULL
  ),
  -- Aristas reales vigentes que cuentan para familia, segun la configuracion de ESTA iglesia
  arista_real AS (
    SELECT f.persona_id AS a, f.familiar_id AS b
    FROM familia f
    JOIN tipo_relacion tr ON tr.id = f.tipo_relacion_id
    WHERE f.iglesia_id = p_iglesia_id
      AND f.fecha_eliminacion IS NULL
      AND tr.activo
      AND fn_config_bool(p_iglesia_id, 'FAMILIA_CUENTA_' || tr.codigo)
      AND f.persona_id NOT IN (SELECT persona_id FROM excluida)
      AND f.familiar_id NOT IN (SELECT persona_id FROM excluida)
  ),
  -- Aristas forzadas por override INCLUIR_CON, simetricas, sin pasar por excluidas
  arista_override AS (
    SELECT persona_id AS a, persona_referencia_id AS b
    FROM familia_override
    WHERE iglesia_id = p_iglesia_id AND tipo = 'INCLUIR_CON' AND fecha_eliminacion IS NULL
      AND persona_id NOT IN (SELECT persona_id FROM excluida)
      AND persona_referencia_id NOT IN (SELECT persona_id FROM excluida)
    UNION ALL
    SELECT persona_referencia_id AS a, persona_id AS b
    FROM familia_override
    WHERE iglesia_id = p_iglesia_id AND tipo = 'INCLUIR_CON' AND fecha_eliminacion IS NULL
      AND persona_id NOT IN (SELECT persona_id FROM excluida)
      AND persona_referencia_id NOT IN (SELECT persona_id FROM excluida)
  ),
  arista AS (
    SELECT a, b FROM arista_real
    UNION
    SELECT a, b FROM arista_override
  ),
  -- Nodos: todas las personas vigentes de la iglesia (Req 9.6: incluye aisladas y excluidas)
  nodo AS (
    SELECT p.id
    FROM persona p
    WHERE p.iglesia_id = p_iglesia_id
      AND p.fecha_eliminacion IS NULL
  ),
  -- Alcance: desde cada persona, a quienes puede llegar
  alcance AS (
    SELECT n.id AS origen, n.id AS alcanzado
    FROM nodo n
    UNION
    SELECT al.origen, ar.b
    FROM alcance al
    JOIN arista ar ON ar.a = al.alcanzado
    JOIN nodo n ON n.id = ar.b
  )
  -- El nucleo se identifica por el UUID minimo de su componente:
  -- es estable, no depende del orden de recorrido
  SELECT origen AS persona_id, MIN(alcanzado) AS nucleo_id
  FROM alcance
  GROUP BY origen;
$$;
```

El truco está en la última línea. Como las relaciones son simétricas (el disparador lo garantiza), todos los miembros de un componente se alcanzan entre sí, así que **todos calculan el mismo mínimo**. Ese mínimo es el identificador del núcleo. No hace falta union-find ni tabla de nodos: dos líneas de agregación.

Conteo (Requisito 9.8):

```sql
CREATE OR REPLACE FUNCTION fn_total_familias(p_iglesia_id UUID)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(DISTINCT nucleo_id) FROM fn_nucleos_familiares(p_iglesia_id);
$$;
```

Detalle para el dashboard:

```sql
CREATE OR REPLACE FUNCTION fn_familias_detalle(p_iglesia_id UUID)
RETURNS TABLE (nucleo_id UUID, cantidad_personas BIGINT, integrantes TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT nf.nucleo_id,
         count(*) AS cantidad_personas,
         string_agg(fn_nombre_completo(p), ', ' ORDER BY p.primer_apellido) AS integrantes
  FROM fn_nucleos_familiares(p_iglesia_id) nf
  JOIN persona p ON p.id = nf.persona_id
  GROUP BY nf.nucleo_id
  ORDER BY cantidad_personas DESC;
$$;
```

Se consume por RPC: `POST /rest/v1/rpc/fn_total_familias` con `{"p_iglesia_id": "..."}`.

`SECURITY DEFINER` en estas funciones exige verificar el acceso a mano, porque saltan RLS:

```sql
IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
  RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
END IF;
```

Va al inicio de cada una. Es la contrapartida de usar `SECURITY DEFINER`: se gana el salto de RLS y se paga con una verificación explícita.

### Por qué HERMANO no cuenta

Es la decisión discutible del diseño y conviene dejarla escrita.

`bd-modelo.md` lista como directos a "esposo/esposa, hijos, abuelos" — hermano no aparece. Y hay una razón estructural: si dos hermanos ya son hijos del mismo padre registrado, el grafo **los une igual** por el camino `hermano1 → padre → hermano2`. La arista de hermano es redundante.

Pero si el padre no está registrado, dos hermanos sin arista quedan como dos familias separadas. Eso es un problema real.

Se deja `FAMILIA_CUENTA_HERMANO = false` por defecto siguiendo el documento, y el Supervisor lo puede activar desde su panel (`configuracion_valor`). Si el conteo de familias sale más alto de lo que el pastor espera, esta es la primera perilla a mover.

### El riesgo de ABUELO

Incluir abuelos hace que tres generaciones colapsen en un solo núcleo:

```
Abuelo -- Padre -- Hijo
   \_______________/
      un solo nucleo de 3 generaciones
```

Si la iglesia entiende por "familia" un hogar, esto lo subcuenta: la casa del abuelo y la del hijo casado son dos hogares y el sistema reportará uno.

`bd-modelo.md` incluye explícitamente a los abuelos, así que el valor por defecto los respeta (modo "linaje"). Pero si el pastor dice que el número le sale bajo, la causa es esta, y se corrige poniendo `FAMILIA_CUENTA_ABUELO` y `FAMILIA_CUENTA_NIETO` en `false` desde el panel — sin tocar código, y sin afectar a la otra iglesia (modo "hogar"). Confirmado por el owner (2026-07-17): el sistema debe ofrecer las dos definiciones como configurables, no fijar una — ver la tabla de códigos de configuración más arriba.

### Rendimiento

El CTE recursivo es O(personas × aristas) en el peor caso. Con 5.000 personas y ~8.000 relaciones corre en decenas de milisegundos, porque el grafo familiar es disperso: los componentes son de 3 a 6 personas, no de 5.000.

Si algún día el dashboard lo pide en cada carga, se materializa:

```sql
CREATE MATERIALIZED VIEW mv_nucleo_familiar AS
  SELECT i.id AS iglesia_id, nf.* FROM iglesia i,
  LATERAL fn_nucleos_familiares(i.id) nf;
CREATE UNIQUE INDEX ON mv_nucleo_familiar (persona_id);
```

Refrescada por cron nocturno. **No se hace ahora**: agrega una capa de staleness para resolver un problema que a esta escala no existe. Se deja anotado por si aparece.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Familia = componente conexo | Tabla `nucleo_familiar` manual | Se desincroniza. La derivación no puede quedar desactualizada. |
| `MIN(uuid)` como id de núcleo | Union-find en PL/pgSQL | Dos líneas de SQL contra cien de procedimiento, mismo resultado. |
| `cuenta_para_familia` en catálogo | Lista fija en la función | El Requisito 9.5 exige que el Supervisor lo cambie sin migración. |
| `array_to_string` para el nombre | `CASE` con `COALESCE` y `\|\|` | El del documento produce espacios dobles y acumula `segundo_apellido` con `apellido_casada`. |
| Simetría por disparador | Consultar las dos direcciones | Sin simetría, cada consulta de parentela necesita `UNION`, y el CTE recursivo del conteo tendría que recorrer aristas en ambos sentidos. |
| CI único global | CI único por iglesia | Un CI identifica a un boliviano. La misma persona en dos iglesias es un error que hay que detectar, no permitir. |
| `persona_detalle` aparte | Todo en `persona` | SRP: la tabla que todo consulta no debe cargar columnas que casi nadie lee. |
| `cuenta_para_familia` en `configuracion_valor` por iglesia | Columna global en `tipo_relacion` | El Supervisor de una iglesia no puede tocar el conteo de otra. Decisión del owner, 2026-07-17. |
| `familia_override` limitado a incluir/excluir personas | Permitir fusionar/partir núcleos completos | El owner descartó explícitamente la opción amplia: mover personas puntuales alcanza para los casos raros, sin arriesgar la consistencia del conteo general. |
| `mostrar_apellido_casada` como interruptor | Vaciar/reconstruir `apellido_casada` al cambiar de idea | Un booleano es reversible en un clic y no destruye el dato ni reescribe el nombre completo. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Incluir ABUELO subcuenta los hogares. | Configurable por iglesia (`FAMILIA_CUENTA_ABUELO`/`FAMILIA_CUENTA_NIETO`). Confirmado por el owner: ambas definiciones (hogar/linaje) deben poder convivir según la iglesia. |
| Excluir HERMANO sobrecuenta cuando el padre no está registrado. | Configurable (`FAMILIA_CUENTA_HERMANO`). Es la primera perilla si el número sale alto. |
| El disparador de simetría entra en bucle. | El `IF NOT EXISTS` lo corta. Verificar con la tarea 5.4. |
| Alguien registra a la misma persona dos veces sin CI y aparece como dos familias. | `uq_persona_ci` solo actúa si hay CI. Mitigación: alerta de posibles duplicados por nombre + fecha de nacimiento en el panel del Supervisor. **Pendiente de decidir**. |
| `fn_nucleos_familiares` es `SECURITY DEFINER` y salta RLS. | Verificación explícita de `fn_mis_iglesias()` al inicio. Sin eso, cualquiera lee cualquier iglesia. Es la tarea 6.5 y no es opcional. |
| Un `familia_override` mal puesto (ej. `INCLUIR_CON` hacia una persona `EXCLUIR`) queda sin efecto silenciosamente. | Documentado: los overrides que tocan a una persona excluida se ignoran en `fn_nucleos_familiares`. El panel del Supervisor debería avisar si eso ocurre, para que no parezca un bug. |
