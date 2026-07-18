# Diseño — Estructura Organizacional

## Resumen

Iglesia → Red → Casa de Paz → Persona. Toda asignación de persona a estructura o cargo es un historial con `fecha_inicio` y `fecha_fin`, nunca una columna en la entidad. Los índices únicos parciales garantizan "un solo vigente" sin disparadores.

## La contradicción de los encargados obligatorios

`software/modulos.md` dice: *"Toda red debe tener un Encargado de Departamentos de Red y un Encargado de Ministerio de Red asignados. **Ninguna red puede existir sin estos perfiles.**"*

Pero `software/dashboards/supervisor.md` lista entre las alertas del Supervisor: *"Redes sin Encargado de Departamentos asignado"*.

Las dos cosas no pueden ser ciertas. Si ninguna red puede existir sin encargados, la alerta nunca se dispararía y sobra. Y hay un problema práctico anterior: para designar al encargado de una red hay que referenciar esa red, que todavía no existe. Como restricción dura, crear una red sería imposible.

**Resolución:** regla blanda. La Red se crea sin encargados (Requisito 1.9) y el sistema la marca como Red_Incompleta y la muestra en las alertas (Requisito 1.8). La obligatoriedad se hace cumplir avisando, no bloqueando — que es lo que el propio dashboard ya asumía.

```sql
CREATE OR REPLACE FUNCTION fn_redes_incompletas(p_iglesia_id UUID)
RETURNS TABLE (red_id UUID, red_nombre VARCHAR, falta_departamentos BOOLEAN, falta_ministerio BOOLEAN)
LANGUAGE sql STABLE
AS $$
  SELECT r.id, r.nombre,
         NOT EXISTS (SELECT 1 FROM red_cargo rc
                     JOIN cargo c ON c.id = rc.cargo_id
                     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_DEPARTAMENTOS_RED'
                       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL),
         NOT EXISTS (SELECT 1 FROM red_cargo rc
                     JOIN cargo c ON c.id = rc.cargo_id
                     WHERE rc.red_id = r.id AND c.codigo = 'ENCARGADO_MINISTERIO_RED'
                       AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL)
  FROM red r
  WHERE r.iglesia_id = p_iglesia_id AND r.activo AND r.fecha_eliminacion IS NULL;
$$;
```

Se filtra por `falta_departamentos OR falta_ministerio` para la alerta.

## Esquema

### red

```sql
CREATE TABLE red (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  nombre      VARCHAR(150) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true
  -- auditoria
);
```

Sin `lider_id`. El líder vive en `red_cargo`, porque cambia y el pasado importa.

### casa_de_paz

```sql
CREATE TABLE casa_de_paz (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  nombre      VARCHAR(150) NOT NULL,
  capacidad   SMALLINT,
  activo      BOOLEAN NOT NULL DEFAULT true
  -- auditoria
);

CREATE TABLE casa_de_paz_red (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  red_id          UUID NOT NULL REFERENCES red(id),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  -- auditoria
  CONSTRAINT chk_cdp_red_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_cdp_red_vigente
  ON casa_de_paz_red (casa_de_paz_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;
```

`red_id` **no** está en `casa_de_paz` sino en `casa_de_paz_red`. Es más caro de consultar (un JOIN) pero es lo que exige el Requisito 2.3: `domain_knowledge` dice que una CdP puede cambiar de red y que el historial importa. Una columna en `casa_de_paz` perdería el pasado en cada `UPDATE`.

`uq_cdp_red_vigente` implementa el Requisito 2.4: una CdP no puede estar en dos redes a la vez.

La dirección de la CdP sale del Modelo_Hibrido vía `direccion_asignacion.casa_de_paz_id` (Requisito 2.10). No se duplica la dirección del anfitrión: es la misma dirección física, con dos asignaciones.

### Cargos

```sql
CREATE TYPE tipo_cargo_enum AS ENUM ('A', 'B');

CREATE TABLE cargo (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  VARCHAR(40) NOT NULL UNIQUE,
  nombre  VARCHAR(100) NOT NULL,
  tipo    tipo_cargo_enum NOT NULL,
  nivel   VARCHAR(20) NOT NULL,  -- VISION | IGLESIA | RED | CDP
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);
```

Semilla, de `domain_knowledge/cargos/cargos.md`:

| codigo | nombre | tipo | nivel |
|--------|--------|------|-------|
| `APOSTOL` | Apóstol | A | IGLESIA |
| `PASTOR` | Pastor | A | IGLESIA |
| `PROFETA` | Profeta | A | IGLESIA |
| `EVANGELISTA` | Evangelista | A | IGLESIA |
| `MAESTRO` | Maestro | A | IGLESIA |
| `MINISTRO` | Ministro | A | IGLESIA |
| `ANCIANO` | Anciano | A | IGLESIA |
| `DIACONO` | Diácono | A | IGLESIA |
| `SUPERVISOR_VISION` | Supervisor de la Visión en Acción | B | VISION |
| `ENCARGADO_DEPARTAMENTOS_VISION` | Encargado de Departamentos (Visión) | B | VISION |
| `ENCARGADO_MINISTERIOS_VISION` | Encargado General de Ministerios (Visión) | B | VISION |
| `LIDER_RED` | Líder de Red | B | RED |
| `SUBLIDER_RED` | Sublíder de Red | B | RED |
| `ENCARGADO_DEPARTAMENTOS_RED` | Encargado de Departamentos de Red | B | RED |
| `ENCARGADO_MINISTERIO_RED` | Encargado de Ministerio de Red | B | RED |
| `LIDER_CDP` | Líder de Casa de Paz | B | CDP |
| `SUBLIDER_CDP` | Sublíder de Casa de Paz | B | CDP |
| `LIDER_MINISTERIO` | Líder de Ministerio | B | IGLESIA |
| `LIDER_DEPARTAMENTO` | Líder de Departamento | B | IGLESIA |
| `OPERADOR` | Operador | B | IGLESIA |

`software/modulos.md` clasificaba `anciano` fuera de la lista Tipo A; `domain_knowledge/cargos/cargos.md` lo describe como reconocimiento ministerial permanente, igual que ministro y diácono. Se clasifica como **A**.

`SUPERVISOR_VISION` es Tipo B aunque `cargos.md` lo llame permanente: Tipo A significa "uno solo por persona", y una persona puede ser supervisor de dos iglesias. La permanencia se expresa con `fecha_fin IS NULL`, no con el tipo.

`MENTOR` no se siembra: `cargos.md` lo declara pendiente de definir. Se agrega cuando el dominio lo aclare — es una fila, no una migración.

```sql
CREATE TABLE persona_cargo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  persona_id    UUID NOT NULL REFERENCES persona(id),
  cargo_id      UUID NOT NULL REFERENCES cargo(id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  -- auditoria
  CONSTRAINT chk_persona_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
```

El Requisito 4.3 — un solo Tipo A vigente por persona — no se puede expresar con índice único, porque el tipo vive en `cargo` y no en `persona_cargo`. Dos opciones:

| Opción | Costo |
|--------|-------|
| Denormalizar `tipo` en `persona_cargo` + índice único parcial | Una columna redundante que puede desincronizarse. |
| **Disparador que consulta `cargo`** | Una consulta extra por escritura. Sin redundancia. |

Se elige el disparador: las escrituras de cargo son raras (unas pocas por mes) y la redundancia en una tabla de historial es peor que una consulta.

```sql
CREATE OR REPLACE FUNCTION fn_validar_persona_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tipo   tipo_cargo_enum;
  v_codigo VARCHAR;
  v_iglesia_persona UUID;
BEGIN
  SELECT tipo, codigo INTO v_tipo, v_codigo FROM cargo WHERE id = NEW.cargo_id;

  -- Req 7.3: la persona debe ser de la misma iglesia
  SELECT iglesia_id INTO v_iglesia_persona FROM persona WHERE id = NEW.persona_id;
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'CARGO_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  -- Decision del owner (mirar.txt #7): solo el Pastor asigna cargos ministeriales.
  -- Son titulos de reconocimiento sobre la persona (dato de catalogo), sin permisos
  -- de sistema asociados -- los permisos de software vienen de usuario_rol, no de aca.
  IF v_codigo IN ('PASTOR', 'PROFETA', 'EVANGELISTA', 'MAESTRO', 'APOSTOL')
     AND NEW.fecha_fin IS NULL
     AND NOT fn_es_pastor_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'CARGO_MINISTERIAL_SOLO_PASTOR: el cargo % solo puede asignarlo el Pastor de la iglesia %', v_codigo, NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Req 4.3: un solo Tipo A vigente por persona
  IF v_tipo = 'A' AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM persona_cargo pc
      JOIN cargo c ON c.id = pc.cargo_id
      WHERE pc.persona_id = NEW.persona_id
        AND c.tipo = 'A'
        AND pc.fecha_fin IS NULL
        AND pc.fecha_eliminacion IS NULL
        AND pc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'CARGO_TIPO_A_DUPLICADO: la persona % ya tiene un cargo Tipo A vigente', NEW.persona_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

`PASTOR`, `PROFETA`, `EVANGELISTA`, `MAESTRO` y `APOSTOL` son los cargos ministeriales que el owner nombró explícitamente (mirar.txt #7). Son **títulos**, no roles de software: no otorgan ningún permiso por sí mismos — quien decide qué puede hacer alguien en el sistema es `usuario_rol` ([01-tenancy-iglesias](../01-tenancy-iglesias/design.md)), nunca `persona_cargo`. Un Profeta puede no tener ninguna cuenta de sistema, y un `PASTOR` en `usuario_rol` no necesita este cargo registrado para operar — son dos capas independientes que hoy coinciden para el pastor, pero no tienen por qué.

El Requisito 4.7 dice que `activo` se deriva de `fecha_fin IS NULL` y no se asigna a mano. Eso cierra un pendiente de `software/pendientes.md` (*"definir si `activo` se calcula automáticamente o es manual"*). Se calcula: dos fuentes de verdad para el mismo hecho siempre divergen.

```sql
CREATE VIEW v_persona_cargo_vigente AS
  SELECT pc.*, c.codigo, c.nombre AS cargo_nombre, c.tipo, c.nivel
  FROM persona_cargo pc
  JOIN cargo c ON c.id = pc.cargo_id
  WHERE pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL;
```

### Cargos con ámbito

Ser "líder de red" sin decir de qué red no significa nada. Los cargos de nivel RED y CDP necesitan a qué instancia aplican:

```sql
CREATE TABLE red_cargo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id    UUID NOT NULL REFERENCES iglesia(id),
  red_id        UUID NOT NULL REFERENCES red(id),
  persona_id    UUID NOT NULL REFERENCES persona(id),
  cargo_id      UUID NOT NULL REFERENCES cargo(id),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  -- auditoria
  CONSTRAINT chk_red_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- Req 1.4 y 7.2: un solo lider vigente por red
CREATE UNIQUE INDEX uq_red_lider_vigente
  ON red_cargo (red_id, cargo_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL
    AND cargo_id IN (SELECT id FROM cargo WHERE codigo IN
        ('LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED'));
```

Ese índice **no funciona**: PostgreSQL exige que el predicado `WHERE` de un índice parcial sea inmutable, y una subconsulta no lo es. Se resuelve con disparador:

```sql
CREATE OR REPLACE FUNCTION fn_validar_red_cargo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo VARCHAR;
BEGIN
  SELECT codigo INTO v_codigo FROM cargo WHERE id = NEW.cargo_id;

  IF v_codigo IN ('LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED')
     AND NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM red_cargo rc
      WHERE rc.red_id = NEW.red_id
        AND rc.cargo_id = NEW.cargo_id
        AND rc.fecha_fin IS NULL
        AND rc.fecha_eliminacion IS NULL
        AND rc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'RED_CARGO_DUPLICADO: la red % ya tiene un % vigente', NEW.red_id, v_codigo
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

`SUBLIDER_RED` no está en la lista: el Requisito 1.5 permite varios.

```sql
CREATE TABLE casa_de_paz_cargo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  persona_id      UUID NOT NULL REFERENCES persona(id),
  cargo_id        UUID NOT NULL REFERENCES cargo(id),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  -- auditoria
  CONSTRAINT chk_cdp_cargo_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
```

Mismo disparador, con `LIDER_CDP` y `ANFITRION` limitados a uno vigente (Requisitos 2.5, 2.7) y `SUBLIDER_CDP` sin límite (Requisito 2.6: *"puede haber de 0 a infinito sublíderes"*).

El Requisito 2.8 — una persona lidera varias CdP — sale gratis: el índice restringe por `casa_de_paz_id`, no por `persona_id`.

`ANFITRION` se agrega al catálogo de cargos como Tipo B nivel CDP. `cargos.md` no lo lista entre los cargos porque lo trata como función, pero estructuralmente es idéntico: una persona, un ámbito, un historial.

### Membresía

```sql
CREATE TABLE casa_de_paz_membresia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id      UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  persona_id      UUID NOT NULL REFERENCES persona(id),
  es_principal    BOOLEAN NOT NULL DEFAULT true,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  -- auditoria
  CONSTRAINT chk_membresia_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- Req 3.2: una sola CdP principal vigente por persona
CREATE UNIQUE INDEX uq_membresia_principal_vigente
  ON casa_de_paz_membresia (persona_id)
  WHERE es_principal AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
```

Aquí sí funciona el índice parcial: `es_principal` es una columna de la propia tabla, no una subconsulta.

`es_principal` permite que alguien figure en dos CdP (Requisito 3.3) sin romper la unicidad: una principal, las demás no. La migración automática por 8 visitas ([05-estados-ssva](../05-estados-ssva/)) cambia cuál es la principal.

#### Miembro_CdP y Miembro_Iglesia

`domain_knowledge/cargos/cargos.md` dice las dos cosas en la misma página: *"Una persona se considera miembro una vez que se bautiza"* y, tres líneas abajo, *"Miembro: persona que asiste por segunda vez consecutiva"*.

Son dos conceptos:

| Concepto | Se alcanza por | Dónde vive | Módulo |
|----------|---------------|-----------|--------|
| **Miembro_CdP** | 2 visitas consecutivas | `casa_de_paz_membresia` | 1 |
| **Miembro_Iglesia** | Bautizo | `afirmacion.fecha_bautizo` | 3 |

Nunca se mezclan. Cuando un dashboard diga "miembros", tiene que decir de cuál habla. En el Módulo 1 solo existe el primero.

### Ministerios

```sql
CREATE TABLE ministerio (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  codigo      VARCHAR(40) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);

CREATE UNIQUE INDEX uq_ministerio_codigo_iglesia
  ON ministerio (iglesia_id, codigo) WHERE fecha_eliminacion IS NULL;
```

`iglesia_id` es obligatorio y no hay `red_id` (Requisitos 5.1 y 5.2). *"Todos los ministerios son de la iglesia. No existen ministerios a nivel de red"* — la ausencia de columna hace la regla inviolable. No hace falta disparador para el Requisito 5.2: no hay dónde poner la red.

Los 14: Alabanza, Danza, Comunicación, Niños, Jóvenes, Protocolo, Ujieres, Parqueo, Cocina, Evangelismo, Sonido, Testimonios, Escuderos, Intercesión. Se siembran por iglesia.

Evangelismo Élite **no** es un ministerio 15: `ministerios.md` lo describe como equipo dentro del Ministerio de Evangelismo. Se modela como `ministerio_equipo` cuando llegue el Módulo 2. No se hace ahora.

```sql
CREATE TABLE ministerio_persona (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id     UUID NOT NULL REFERENCES iglesia(id),
  ministerio_id  UUID NOT NULL REFERENCES ministerio(id),
  persona_id     UUID NOT NULL REFERENCES persona(id),
  es_lider       BOOLEAN NOT NULL DEFAULT false,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE,
  -- auditoria
  CONSTRAINT chk_ministerio_persona_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_ministerio_lider_vigente
  ON ministerio_persona (ministerio_id)
  WHERE es_lider AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
```

#### El cruce red × ministerio

Es la regla de negocio nº 1 de `modulos.md`: *"Cuando un miembro sirve en un ministerio, el sistema no debe perder el rastro de la red a la que pertenece"*.

La tentación es poner `red_id` en `ministerio_persona`. Sería un error: cuando la persona cambie de CdP, ese `red_id` queda mintiendo. El Requisito 5.9 lo prohíbe. La red se **deriva**:

```sql
CREATE OR REPLACE FUNCTION fn_ministerio_por_red(p_iglesia_id UUID)
RETURNS TABLE (red_nombre VARCHAR, ministerio_nombre VARCHAR, cantidad BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(r.nombre, 'Sin Red'), m.nombre, count(DISTINCT mp.persona_id)
  FROM ministerio_persona mp
  JOIN ministerio m ON m.id = mp.ministerio_id
  LEFT JOIN casa_de_paz_membresia mem ON mem.persona_id = mp.persona_id
       AND mem.es_principal AND mem.fecha_fin IS NULL AND mem.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = mem.casa_de_paz_id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r ON r.id = cdr.red_id
  WHERE mp.iglesia_id = p_iglesia_id
    AND mp.fecha_fin IS NULL
    AND mp.fecha_eliminacion IS NULL
  GROUP BY r.nombre, m.nombre
  ORDER BY COALESCE(r.nombre, 'Sin Red'), m.nombre;
$$;
```

Cuatro JOINs, pero siempre correcto. Es lo que necesita el Encargado General de Ministerios (Requisito 5.8) para su pregunta real: *"¿cuántas personas de la Red de Jóvenes sirven en Danza?"*.

Quien no tiene CdP **sí aparece**, agrupado bajo `'Sin Red'` (decisión del owner, 2026-07-17, respuesta a la pregunta 6 de PENDIENTES.md): el flujo normal exige que toda persona tenga Casa de Paz antes de servir en un ministerio, pero el sistema admite excepciones (migración de datos, casos administrativos). `LEFT JOIN` en toda la cadena — membresía, red, casa de paz — asegura que el total general del Encargado siempre cierre con el total por red, y que la fila "Sin Red" funcione como alerta visual de a quién falta ubicar.

### Departamentos

```sql
CREATE TABLE departamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  codigo      VARCHAR(20) NOT NULL,   -- EVANGELISMO | AFIRMACION | DISCIPULADO | ENVIO
  nombre      VARCHAR(100) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true
  -- auditoria
);
```

`activo` lo maneja el Supervisor desde su panel (Requisito 6.3). En el Módulo 1 los cuatro se siembran, pero solo Evangelismo tiene funcionalidad real ([06-evangelismo-cdp](../06-evangelismo-cdp/)). Los otros tres existen para que el dashboard los muestre y el Supervisor los pueda apagar.

## Reglas de integridad

```sql
-- Req 7.5: no desactivar una red con CdP vigentes
CREATE OR REPLACE FUNCTION fn_validar_red_desactivacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.activo AND NOT NEW.activo THEN
    IF EXISTS (
      SELECT 1 FROM casa_de_paz_red cdr
      JOIN casa_de_paz c ON c.id = cdr.casa_de_paz_id
      WHERE cdr.red_id = NEW.id AND cdr.fecha_fin IS NULL
        AND c.activo AND c.fecha_eliminacion IS NULL
    ) THEN
      RAISE EXCEPTION 'RED_CON_CDP_ACTIVAS: la red % tiene casas de paz vigentes; reasignelas antes de desactivar', NEW.nombre
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Req 7.6: desactivar una CdP cierra sus membresias
CREATE OR REPLACE FUNCTION fn_cdp_desactivacion_cierra_membresias()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.activo AND NOT NEW.activo THEN
    UPDATE casa_de_paz_membresia
    SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = NEW.id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Encargados obligatorios como alerta | `NOT NULL` en `red` | Haría imposible crear una red: el encargado necesita que la red exista. El propio dashboard ya lo trataba como alerta. |
| `casa_de_paz_red` como historial | `red_id` en `casa_de_paz` | El dominio exige conservar los cambios de red. Una columna los pierde. |
| Tipo A por disparador | `tipo` denormalizado en `persona_cargo` | Las escrituras de cargo son raras. Una columna redundante en historial diverge. |
| `activo` derivado de `fecha_fin` | `activo` manual | Cierra el pendiente de `pendientes.md`. Dos fuentes de verdad divergen. |
| Red derivada por JOIN | `red_id` en `ministerio_persona` | Al cambiar de CdP, la columna mentiría. El Requisito 5.9 lo prohíbe. |
| Sin `red_id` en `ministerio` | Columna nulable | Sin columna, la regla "no hay ministerios de red" es inviolable. |
| `ANFITRION` como cargo | Tabla `anfitrion` aparte | Estructuralmente idéntico a los demás: persona, ámbito, historial. |
| Evangelismo Élite fuera | Ministerio nº 15 | Es un equipo dentro de Evangelismo, no un ministerio. Módulo 2. |
| `LEFT JOIN` + `'Sin Red'` en el cruce red × ministerio | Excluir a quien no tiene CdP | Decisión del owner (PENDIENTES.md #6): el sistema debe reflejar el total real de servidores y alertar sobre quién falta ubicar, no ocultarlo. |
| Cargos ministeriales (Pastor/Profeta/Evangelista/Maestro/Apóstol) solo los asigna el Pastor | Que cualquier operativo (incl. Supervisor) los asigne | Decisión explícita del owner (mirar.txt #7): son reconocimientos de mayor peso que el resto de los cargos Tipo B. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Cuatro JOINs para el cruce red × ministerio degradan el dashboard. | Índices en `casa_de_paz_membresia (persona_id) WHERE es_principal AND fecha_fin IS NULL` y en `casa_de_paz_red (casa_de_paz_id) WHERE fecha_fin IS NULL`. Con decenas de redes, es irrelevante. |
| Redes sin encargados para siempre porque nadie mira la alerta. | La alerta es permanente en el dashboard del Supervisor y no se puede descartar. Ver [09-dashboards](../09-dashboards/). |
| Una CdP queda sin red vigente por un `fecha_fin` mal puesto. | El Requisito 2.4 exige exactamente una vigente, pero el índice parcial solo impide **dos**, no **cero**. Agregar a la alerta del Supervisor: CdP sin red vigente. |
| Alguien clasifica mal un cargo Tipo A/B y el disparador bloquea asignaciones legítimas. | El tipo vive en catálogo: se corrige con `UPDATE`, sin migración. |
| El Supervisor intenta asignar un cargo ministerial y el disparador lo bloquea sin explicación clara en el front. | El código de regla `CARGO_MINISTERIAL_SOLO_PASTOR` nombra el cargo y la iglesia; el front debe mostrar "Este cargo solo lo asigna el Pastor" en vez de un error genérico. |
