# Diseño — Reporte de Casa de Paz

## Resumen

Un `casa_de_paz_reporte` por reunión, y una fila de `casa_de_paz_asistencia` por persona presente. Los totales de menores y mayores no se guardan: se calculan.

## Por qué lista y no números

Es la decisión que más cambia respecto de `domain_knowledge`, así que conviene dejar el argumento por escrito.

`reporte.md` pide dos números: menores y mayores. `criterios.md`, en la misma carpeta, define cuatro reglas:

| Regla | Qué necesita saber |
|-------|-------------------|
| 2 visitas consecutivas → Miembro_CdP | **quién** vino las dos veces |
| 8 visitas consecutivas a otra CdP → migración | **quién** vino, y **dónde** |
| 12 inasistencias consecutivas → inactivo | **quién** faltó doce veces |
| +3 meses fuera y retorna → Reconciliado | **quién** volvió, y cuándo se fue |

Con `menores=5, mayores=12` ninguna es calculable. El sistema no puede saber que María lleva tres semanas sin venir, ni que Juan viene a otra casa desde hace dos meses. El panel de criterios del Supervisor sería decorativo: perillas que no mueven nada.

La frase de `reporte.md` ya apuntaba a la lista, además: *"Se documenta la asistencia de **cada persona** por tipo"*. "Cada persona" y "dos números" no son lo mismo.

### El costo

Al líder le cuesta más. Antes escribía dos números; ahora marca casillas. La mitigación es de diseño de formulario:

- La lista viene precargada con sus miembros. Marcar es un toque, no escribir.
- Los que vinieron la semana pasada aparecen primero.
- Agregar una visita pide tres campos: nombre, apellido, sexo.
- Los totales se muestran en vivo mientras marca, así que ve el número que antes escribía.

Una CdP tiene entre 8 y 20 personas. Son quince toques.

## Esquema

### casa_de_paz_reporte

```sql
CREATE TABLE casa_de_paz_reporte (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id               UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_id           UUID NOT NULL REFERENCES casa_de_paz(id),
  fecha_reunion            DATE NOT NULL,
  libro_id                 UUID REFERENCES cdp_libro(id),
  tema_id                  UUID REFERENCES cdp_tema(id),
  tema_especial_txt        VARCHAR(200),
  disertador_id            UUID REFERENCES persona(id),
  evento_megafiesta_id     UUID REFERENCES evento(id),
  salio_evangelizar        BOOLEAN NOT NULL DEFAULT false,
  evangelizados_declarados SMALLINT,
  testimonios              TEXT,
  comentarios              TEXT,
  -- auditoria

  CONSTRAINT chk_reporte_fecha CHECK (fecha_reunion <= CURRENT_DATE),

  -- Req 5.5: no se puede declarar evangelizados sin haber salido
  CONSTRAINT chk_reporte_evangelizados CHECK (
    salio_evangelizar OR COALESCE(evangelizados_declarados, 0) = 0
  ),

  CONSTRAINT chk_reporte_evangelizados_no_negativo CHECK (
    evangelizados_declarados IS NULL OR evangelizados_declarados >= 0
  )
);

CREATE UNIQUE INDEX uq_reporte_cdp_fecha
  ON casa_de_paz_reporte (casa_de_paz_id, fecha_reunion)
  WHERE fecha_eliminacion IS NULL;

CREATE INDEX idx_reporte_cdp_fecha ON casa_de_paz_reporte (casa_de_paz_id, fecha_reunion DESC)
  WHERE fecha_eliminacion IS NULL;
```

`uq_reporte_cdp_fecha` implementa el Requisito 1.3. Evita el reporte duplicado cuando el líder toca "enviar" dos veces con mala señal — que va a pasar.

`libro_id`, `tema_id` y `disertador_id` son nulables en el esquema aunque el Requisito 1.8 diga que la obligatoriedad la define el Supervisor. La razón: si fueran `NOT NULL`, apagar la obligatoriedad desde el panel requeriría un `ALTER TABLE`. La obligatoriedad configurable se valida en disparador, leyendo la configuración. Ver [10-panel-supervisor](../10-panel-supervisor/design.md).

`evangelizados_declarados` es `SMALLINT`: nadie evangeliza a 32.768 personas en una salida de casa de paz.

### Megafiesta de casas de paz

Decisión del owner (mirar.txt #5): la reunión especial "Megafiesta de Casas de Paz" se registra como un reporte normal, pero vinculado al evento del calendario — no como un simple casillero booleano. `evento_megafiesta_id` es nulable: `NULL` es una reunión de CdP común; con valor, la reunión fue la Megafiesta de la red ese día, y cualquier líder superior lo ve al consultar el reporte.

```sql
CREATE OR REPLACE FUNCTION fn_validar_reporte_megafiesta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evento    evento;
  v_tipo_cod  VARCHAR;
  v_red_cdp   UUID;
BEGIN
  IF NEW.evento_megafiesta_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_evento FROM evento WHERE id = NEW.evento_megafiesta_id;
  SELECT codigo INTO v_tipo_cod FROM tipo_evento WHERE id = v_evento.tipo_evento_id;

  IF v_tipo_cod IS DISTINCT FROM 'MEGA_FIESTA' THEN
    RAISE EXCEPTION 'REPORTE_EVENTO_NO_ES_MEGAFIESTA: el evento % no es una Mega Fiesta', NEW.evento_megafiesta_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.fecha_reunion IS DISTINCT FROM v_evento.fecha_inicio THEN
    RAISE EXCEPTION 'REPORTE_MEGAFIESTA_FECHA_DISTINTA: el reporte es del % y la Mega Fiesta es del %',
      NEW.fecha_reunion, v_evento.fecha_inicio USING ERRCODE = 'P0001';
  END IF;

  SELECT cdr.red_id INTO v_red_cdp
  FROM casa_de_paz_red cdr
  WHERE cdr.casa_de_paz_id = NEW.casa_de_paz_id
    AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL;

  IF v_red_cdp IS DISTINCT FROM v_evento.red_id THEN
    RAISE EXCEPTION 'REPORTE_MEGAFIESTA_RED_DISTINTA: la Mega Fiesta % no es de la red de esta casa de paz', NEW.evento_megafiesta_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_reporte_megafiesta
  BEFORE INSERT OR UPDATE ON casa_de_paz_reporte
  FOR EACH ROW EXECUTE FUNCTION fn_validar_reporte_megafiesta();
```

El evento de Mega Fiesta ya existe en el calendario de la red antes de que el líder reporte (ver [07-calendario-eventos](../07-calendario-eventos/design.md)); este disparador solo enlaza el reporte a ese evento y verifica que el enlace tenga sentido: mismo tipo, misma fecha, misma red.

### Libros y temas

```sql
CREATE TABLE cdp_libro (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero  SMALLINT NOT NULL,
  nombre  VARCHAR(100) NOT NULL DEFAULT '52 Lecciones de Vida',
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0,
  -- auditoria
  CONSTRAINT chk_libro_numero CHECK (numero BETWEEN 1 AND 7)
);

CREATE TABLE cdp_tema (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id UUID REFERENCES iglesia(id),
  libro_id   UUID NOT NULL REFERENCES cdp_libro(id),
  numero     SMALLINT,
  nombre     VARCHAR(200) NOT NULL,
  es_especial BOOLEAN NOT NULL DEFAULT false,
  activo     BOOLEAN NOT NULL DEFAULT true,
  orden      SMALLINT NOT NULL DEFAULT 0,
  -- auditoria
  CONSTRAINT chk_tema_numero CHECK (
    (es_especial AND numero IS NULL) OR
    (NOT es_especial AND numero BETWEEN 1 AND 52)
  )
);
```

Los 7 libros son globales: son los mismos en toda la red apostólica.

`cdp_tema.iglesia_id` es **nulable**: `NULL` significa tema oficial del libro, compartido por todas las iglesias; con valor, tema que agregó ese Supervisor. Así se cierra el pendiente de `software/pendientes.md` (*"definir si la tabla de temas es fija o configurable"*): **las dos cosas**. Los 52 vienen fijos y cada iglesia agrega los suyos sin tocar los ajenos.

El `CHECK` fuerza la coherencia: un tema especial no tiene número de semana; uno normal sí, entre 1 y 52.

Tema del libro correcto (Requisito 4.7):

```sql
CREATE OR REPLACE FUNCTION fn_validar_tema_libro()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_libro UUID;
BEGIN
  IF NEW.tema_id IS NULL THEN RETURN NEW; END IF;
  SELECT libro_id INTO v_libro FROM cdp_tema WHERE id = NEW.tema_id;
  IF v_libro IS DISTINCT FROM NEW.libro_id THEN
    RAISE EXCEPTION 'TEMA_LIBRO_INCONSISTENTE: el tema % no pertenece al libro %', NEW.tema_id, NEW.libro_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
```

**Resuelto parcialmente (PENDIENTES.md #3, 2026-07-17):** el owner no tiene a mano el índice oficial de los 7 tomos. Para no cargar 364 temas provisionales a mano, se siembran únicamente los **Libros 1, 2 y 3, con Temas 1, 2 y 3 de cada uno** (9 filas: "Libro 1 — Tema 1" ... "Libro 3 — Tema 3"), como nombres provisionales. Los Libros 4 a 7 y los Temas 4 a 52 de cada libro se agregan después desde el panel del Supervisor sin migración — `cdp_tema.iglesia_id` nulable ya lo permite (ver abajo), y `cdp_libro` admite las filas 4-7 en cualquier momento con un `INSERT` idéntico al de la semilla.

### casa_de_paz_asistencia

```sql
CREATE TABLE casa_de_paz_asistencia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID NOT NULL REFERENCES iglesia(id),
  reporte_id  UUID NOT NULL REFERENCES casa_de_paz_reporte(id),
  persona_id  UUID NOT NULL REFERENCES persona(id),
  es_visita   BOOLEAN NOT NULL DEFAULT false,
  es_menor    BOOLEAN
  -- auditoria
);

CREATE UNIQUE INDEX uq_asistencia_reporte_persona
  ON casa_de_paz_asistencia (reporte_id, persona_id)
  WHERE fecha_eliminacion IS NULL;

CREATE INDEX idx_asistencia_persona ON casa_de_paz_asistencia (persona_id)
  WHERE fecha_eliminacion IS NULL;
```

Una fila = una persona estuvo. **No hay fila de ausentes** (Requisito 2.9): la ausencia es la falta de fila. Guardar ausencias multiplicaría por cinco el volumen para expresar lo mismo, y obligaría a insertar filas por gente que no vino.

`idx_asistencia_persona` es crítico: las reglas de estado preguntan "las últimas N asistencias de esta persona" en cada evaluación.

#### es_menor y el problema de la edad

El Requisito 3.3 dice clasificar por edad. Pero la mitad de los visitantes no tiene `fecha_nacimiento` — llegaron esta noche y el líder anotó tres campos.

Por eso `es_menor` es nulable y funciona como respaldo:

```sql
CREATE OR REPLACE FUNCTION fn_asistencia_es_menor(p_asistencia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN p.fecha_nacimiento IS NOT NULL
      THEN EXTRACT(YEAR FROM age(r.fecha_reunion, p.fecha_nacimiento))
           < fn_criterio(r.iglesia_id, 'EDAD_MINIMA_CREYENTE')
    ELSE a.es_menor
  END
  FROM casa_de_paz_asistencia a
  JOIN casa_de_paz_reporte r ON r.id = a.reporte_id
  JOIN persona p ON p.id = a.persona_id
  WHERE a.id = p_asistencia_id;
$$;
```

La fecha de nacimiento gana siempre (Requisito 3.6): es dato duro. `es_menor` solo entra cuando no hay fecha. La edad se calcula **a la fecha de la reunión**, no a hoy — si no, un reporte de hace dos años reclasificaría a quien cumplió 12 en el medio, y los totales históricos cambiarían solos.

La frontera sale de `fn_criterio(iglesia_id, 'EDAD_MINIMA_CREYENTE')` y no de un `12` literal (Requisito 3.7), porque el Supervisor puede cambiarla. Ver [10-panel-supervisor](../10-panel-supervisor/).

```sql
CREATE OR REPLACE FUNCTION fn_validar_asistencia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tiene_fecha BOOLEAN;
  v_iglesia_persona UUID;
BEGIN
  SELECT fecha_nacimiento IS NOT NULL, iglesia_id
    INTO v_tiene_fecha, v_iglesia_persona
  FROM persona WHERE id = NEW.persona_id;

  -- Req 2.8
  IF v_iglesia_persona IS DISTINCT FROM NEW.iglesia_id THEN
    RAISE EXCEPTION 'ASISTENCIA_IGLESIA_DISTINTA: la persona % no pertenece a la iglesia %',
      NEW.persona_id, NEW.iglesia_id USING ERRCODE = 'P0001';
  END IF;

  -- Req 3.5
  IF NOT v_tiene_fecha AND NEW.es_menor IS NULL THEN
    RAISE EXCEPTION 'ASISTENCIA_EDAD_INDEFINIDA: la persona % no tiene fecha de nacimiento; indique es_menor',
      NEW.persona_id USING ERRCODE = 'P0001';
  END IF;

  -- Req 2.7: es_visita se deriva de la membresia, no lo manda el cliente
  NEW.es_visita := NOT EXISTS (
    SELECT 1 FROM casa_de_paz_membresia m
    JOIN casa_de_paz_reporte r ON r.id = NEW.reporte_id
    WHERE m.persona_id = NEW.persona_id
      AND m.casa_de_paz_id = r.casa_de_paz_id
      AND m.fecha_fin IS NULL
      AND m.fecha_eliminacion IS NULL
  );

  RETURN NEW;
END;
$$;
```

`es_visita` se **calcula**, no se acepta del cliente (Requisito 2.7). Si el cliente lo mandara, el líder podría marcar como miembro a alguien que no lo es y romper los conteos.

### Totales

```sql
CREATE VIEW v_reporte_totales AS
SELECT
  r.id AS reporte_id,
  r.casa_de_paz_id,
  r.fecha_reunion,
  count(a.id) FILTER (WHERE fn_asistencia_es_menor(a.id))     AS total_menores,
  count(a.id) FILTER (WHERE NOT fn_asistencia_es_menor(a.id)) AS total_mayores,
  count(a.id)                                                  AS total_asistentes,
  count(a.id) FILTER (WHERE a.es_visita)                       AS total_visitas
FROM casa_de_paz_reporte r
LEFT JOIN casa_de_paz_asistencia a
  ON a.reporte_id = r.id AND a.fecha_eliminacion IS NULL
WHERE r.fecha_eliminacion IS NULL
GROUP BY r.id, r.casa_de_paz_id, r.fecha_reunion;
```

**Bug encontrado y corregido (frontend Reportes):** `total_asistentes` usaba `count(*)` sobre el `LEFT JOIN`. Con cero filas de asistencia, el `LEFT JOIN` igual produce una fila (con `a.*` en NULL), así que `count(*)` daba `1` en vez de `0` — un reporte sin asistentes mostraba "1 asistente" en vez de "0". `count(a.id)` cuenta solo filas reales de `casa_de_paz_asistencia`, dando `0` correctamente. Corregido en `11-esquema-bd/sql/10_reporte.sql` y aplicado a Supabase.

`LEFT JOIN` para que un reporte sin asistentes aparezca con ceros en lugar de desaparecer. Un reporte con cero asistentes es un dato importante, no una fila a ocultar.

No hay columnas `total_menores` / `total_mayores` en la tabla (Requisito 3.2). Guardarlas crearía dos fuentes de verdad: alguien agrega una asistencia y el total queda viejo. Se calculan.

### Evangelizados: declarados vs registrados

`software/pendientes.md` preguntaba si el campo es informativo o se calcula. **Las dos cosas, y por separado.**

Calcularlo solo desde los registros de evangelismo pierde información: el líder salió con el equipo, hablaron con ocho personas y solo dos dejaron sus datos. El "8" es real y el pastor lo quiere. Pero tampoco se puede confiar solo en el número declarado, porque nadie lo verifica.

Se guardan los dos y se compara:

```sql
CREATE VIEW v_reporte_evangelismo AS
SELECT
  r.id AS reporte_id,
  r.casa_de_paz_id,
  r.fecha_reunion,
  r.salio_evangelizar,
  COALESCE(r.evangelizados_declarados, 0) AS declarados,
  count(e.id)                              AS registrados,
  COALESCE(r.evangelizados_declarados, 0) - count(e.id) AS diferencia
FROM casa_de_paz_reporte r
LEFT JOIN evangelismo e
  ON e.casa_de_paz_id = r.casa_de_paz_id
  AND e.fecha = r.fecha_reunion
  AND e.fecha_eliminacion IS NULL
WHERE r.fecha_eliminacion IS NULL
GROUP BY r.id, r.casa_de_paz_id, r.fecha_reunion, r.salio_evangelizar, r.evangelizados_declarados;
```

`diferencia <> 0` alimenta la alerta del Supervisor (Requisito 5.4). No es una acusación: casi siempre significa que hablaron con más gente de la que dejó datos. Pero un líder que declara 40 y registra 0 todas las semanas es visible.

### Reportes faltantes

```sql
CREATE OR REPLACE FUNCTION fn_cdp_sin_reporte(p_iglesia_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (casa_de_paz_id UUID, casa_de_paz_nombre VARCHAR, red_nombre VARCHAR, lider VARCHAR)
LANGUAGE sql STABLE
AS $$
  WITH semana AS (
    SELECT date_trunc('week', p_fecha)::date AS lunes,
           (date_trunc('week', p_fecha) + interval '6 days')::date AS domingo
  )
  SELECT c.id, c.nombre, r.nombre,
         (SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc ON cc.persona_id = p.id
          JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'LIDER_CDP'
          WHERE cc.casa_de_paz_id = c.id AND cc.fecha_fin IS NULL
            AND cc.fecha_eliminacion IS NULL
          LIMIT 1)
  FROM casa_de_paz c
  JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = c.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  JOIN red r ON r.id = cdr.red_id
  CROSS JOIN semana s
  WHERE c.iglesia_id = p_iglesia_id
    AND c.activo
    AND c.fecha_eliminacion IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM casa_de_paz_reporte rep
      WHERE rep.casa_de_paz_id = c.id
        AND rep.fecha_reunion BETWEEN s.lunes AND s.domingo
        AND rep.fecha_eliminacion IS NULL
    );
$$;
```

`date_trunc('week', ...)` de PostgreSQL devuelve el lunes (ISO-8601), que es lo que pide el Requisito 7.2. No hace falta configurar nada.

## Permisos

El Requisito 1.6 no se puede expresar solo con RLS por `iglesia_id`: cualquier líder de la iglesia pasaría el filtro y podría reportar por una casa ajena. La política tiene que mirar el cargo:

```sql
CREATE OR REPLACE FUNCTION fn_puede_reportar_cdp(p_casa_de_paz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Supervisor o pastor de esa iglesia
    fn_es_operativo_en((SELECT iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id))
    OR
    -- Lider o sublider vigente de esa CdP
    EXISTS (
      SELECT 1
      FROM casa_de_paz_cargo cc
      JOIN cargo c ON c.id = cc.cargo_id
      WHERE cc.casa_de_paz_id = p_casa_de_paz_id
        AND cc.persona_id = fn_mi_persona_id()
        AND c.codigo IN ('LIDER_CDP', 'SUBLIDER_CDP')
        AND cc.fecha_fin IS NULL
        AND cc.fecha_eliminacion IS NULL
    );
$$;

CREATE POLICY pol_reporte_insert ON casa_de_paz_reporte
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fn_puede_reportar_cdp(casa_de_paz_id)
  );

CREATE POLICY pol_reporte_select ON casa_de_paz_reporte
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);
```

`SELECT` es amplio a propósito (Requisito 1.7): el líder de red y el supervisor tienen que leer todos los reportes de su alcance. `INSERT` es estrecho.

La edición del sublíder (Requisito 6.2) depende de la configuración de la iglesia:

```sql
CREATE POLICY pol_reporte_update ON casa_de_paz_reporte
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR (fn_es_sublider_cdp(casa_de_paz_id)
          AND fn_config_bool(iglesia_id, 'SUBLIDER_PUEDE_EDITAR_REPORTE'))
    )
  );
```

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Lista de personas | Dos números | Sin lista, los 4 criterios de CdP son incalculables y el panel del Supervisor es decorativo. |
| Sin filas de ausentes | Fila por miembro con `presente` bool | Quintuplica el volumen para expresar lo mismo. La ausencia es la falta de fila. |
| Totales en vista | Columnas en la tabla | Dos fuentes de verdad. Agregar una asistencia dejaría el total viejo. |
| `es_menor` de respaldo | Exigir `fecha_nacimiento` siempre | El visitante de esta noche no la tiene. Exigirla mataría el alta rápida. |
| Edad a la fecha de reunión | Edad a hoy | Si no, los totales históricos cambian solos cuando alguien cumple años. |
| Declarados **y** registrados | Solo uno de los dos | El declarado tiene información que el registrado pierde; el registrado es verificable. La diferencia es la señal útil. |
| `tema.iglesia_id` nulable | Temas fijos, o todos por iglesia | Cierra el pendiente: los 52 oficiales son fijos, y cada iglesia agrega los suyos. |
| Campos nulables + validación configurable | `NOT NULL` en el esquema | Apagar la obligatoriedad desde el panel requeriría `ALTER TABLE`. |
| Megafiesta vinculada a `evento` | Un simple booleano `es_megafiesta` | Decisión del owner (mirar.txt #5): la megafiesta ya es un evento de la red en el calendario; vincularla evita una segunda fuente de verdad sobre qué día fue megafiesta. |
| Sembrar solo 3 libros × 3 temas | Sembrar 7×52 con nombres inventados | El owner no tiene el índice oficial (PENDIENTES.md #3) y prefirió no cargar 364 filas provisionales a mano. Ampliar después es un `INSERT`, no una migración. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Los líderes no adoptan la lista y dejan de reportar. | Es el riesgo principal del Módulo 1. Mitigación: formulario precargado, ordenado por asistencia reciente, con totales en vivo. Si aun así no ocurre, el fallback es el modo mixto (números ahora, lista después) que el esquema ya soporta: `casa_de_paz_asistencia` vacío y totales declarados. **No se implementa ahora.** |
| Personas duplicadas por alta rápida: "Juan Perez" se crea tres semanas seguidas. | El alta rápida no pide CI, así que `uq_persona_ci` no protege. Mitigación: al escribir el nombre, el formulario busca coincidencias en la CdP y la red y ofrece las existentes antes de crear. Alerta de duplicados en el panel del Supervisor. **Pendiente de diseñar en detalle.** |
| `fn_asistencia_es_menor` se llama por fila en la vista de totales y se vuelve lenta. | Con 20 asistentes por reporte es irrelevante. Si un dashboard agrega 52 semanas × 30 CdP, se materializa `v_reporte_totales`. Medir antes de optimizar. |
| El líder reporta la semana equivocada y el reporte correcto choca con `uq_reporte_cdp_fecha`. | El error dice qué reporte existe y con qué fecha. El formulario propone por defecto la fecha del último día de reunión de la CdP. |
