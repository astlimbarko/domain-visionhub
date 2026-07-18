# Diseño — Fundación

## Resumen

Toda tabla de VisionHub se construye sobre el mismo esqueleto: UUID como clave, seis campos de auditoría llenados por disparador, borrado lógico y RLS. Este documento define ese esqueleto una vez; las demás áreas lo aplican sin repetirlo.

La decisión que gobierna todo el diseño: **las reglas viven en PostgreSQL, no en el cliente**. La web de hoy y la app móvil de mañana hablan con la misma API de Supabase; si una regla vive en React, la app móvil la tendría que reimplementar y las dos se desviarían. Por eso cada regla es una restricción, una función o un disparador.

## Arquitectura

```
Cliente (web hoy, movil despues)
        |
        v
  Supabase API (PostgREST + Auth)
        |
        v
  RLS  ->  filtra filas por iglesia y rol
        |
        v
  Disparadores  ->  auditoria, historial, estados
        |
        v
  Restricciones ->  integridad
        |
        v
  PostgreSQL
```

Ninguna capa de abajo confía en la de arriba. Un cliente con el token de un líder de CdP no puede leer otra CdP aunque construya la consulta a mano, porque el filtro está en RLS y no en el cliente.

### Aplicación de SOLID

`Skills/solid.md` está escrito para sistemas de agentes de IA. VisionHub no lo es, pero tres de sus principios sí se trasladan y guían este diseño:

| Principio | Cómo se aplica aquí |
|-----------|---------------------|
| **SRP** | Una tabla, una responsabilidad. `persona` tiene identidad; `persona_detalle` tiene datos censales; `direccion` tiene ubicación. No se engorda `persona` con todo. |
| **OCP** | Agregar una iglesia, un ministerio o un tipo de ingreso no toca código: son filas de catálogo. Si agregar una iglesia obligara a modificar una política RLS, el diseño está mal. |
| **ISP / mínimo privilegio** | Cada rol recibe exactamente los permisos que necesita. El sublíder no ve montos salvo que el Supervisor los active. |

## Esqueleto de tabla

### Campos de auditoría

Toda tabla de dominio incluye estos seis campos, siempre en este orden y al final de la definición:

```sql
fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
fecha_actualizacion  TIMESTAMPTZ,
creado_por           UUID REFERENCES auth.users(id),
actualizado_por      UUID REFERENCES auth.users(id),
fecha_eliminacion    TIMESTAMPTZ,
eliminado_por        UUID REFERENCES auth.users(id)
```

`TIMESTAMPTZ` y no `TIMESTAMP`: Bolivia es UTC-4 y no aplica horario de verano, pero un `TIMESTAMP` sin zona se vuelve ambiguo apenas alguien consulte desde otra zona o Supabase reporte en UTC. El costo de almacenamiento es idéntico.

### Disparador de auditoría

Los campos de autoría **no** se confían al cliente. Un líder podría enviar `creado_por` con el UUID de otra persona. El disparador los sobrescribe siempre:

```sql
CREATE OR REPLACE FUNCTION fn_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fecha_creacion := now();
    NEW.creado_por := auth.uid();
    NEW.fecha_actualizacion := NULL;
    NEW.actualizado_por := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.fecha_creacion := OLD.fecha_creacion;
    NEW.creado_por := OLD.creado_por;
    NEW.fecha_actualizacion := now();
    NEW.actualizado_por := auth.uid();

    -- Marcar eliminacion: solo la primera vez, y siempre con autor
    IF NEW.fecha_eliminacion IS NOT NULL AND OLD.fecha_eliminacion IS NULL THEN
      NEW.fecha_eliminacion := now();
      NEW.eliminado_por := auth.uid();
    ELSIF NEW.fecha_eliminacion IS NULL AND OLD.fecha_eliminacion IS NOT NULL THEN
      -- Restaurar: permitido, limpia el autor
      NEW.eliminado_por := NULL;
    ELSE
      NEW.fecha_eliminacion := OLD.fecha_eliminacion;
      NEW.eliminado_por := OLD.eliminado_por;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
```

Se aplica a cada tabla con:

```sql
CREATE TRIGGER trg_auditoria_<tabla>
  BEFORE INSERT OR UPDATE ON <tabla>
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
```

`auth.uid()` devuelve `NULL` cuando la operación corre sin sesión, por ejemplo desde un `service_role` en una migración o un job. Eso satisface el Requisito 2.6 sin código extra.

### Bloqueo de DELETE físico

El Requisito 3.2 exige rechazar el borrado físico. No basta con "no llamar a DELETE": PostgREST expone `DELETE` por defecto. Se bloquea en dos capas.

Capa 1, permisos — los roles de Supabase no reciben `DELETE`:

```sql
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE DELETE ON TABLES FROM anon, authenticated;
```

Capa 2, disparador — atrapa cualquier ruta que evada la capa 1:

```sql
CREATE OR REPLACE FUNCTION fn_bloquear_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Borrado fisico prohibido en %. Use borrado logico: UPDATE % SET fecha_eliminacion = now()',
    TG_TABLE_NAME, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_no_delete_<tabla>
  BEFORE DELETE ON <tabla>
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();
```

El `service_role` conserva `DELETE` para poder limpiar datos de prueba y ejecutar migraciones, pero el disparador lo frena igual. Para limpiar de verdad hay que desactivar el disparador explícitamente — que es exactamente la fricción que se busca.

### Vigencia

`fecha_eliminacion IS NULL` es la condición de fila vigente (Requisito 3.5). Cada tabla expone una vista que ya la aplica:

```sql
CREATE VIEW v_persona AS
  SELECT * FROM persona WHERE fecha_eliminacion IS NULL;
```

Los clientes leen de `v_<tabla>`. Quien necesite el historial completo consulta la tabla base. Esto evita que un `WHERE fecha_eliminacion IS NULL` olvidado en un dashboard muestre gente borrada.

## Convenciones

### Nombres

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Tabla | singular, snake_case, sin tildes | `casa_de_paz` |
| Clave primaria | siempre `id` | `id` |
| Clave foránea | `<tabla>_id` | `casa_de_paz_id` |
| Tabla de relación | entidades unidas | `casa_de_paz_membresia` |
| Enum | sufijo `_enum` | `estado_civil_enum` |
| Valor de enum | MAYUSCULA_GUION_BAJO | `SECUNDARIA_COMPLETA` |
| Vista de vigentes | prefijo `v_` | `v_persona` |
| Función | prefijo `fn_` | `fn_auditoria` |
| Disparador | prefijo `trg_` | `trg_auditoria_persona` |
| Restricción CHECK | prefijo `chk_` | `chk_asignacion_una_sola_entidad` |
| Índice único | prefijo `uq_` | `uq_persona_ci` |
| Política RLS | prefijo `pol_` | `pol_persona_select_iglesia` |

Los identificadores van sin tildes (`direccion`, no `dirección`). PostgreSQL admite tildes pero obligan a comillas dobles en cada referencia. Todo texto que lee una persona — mensajes de error, nombres de catálogo, etiquetas — sí lleva tildes.

### Enum o catálogo

La regla es quién puede cambiar los valores:

| Caso | Modelo | Por qué |
|------|--------|---------|
| Sexo (M, F) | enum | No cambia nunca. |
| Estado civil | enum | Fijo por ley boliviana. |
| Grado de instrucción | enum | Fijo por el sistema educativo. |
| Escala de evangelismo | enum | Fijo por la estructura de la visión. |
| Tipo de ingreso | catálogo | El Supervisor puede agregar tipos. |
| Ministerio | catálogo | Se crean por mandato pastoral. |
| Cargo | catálogo | Se agregan cargos nuevos. |
| Tema de CdP | catálogo | 52 por libro, editables. |
| Tipo de relación familiar | catálogo | Se agregan relaciones. |

Cambiar un enum en PostgreSQL requiere migración. Cambiar un catálogo es un `INSERT`. Si un Supervisor va a querer tocarlo, es catálogo.

Todo catálogo lleva:

```sql
nombre  VARCHAR(100) NOT NULL,
activo  BOOLEAN NOT NULL DEFAULT true,
orden   SMALLINT NOT NULL DEFAULT 0
```

`activo = false` retira un valor de los formularios nuevos sin romper las filas históricas que lo referencian. Eso, más el Requisito 5.3, es la razón por la que los catálogos no se borran: si el tipo de ingreso "primicia" tiene 400 registros de 2026, borrarlo dejaría 400 filas huérfanas.

### Modelo híbrido

Direcciones y teléfonos pertenecen a personas, iglesias o casas de paz. Tres opciones y por qué se elige la tercera:

| Opción | Problema |
|--------|----------|
| Una columna `entidad_id` + `entidad_tipo` | No hay clave foránea posible. La base no puede garantizar que el UUID exista. |
| Una tabla por entidad (`persona_direccion`, `iglesia_direccion`…) | Triplica el esquema y las consultas. |
| **Tres FK nulables + CHECK** | Integridad referencial real, una sola tabla. |

```sql
CREATE TABLE direccion_asignacion (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direccion_id     UUID NOT NULL REFERENCES direccion(id),
  persona_id       UUID REFERENCES persona(id),
  iglesia_id       UUID REFERENCES iglesia(id),
  casa_de_paz_id   UUID REFERENCES casa_de_paz(id),
  es_principal     BOOLEAN NOT NULL DEFAULT false,
  activo           BOOLEAN NOT NULL DEFAULT true,
  -- auditoria...

  CONSTRAINT chk_asignacion_una_sola_entidad CHECK (
    (persona_id IS NOT NULL)::int +
    (iglesia_id IS NOT NULL)::int +
    (casa_de_paz_id IS NOT NULL)::int = 1
  )
);
```

El `CHECK` con suma de booleanos convertidos a entero es la forma más corta de exigir "exactamente uno". Nombrarlo `chk_asignacion_una_sola_entidad` cumple el Requisito 9.3: cuando falle, el error dice qué regla se violó.

Una sola principal por entidad, entre las vigentes:

```sql
CREATE UNIQUE INDEX uq_direccion_principal_persona
  ON direccion_asignacion (persona_id)
  WHERE es_principal AND activo AND fecha_eliminacion IS NULL AND persona_id IS NOT NULL;
```

El índice único parcial resuelve el Requisito 6.4 sin disparador. PostgreSQL lo verifica en cada escritura, y no hay carrera posible entre dos transacciones concurrentes.

### Historial

Toda relación que cambia en el tiempo — quién lidera una CdP, a qué red pertenece, qué cargo tiene una persona — se modela con `fecha_inicio` y `fecha_fin`:

```sql
fecha_inicio  DATE NOT NULL,
fecha_fin     DATE,
CONSTRAINT chk_<tabla>_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
```

`fecha_fin IS NULL` = vigente. Cuando el dominio admite un solo vigente (una CdP tiene un líder), se usa índice único parcial:

```sql
CREATE UNIQUE INDEX uq_cdp_lider_vigente
  ON casa_de_paz_lider (casa_de_paz_id)
  WHERE fecha_fin IS NULL AND fecha_eliminacion IS NULL;
```

Esto satisface el Requisito 7.4. Un `UPDATE` que intente dejar dos líderes vigentes falla en la base, no en el frontend.

`DATE` y no `TIMESTAMPTZ` para el historial organizacional: nadie sabe a qué hora exacta alguien pasó a ser líder, y fingir precisión que no existe genera bugs de zona horaria en las comparaciones. La auditoría (`fecha_creacion`) sí es `TIMESTAMPTZ` porque ahí el instante sí se conoce.

### Errores

```sql
RAISE EXCEPTION 'CRITERIO_VISITAS_INVALIDO: el valor % debe ser mayor o igual a 1', p_valor
  USING ERRCODE = 'P0001';
```

Formato: `NOMBRE_DE_LA_REGLA: explicación en español con el valor que falló`. El frontend parte por `:` y usa el prefijo para decidir el mensaje; el texto sirve para el log y para depurar. Cumple los Requisitos 9.1 y 9.2.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| UUID v4 | BIGSERIAL | Un ID secuencial revela cuántas personas hay y permite enumerar la base. Además UUID deja generar el ID en el cliente antes de guardar. |
| `gen_random_uuid()` | extensión `uuid-ossp` | Nativo en PostgreSQL 13+. Supabase ya lo trae. Una dependencia menos. |
| Auditoría por disparador | Auditoría desde el cliente | El cliente miente. El Requisito 2.4 exige ignorarlo. |
| Vistas `v_<tabla>` | `WHERE` en cada consulta | Un `WHERE` olvidado muestra datos borrados. La vista no se olvida. |
| Reglas en la BD | Reglas en el frontend | La app móvil las tendría que duplicar. Ver Requisito 8. |
| `TIMESTAMPTZ` | `TIMESTAMP` | Mismo costo, sin ambigüedad de zona. |
| `DATE` en historial | `TIMESTAMPTZ` en historial | Nadie conoce la hora exacta de una designación. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El disparador de auditoría corre en cada escritura y agrega latencia. | Es una asignación de campos en memoria, sin E/S. A la escala de este sistema (decenas de escrituras por semana por CdP) es irrelevante. |
| `REVOKE DELETE` puede romper migraciones futuras. | El `service_role` conserva el permiso; solo el disparador lo frena, y se puede desactivar dentro de una migración explícita. |
| Nadie purga nunca las filas borradas y la base crece. | A esta escala no es un problema por años. Cuando lo sea, se define una política de retención; el dato está ahí para decidirla. |
