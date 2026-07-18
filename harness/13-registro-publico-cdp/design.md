# Diseño — Registro Público por URL de Líder

## Resumen

Una tabla (`casa_paz_url`) y dos funciones `SECURITY DEFINER` (una de lectura, una de escritura) son la única puerta que el rol `anon` tiene hacia datos de negocio. Todo lo demás sigue exactamente como en `00-fundacion`: RLS en toda tabla, cero permisos directos de `anon`, auditoría por disparador.

La regla que gobierna este diseño: **`anon` nunca toca una tabla, solo llama a una función.** `01-tenancy-iglesias` Requisito 4.6 dice "revocar todo acceso del rol `anon` a los datos de negocio" — ese requisito sigue vigente al pie de la letra. La función es la excepción explícita y acotada, no una grieta en la regla.

## Arquitectura

```
Visitante sin sesion
        |
        v
  GET /registro/<slug>            POST /registro/<slug>
        |                                |
        v                                v
  fn_resolver_url_registro(slug)   fn_registrar_persona_via_url(slug, datos)
        |                                |
        v                                v
  SOLO LECTURA, minima          INSERT persona + persona_detalle +
  (nombre lider, nombre CdP,    persona_llegada + casa_de_paz_membresia
   admite_registro: bool)       (una transaccion, o ninguna fila)
```

`anon` recibe `GRANT EXECUTE` sobre esas dos funciones y nada más. No hay `GRANT SELECT`, no hay policy de `anon` en ninguna tabla. Si mañana alguien agrega una tercera función pública, el checklist de este documento (sección Seguridad) es lo que hay que volver a pasar.

## Esquema

```sql
CREATE TYPE estado_url_enum AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

CREATE TABLE casa_paz_url (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id            UUID NOT NULL REFERENCES iglesia(id),
  persona_id            UUID NOT NULL REFERENCES persona(id),        -- el lider
  casa_de_paz_id        UUID NOT NULL REFERENCES casa_de_paz(id),    -- fija, ver Requisito 1.2
  casa_de_paz_cargo_id  UUID NOT NULL REFERENCES casa_de_paz_cargo(id), -- la asignacion que la origino
  slug                  VARCHAR(160) NOT NULL,
  estado                estado_url_enum NOT NULL DEFAULT 'INACTIVO',
  fecha_activacion      TIMESTAMPTZ,
  fecha_desactivacion   TIMESTAMPTZ,
  -- auditoria: los seis campos de 00-fundacion
);

CREATE UNIQUE INDEX uq_casa_paz_url_slug ON casa_paz_url (slug) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_casa_paz_url_iglesia ON casa_paz_url (iglesia_id) WHERE fecha_eliminacion IS NULL;
```

`casa_de_paz_cargo_id` (no solo `persona_id` + `casa_de_paz_id`) ata la URL a la asignación exacta que la creó. Es lo que permite al disparador del Requisito 3 encontrar "la URL que nació de esta asignación" sin ambigüedad cuando la misma persona vuelve a liderar la misma CdP en otra fecha.

`persona_llegada` gana una columna para el Requisito 6.8:

```sql
ALTER TABLE persona_llegada ADD COLUMN casa_paz_url_id UUID REFERENCES casa_paz_url(id);
```

Nulable: la inmensa mayoría de las llegadas no viene de una URL. Reutilizar `persona_llegada` evita una tabla de auditoría paralela — el Requisito 6.3 ya exige crear una fila ahí por cada Registro_Anonimo, así que es el mismo `INSERT` con un campo más.

## Slug

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;  -- agregar a 00_extensiones.sql

CREATE OR REPLACE FUNCTION fn_slugificar(p_texto TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(
    lower(unaccent(p_texto)), '[^a-z0-9]+', '-', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION fn_generar_slug_unico(p_base TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_slug TEXT := fn_slugificar(p_base);
  v_candidato TEXT := v_slug;
  v_contador INT := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM casa_paz_url WHERE slug = v_candidato AND fecha_eliminacion IS NULL) LOOP
    v_contador := v_contador + 1;
    v_candidato := v_slug || '-' || v_contador;
  END LOOP;
  RETURN v_candidato;
END;
$$;
```

`unaccent` en vez de un `translate()` a mano: cubre acentos, diéresis y eñes sin mantener una tabla de reemplazos. Es una extensión estándar de PostgreSQL, disponible en Supabase.

## Auto-creación y baja automática (Requisitos 1 y 3)

```sql
CREATE OR REPLACE FUNCTION fn_gestionar_casa_paz_url()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo VARCHAR;
  v_nombre_completo TEXT;
BEGIN
  SELECT codigo INTO v_codigo FROM cargo WHERE id = COALESCE(NEW.cargo_id, OLD.cargo_id);
  IF v_codigo IS DISTINCT FROM 'LIDER_CDP' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Alta: cargo nuevo y vigente -> crear URL (Requisito 1)
  IF TG_OP = 'INSERT' AND NEW.fecha_fin IS NULL THEN
    SELECT fn_nombre_completo(p) INTO v_nombre_completo FROM persona p WHERE p.id = NEW.persona_id;

    INSERT INTO casa_paz_url (iglesia_id, persona_id, casa_de_paz_id, casa_de_paz_cargo_id, slug)
    VALUES (NEW.iglesia_id, NEW.persona_id, NEW.casa_de_paz_id, NEW.id, fn_generar_slug_unico(v_nombre_completo));

  -- Baja: se cerro la vigencia -> desactivar la URL que nacio de esta fila (Requisito 3)
  ELSIF TG_OP = 'UPDATE' AND OLD.fecha_fin IS NULL AND NEW.fecha_fin IS NOT NULL THEN
    UPDATE casa_paz_url
    SET estado = 'INACTIVO', fecha_desactivacion = now()
    WHERE casa_de_paz_cargo_id = NEW.id AND estado <> 'INACTIVO';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_gestionar_casa_paz_url
  AFTER INSERT OR UPDATE ON casa_de_paz_cargo
  FOR EACH ROW EXECUTE FUNCTION fn_gestionar_casa_paz_url();
```

Se dispara sobre `casa_de_paz_cargo` (08-estructura), no sobre una tabla nueva de "líderes": esa tabla ya es la fuente de verdad de quién lidera qué, con su propio `chk`/índice único de "un `LIDER_CDP` vigente por CdP" (`fn_validar_cdp_cargo`, `03-estructura` Requisito 7.1). Engancharse ahí evita mantener dos historiales del mismo hecho.

## Lectura pública (Requisito 5)

```sql
CREATE OR REPLACE FUNCTION fn_resolver_url_registro(p_slug VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT cpu.estado, fn_config_bool(cpu.iglesia_id, 'REGISTRO_URL_ACTIVO') AS iglesia_activa,
         fn_nombre_completo(p) AS lider_nombre, cdp.nombre AS cdp_nombre
  INTO r
  FROM casa_paz_url cpu
  JOIN persona p ON p.id = cpu.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cpu.casa_de_paz_id
  WHERE cpu.slug = p_slug AND cpu.fecha_eliminacion IS NULL;

  IF NOT FOUND OR r.estado <> 'ACTIVO' OR NOT r.iglesia_activa THEN
    RETURN jsonb_build_object('admite_registro', false);
  END IF;

  RETURN jsonb_build_object(
    'admite_registro', true,
    'lider_nombre', r.lider_nombre,
    'casa_de_paz_nombre', r.cdp_nombre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_resolver_url_registro(VARCHAR) TO anon, authenticated;
```

Un solo booleano (`admite_registro`) para "no existe", "inactivo" y "suspendido" (Requisito 5.2): distinguirlos le regalaría a un atacante la posibilidad de enumerar slugs válidos por fuerza bruta observando cuál devuelve "inactivo" en vez de "no existe".

## Escritura pública (Requisito 6 y 7)

```sql
CREATE OR REPLACE FUNCTION fn_registrar_persona_via_url(p_slug VARCHAR, p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url casa_paz_url;
  v_persona_id UUID;
  v_intentos INT;
BEGIN
  SELECT * INTO v_url FROM casa_paz_url WHERE slug = p_slug AND fecha_eliminacion IS NULL;

  IF NOT FOUND OR v_url.estado <> 'ACTIVO'
     OR NOT fn_config_bool(v_url.iglesia_id, 'REGISTRO_URL_ACTIVO') THEN
    RAISE EXCEPTION 'REGISTRO_URL_NO_DISPONIBLE: el enlace no admite registro en este momento'
      USING ERRCODE = 'P0001';
  END IF;

  -- Requisito 7.4: limite de frecuencia por slug
  SELECT count(*) INTO v_intentos FROM persona_llegada
  WHERE casa_paz_url_id = v_url.id AND fecha_creacion > now() - interval '10 minutes';
  IF v_intentos >= 20 THEN
    RAISE EXCEPTION 'REGISTRO_URL_LIMITE_EXCEDIDO: demasiados registros recientes para este enlace'
      USING ERRCODE = 'P0001';
  END IF;

  -- INSERT persona: mismos campos/validaciones que 02-persona-parentela.
  -- iglesia_id e ci NUNCA vienen de p_datos: iglesia_id sale de v_url (Requisito 6.6),
  -- ci se toma tal cual del formulario y lo valida el UNIQUE INDEX existente.
  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_url.iglesia_id, p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  IF p_datos ? 'estado_civil' OR p_datos ? 'grado_instruccion' OR p_datos ? 'ocupacion' THEN
    INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
    VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
            (p_datos->>'grado_instruccion')::grado_instruccion_enum,
            p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');
  END IF;

  INSERT INTO persona_llegada (iglesia_id, persona_id, motivo_llegada_id, fecha_ingreso,
                                invitado_por_id, casa_paz_url_id)
  VALUES (v_url.iglesia_id, v_persona_id,
          (SELECT id FROM motivo_llegada WHERE codigo = 'INVITACION_PERSONAL'),
          CURRENT_DATE, v_url.persona_id, v_url.id);

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_url.iglesia_id, v_url.casa_de_paz_id, v_persona_id, true, CURRENT_DATE);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'casa_de_paz_nombre', (SELECT nombre FROM casa_de_paz WHERE id = v_url.casa_de_paz_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_registrar_persona_via_url(VARCHAR, JSONB) TO anon, authenticated;
```

Todos los `INSERT` corren dentro de la función `SECURITY DEFINER`: si cualquiera falla (por ejemplo, `ci` duplicado), PostgreSQL revierte toda la función — no hace falta una transacción explícita porque una función es, de por sí, atómica respecto al llamador (Requisito 6.4/6.5).

`p_datos` es `JSONB` y no columnas sueltas por dos razones: (1) reutiliza sin duplicar las validaciones de `chk_persona_nacimiento`, `uq_persona_ci`, `fn_persona_normalizar` y el enum de `sexo` — todas viven en la tabla `persona` y se disparan igual venga el `INSERT` de aquí o de un cliente autenticado; (2) los Campo_Configurable de `FORMULARIO_MEMBRESIA` (Requisito 5.6) ya se validan en el disparador que valida obligatoriedad — que hoy solo se especifica para el flujo autenticado, y esta función pasa por el mismo camino de `INSERT` en vez de reimplementarlo. `usuario_id`, `oculto`, `apellido_casada` no aparecen en `p_datos`: no son responsabilidad de un registro anónimo.

### Checklist de seguridad (repetir si se agrega una función pública nueva)

1. `SECURITY DEFINER` + `SET search_path = public` — sin esto, alguien podría manipular `search_path` para invocar una función homónima suya.
2. `GRANT EXECUTE` explícito, nunca `GRANT ALL`.
3. Cero `GRANT SELECT/INSERT/UPDATE` a `anon` en ninguna tabla — verificable con la misma consulta de auditoría que usa `12-pruebas-curl` para el Requisito 4.6 de `01-tenancy-iglesias`.
4. Todo dato identificable (`iglesia_id`, `casa_de_paz_id`, IDs internos) sale de la fila de `casa_paz_url` resuelta por el propio slug, nunca del payload del cliente.
5. La respuesta no devuelve IDs ni datos que no estén ya en el propio formulario que la persona llenó.
6. Límite de frecuencia dentro de la función, no solo a nivel de proxy/CDN.

## Panel del Supervisor

`fn_panel_configuracion` (10-panel-supervisor) ya devuelve las Configuracion por categoría; `REGISTRO_URL_ACTIVO` aparece ahí sin cambios en esa función, en la categoría `REGISTRO`. La lista de CasaPazURL de una Iglesia (Requisito 2.6) es una lectura autenticada normal, protegida por RLS igual que cualquier otra tabla — no necesita función `SECURITY DEFINER` porque quien la pide ya tiene sesión.

```sql
CREATE POLICY pol_casa_paz_url_select ON casa_paz_url FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()));

CREATE POLICY pol_casa_paz_url_update ON casa_paz_url FOR UPDATE TO authenticated
  USING (fn_es_operativo_en(iglesia_id)) WITH CHECK (fn_es_operativo_en(iglesia_id));
```

Sin policy de `INSERT`/`DELETE` para `authenticated`: la fila nace solo por el disparador del Requisito 1 (que corre como el `SECURITY DEFINER` del propio disparador de `casa_de_paz_cargo`, no como el usuario), y nunca se borra físicamente (`trg_no_delete`, igual que toda tabla).

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|------------------------|-------|
| Función `SECURITY DEFINER` acotada | Policy RLS de `INSERT` para `anon` en `persona` | Una policy de `anon` en una tabla de negocio es una superficie que crece sola: cualquier columna nueva de `persona` queda automáticamente alcanzable por `anon` salvo que alguien recuerde excluirla. Una función expone exactamente los campos que se listan. Ver pregunta resuelta con el owner, 2026-07-18. |
| URL fija a la CdP del momento de creación | Resolver la CdP "principal" del líder en cada visita | Sin ambigüedad cuando el líder tiene 2+ CdP. Confirmado con el owner, 2026-07-18. |
| Slug único global | Slug único por Iglesia con prefijo en la URL | Coincide con el formato de ejemplo de `nuevos_requisitos.txt` (sin segmento de iglesia). Confirmado con el owner, 2026-07-18. |
| `REGISTRO_URL_ACTIVO` booleano | Configuracion de texto con valores `CASA_DE_PAZ`/`AFIRMACION` | El Módulo 1 no implementa el flujo de Afirmación (`harness/README.md`, "No entra ahora"). Un booleano ya resuelve "prender/apagar los enlaces públicos"; el día que Afirmación exista, se decide entonces si necesita su propio valor o si "apagado" ya es suficiente. |
| Reutilizar `persona_llegada` con columna nueva | Tabla `casa_paz_url_registro` paralela | Evita una segunda tabla de auditoría del mismo hecho. `motivo_llegada = INVITACION_PERSONAL` ya describe correctamente el origen. |
| Mensaje único "no disponible" | Mensajes distintos por "no existe"/"inactivo"/"suspendido" | Evita que un tercero enumere slugs válidos comparando respuestas. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Un slug filtrado o adivinado permite spam de registros falsos. | Límite de frecuencia por slug (Requisito 7.4). El Supervisor puede pasar el Estado_URL a `SUSPENDIDO` sin perder el historial. |
| `p_datos` es JSONB: un cliente puede mandar claves que la función ignora silenciosamente. | Aceptable: la función solo lee las claves que necesita: enviar de más no rompe nada porque nunca se hace `INSERT ... SELECT * FROM jsonb_populate_record`. Si se agrega un campo al formulario, hay que agregar su línea en la función a mano — es intencional, no un descuido. |
| Alguien crea una Casa de Paz nueva y asigna líder antes de que el Supervisor sepa que debe activarla. | Ya cubierto: nace en `INACTIVO` (Requisito 1.7). No hay ventana donde una CdP nueva quede expuesta sin que alguien la active a propósito. |
| El disparador de `casa_de_paz_cargo` ahora hace más trabajo en cada `INSERT`/`UPDATE` de cargo. | Es una consulta a `cargo` por `codigo` y, cuando aplica, un `INSERT`/`UPDATE` de una fila. Mismo orden de magnitud que el resto de los disparadores de `03-estructura`; a esta escala es irrelevante (ver Riesgos de `00-fundacion`). |
