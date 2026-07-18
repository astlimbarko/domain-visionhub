# Diseño — Tenancy e Iglesias

## Resumen

Cada iglesia es un tenant. El aislamiento se hace con Row-Level Security sobre `iglesia_id`, y las Iglesias_Accesibles del usuario se calculan en el servidor a partir de `auth.uid()`. El cliente nunca envía a qué iglesia pertenece: la base lo deduce.

La autenticación es Supabase Auth por email, sin excepciones. No hay tabla `usuario` propia, ni hashes, ni tokens, ni contadores de intentos fallidos en `public`.

## Persona y Usuario son cosas distintas

Esta es la decisión que ordena el resto del área.

Una **Persona** es un ser humano de la iglesia. Habrá miles. Un **Usuario** es alguien que inicia sesión. Habrá decenas: el pastor, el supervisor, los líderes de red y los líderes y sublíderes de CdP. El 95% de las Personas nunca tendrá Usuario.

```
auth.users  (Supabase, gestionado)
    ^
    | usuario_id (UNIQUE, NULL permitido)
    |
 persona  (miles de filas, la mayoria con usuario_id = NULL)
```

Modelarlo al revés — obligar a que toda persona tenga cuenta — implicaría inventar correos falsos para bebés y para gente que no tiene celular. Por eso `usuario_id` es nulable.

`persona.correo` y `auth.users.email` son campos distintos y pueden diferir (Requisito 2.8). El primero es dato de contacto que el líder anota; el segundo es la credencial. Una persona puede tener correo de contacto y no tener cuenta, o tener cuenta con un correo distinto del que usa a diario.

### Consecuencia operativa

Todo líder y sublíder de CdP necesita un correo para entrar. Quien no tenga:

1. El Supervisor crea el Usuario desde su panel con un correo que la persona sí controle.
2. Supabase envía la invitación y la persona fija su contraseña.
3. Si no tiene correo propio, se usa uno de la iglesia con alias (`lider.vidanueva@iglesia...`) y el Supervisor lo administra.

No hay atajo: sin correo no hay sesión, porque Supabase Auth no autentica por username. Fue la decisión tomada al descartar el login propio.

## Esquema

### moneda

```sql
CREATE TABLE moneda (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      CHAR(3) NOT NULL UNIQUE,      -- ISO 4217: BOB, USD, BRL, ARS, PYG...
  nombre      VARCHAR(50) NOT NULL,
  simbolo     VARCHAR(5) NOT NULL,
  decimales   SMALLINT NOT NULL DEFAULT 2,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0
  -- auditoria
);
```

Reemplaza al `moneda_enum` original (Decisión del owner, 2026-07-17: agregar Real, Guaraní o Peso argentino no debe exigir migración). Semilla: `BOB` (Boliviano, "Bs", 2 decimales), `USD` (Dólar estadounidense, "$", 2), `BRL` (Real brasileño, "R$", 2), `ARS` (Peso argentino, "$", 2), `PYG` (Guaraní paraguayo, "₲", **0** decimales — el guaraní no usa centavos).

`iglesia_moneda` decide, por iglesia, cuáles de esas monedas están habilitadas para registrar ingresos (Requisito nuevo: BOB y USD activas por defecto; las demás quedan en el catálogo hasta que el Supervisor las active):

```sql
CREATE TABLE iglesia_moneda (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id     UUID NOT NULL REFERENCES iglesia(id),
  moneda_id      UUID NOT NULL REFERENCES moneda(id),
  activa         BOOLEAN NOT NULL DEFAULT true
  -- auditoria
);

CREATE UNIQUE INDEX uq_iglesia_moneda
  ON iglesia_moneda (iglesia_id, moneda_id) WHERE fecha_eliminacion IS NULL;
```

Semilla de despliegue: cada iglesia (Santa Cruz, Montero) recibe una fila `BOB` con `activa = true` y una fila `USD` con `activa = true`. Las demás monedas (BRL, ARS, PYG) no tienen fila hasta que el Supervisor las active desde su panel — sin fila se interpreta como inactiva, igual que "sin `configuracion_valor`" cae al valor por defecto en el motor de configuración.

### cobertura

```sql
CREATE TABLE cobertura (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               VARCHAR(200) NOT NULL,
  sede                 VARCHAR(100),
  cobertura_padre_id   UUID REFERENCES cobertura(id),
  activo               BOOLEAN NOT NULL DEFAULT true,
  -- auditoria (6 campos, ver 00-fundacion)
  CONSTRAINT chk_cobertura_no_autopadre CHECK (cobertura_padre_id IS DISTINCT FROM id)
);
```

`cobertura_padre_id` existe porque la Red del Ap. Edgar Ortuño está bajo Iglesia Rey Jesús (Ap. Guillermo Maldonado), según `domain_knowledge/cargos/cargos.md`. No se usa en el Módulo 1, pero la columna evita una migración cuando se registre.

### iglesia

```sql
CREATE TABLE iglesia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefijo           VARCHAR(100) NOT NULL DEFAULT 'Centro de Vida',
  sufijo            VARCHAR(100) NOT NULL,
  nombre            VARCHAR(200) GENERATED ALWAYS AS (prefijo || ' ' || sufijo) STORED,
  ciudad            VARCHAR(100) NOT NULL,
  correo            VARCHAR(150),
  iglesia_padre_id  UUID REFERENCES iglesia(id),
  cobertura_id      UUID NOT NULL REFERENCES cobertura(id),
  pastor_id         UUID REFERENCES persona(id),
  supervisor_id     UUID REFERENCES persona(id),
  moneda_defecto_id UUID NOT NULL REFERENCES moneda(id),
  activo            BOOLEAN NOT NULL DEFAULT true,
  -- auditoria
  CONSTRAINT chk_iglesia_no_autopadre CHECK (iglesia_padre_id IS DISTINCT FROM id)
);
```

`prefijo` + `sufijo` en vez de un solo campo `nombre` (decisión del owner, 2026-07-17): el Pastor edita ambos al crear su iglesia. `nombre` es una columna generada (`GENERATED ALWAYS AS ... STORED`), no un disparador — se recalcula sola y no se puede escribir directo. Ejemplo de despliegue: prefijo `'Centro de Vida'` + sufijo `'4 Anillo'` → Santa Cruz (iglesia madre); mismo prefijo + sufijo `'Montero'` → Montero (iglesia hija).

`pastor_id` y `supervisor_id` viven en `iglesia`, no en `persona`. Un pastor con tres iglesias son tres filas de `iglesia` con el mismo `pastor_id`. Eso hace que "las iglesias de este pastor" sea un `WHERE pastor_id = ...`, sin tabla intermedia.

`moneda_defecto_id` reemplaza al `moneda_enum` original — ver la tabla `moneda` arriba. `BOB` sigue siendo el valor de arranque para las dos iglesias del despliegue.

Ambos son nulables por el orden de creación: la primera iglesia se inserta antes que su pastor, porque el pastor es una `persona` que necesita un `iglesia_id`. Se resuelve en dos pasos dentro de una transacción — insertar iglesia, insertar persona, actualizar `pastor_id`.

`chk_iglesia_no_autopadre` cubre el Requisito 1.4. Los ciclos más largos (A→B→A) los cubre un disparador, más abajo.

#### Cochabamba

Santa Cruz y Montero nacen con `iglesia_padre_id = NULL` (Requisito 7.2, 7.3). Cuando Cochabamba entre:

```sql
INSERT INTO iglesia (prefijo, sufijo, ciudad, cobertura_id, moneda_defecto_id)
VALUES ('Centro de Vida', 'Cochabamba', 'Cochabamba', :cob, :bob);
UPDATE iglesia SET iglesia_padre_id = :cbba WHERE ciudad IN ('Santa Cruz', 'Montero');
```

Dos sentencias. Sin migración, sin cambio de políticas. Eso es lo que exige el Requisito 7.7.

#### Ciclos

```sql
CREATE OR REPLACE FUNCTION fn_iglesia_sin_ciclo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_actual UUID := NEW.iglesia_padre_id;
  v_saltos INT := 0;
BEGIN
  WHILE v_actual IS NOT NULL LOOP
    IF v_actual = NEW.id THEN
      RAISE EXCEPTION 'IGLESIA_CICLO: la iglesia % no puede ser descendiente de si misma', NEW.id
        USING ERRCODE = 'P0001';
    END IF;
    v_saltos := v_saltos + 1;
    IF v_saltos > 50 THEN
      RAISE EXCEPTION 'IGLESIA_CICLO: jerarquia demasiado profunda o ciclo detectado'
        USING ERRCODE = 'P0001';
    END IF;
    SELECT iglesia_padre_id INTO v_actual FROM iglesia WHERE id = v_actual;
  END LOOP;
  RETURN NEW;
END;
$$;
```

Cumple el Requisito 1.5. El tope de 50 saltos evita un bucle infinito si un ciclo ya existiera por otra vía.

### usuario_rol

```sql
CREATE TYPE rol_sistema_enum AS ENUM (
  'SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION',
  'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP'
);

CREATE TABLE usuario_rol (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id),
  iglesia_id   UUID REFERENCES iglesia(id),
  rol          rol_sistema_enum NOT NULL,
  -- auditoria (creado_por responde "quien lo asigno", Req 6.8)
  CONSTRAINT chk_rol_iglesia CHECK (
    (rol = 'SUPER_ADMIN' AND iglesia_id IS NULL) OR
    (rol <> 'SUPER_ADMIN' AND iglesia_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_usuario_rol_vigente
  ON usuario_rol (usuario_id, COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE fecha_eliminacion IS NULL;
```

**Roles de dominio, no genéricos** (decisión del owner, 2026-07-17, reemplaza al enum original `SUPER_ADMIN/ADMIN/USUARIO/INVITADO`). La razón: con `ADMIN` genérico la base no puede distinguir "esto solo lo hace el Pastor" de "esto lo hace también el Supervisor" — y esa distinción es una regla real del dominio (el Supervisor no crea iglesias ni asigna cargos ministeriales; el Pastor sí). Los seis valores:

| Rol | Alcance | Quién lo tiene |
|-----|---------|----------------|
| `SUPER_ADMIN` | Global (`iglesia_id NULL`) | El admin técnico. Arranque del sistema y soporte a pedido. |
| `PASTOR` | Por iglesia | El pastor de esa iglesia. Hace todo lo operativo. |
| `SUPERVISOR_VISION_ACCION` | Por iglesia | Cargo técnico; por defecto el Pastor ya hace lo mismo. Cuando existe, hace casi todo lo operativo salvo las excepciones de abajo. |
| `LIDER_RED` | Por iglesia | Líder de una red. |
| `LIDER_CDP` | Por iglesia | Líder de una casa de paz. |
| `SUBLIDER_CDP` | Por iglesia | Sublíder de una casa de paz. |

No hay rol `INVITADO`: con roles de dominio, "acceso de solo lectura" no es un rol operativo más — se resuelve dándole a esa persona el rol que le corresponda (ej. `LIDER_CDP` de otra iglesia en visita) sin necesidad de un cuarto valor genérico. Las referencias a `fn_es_invitado_en` de otras áreas se retiran (ver más abajo).

El rol es **por iglesia** (Requisito 3.1). Un Pastor con dos iglesias tiene dos filas: `PASTOR` en cada una. `SUPER_ADMIN` es la excepción — es global, y el `CHECK` obliga a que su `iglesia_id` sea `NULL`.

El Requisito 6.8 ("registrar quién asignó el rol") no necesita columna nueva: `creado_por` de la auditoría ya lo responde.

## Row-Level Security

### El problema de la recursión

La forma obvia de escribir la política es este `EXISTS`:

```sql
-- NO USAR
CREATE POLICY pol_persona_select ON persona FOR SELECT USING (
  iglesia_id IN (SELECT iglesia_id FROM usuario_rol WHERE usuario_id = auth.uid())
);
```

Falla apenas `usuario_rol` tenga su propia política que consulte `persona`: PostgreSQL evalúa la política de `persona`, que lee `usuario_rol`, que evalúa su política, que lee `persona`, y aborta con `infinite recursion detected in policy`. Es el error más común al montar multi-tenancy en Supabase.

La solución es una función `SECURITY DEFINER`. Corre con los privilegios de su dueño y **no dispara RLS** en las tablas que lee, así que corta la recursión de raíz.

### Funciones de acceso

```sql
CREATE OR REPLACE FUNCTION fn_es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid()
      AND rol = 'SUPER_ADMIN'
      AND fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_mi_persona_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM persona
  WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_mis_iglesias()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- SUPER_ADMIN: todas
  SELECT i.id FROM iglesia i
  WHERE fn_es_super_admin()

  UNION

  -- Pastor: todas las iglesias donde figura como pastor
  SELECT i.id FROM iglesia i
  WHERE i.pastor_id = fn_mi_persona_id()
    AND i.fecha_eliminacion IS NULL

  UNION

  -- Supervisor: todas las iglesias donde figura como supervisor
  SELECT i.id FROM iglesia i
  WHERE i.supervisor_id = fn_mi_persona_id()
    AND i.fecha_eliminacion IS NULL

  UNION

  -- Cualquier otro: la iglesia de su persona
  SELECT p.iglesia_id FROM persona p
  WHERE p.usuario_id = auth.uid()
    AND p.fecha_eliminacion IS NULL

  UNION

  -- Roles asignados explicitamente (INVITADO en otra iglesia, etc.)
  SELECT ur.iglesia_id FROM usuario_rol ur
  WHERE ur.usuario_id = auth.uid()
    AND ur.iglesia_id IS NOT NULL
    AND ur.fecha_eliminacion IS NULL;
$$;
```

Las cinco ramas del `UNION` son exactamente los cinco casos del Requisito 5. El `UNION` (no `UNION ALL`) deduplica: el pastor que además tiene una fila en `usuario_rol` para la misma iglesia la recibe una sola vez.

`STABLE` permite a PostgreSQL cachear el resultado dentro de la consulta en lugar de reevaluarlo por fila. `SET search_path = public` evita que alguien secuestre la función creando objetos en un esquema anterior en el path — obligatorio en toda función `SECURITY DEFINER`.

```sql
CREATE OR REPLACE FUNCTION fn_es_pastor_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_super_admin() OR EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid()
      AND iglesia_id = p_iglesia_id
      AND rol = 'PASTOR'
      AND fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_es_operativo_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_pastor_en(p_iglesia_id) OR EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid()
      AND iglesia_id = p_iglesia_id
      AND rol = 'SUPERVISOR_VISION_ACCION'
      AND fecha_eliminacion IS NULL
  );
$$;
```

`fn_es_operativo_en` es el reemplazo general de lo que antes era `fn_es_admin_en`: cubre "Pastor o Supervisor de esta iglesia", que es la regla por defecto en el resto del harness (crear redes, editar configuración, editar catálogos, actualizar la iglesia). `fn_es_pastor_en` a secas se usa solo en las tres excepciones donde el Supervisor queda afuera a propósito (decisión del owner, 2026-07-17):

1. Crear iglesias (política `INSERT` de `iglesia`, abajo).
2. Asignar el rol `SUPERVISOR_VISION_ACCION` (en `fn_validar_asignacion_rol`, abajo).
3. Asignar cargos ministeriales Tipo A — `PASTOR`, `PROFETA`, `EVANGELISTA`, `MAESTRO`, `APOSTOL` — en el disparador de `persona_cargo` (ver [03-estructura](../03-estructura/design.md)).

No hay `fn_es_invitado_en`: al quitar el rol `INVITADO` del enum, las políticas `INSERT`/`UPDATE` que antes tenían `AND NOT fn_es_invitado_en(iglesia_id)` simplemente pierden esa cláusula en toda el área — cualquier rol de dominio asignado puede escribir dentro de lo que sus otras reglas le permitan; no existe ya un rol de "solo lectura" transversal.

### Patrón de política

Toda tabla con `iglesia_id` recibe estas cuatro políticas:

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_<tabla>_select ON <tabla>
  FOR SELECT TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fecha_eliminacion IS NULL
  );

CREATE POLICY pol_<tabla>_insert ON <tabla>
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
  );

CREATE POLICY pol_<tabla>_update ON <tabla>
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
  )
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
  );

-- Sin politica de DELETE: el permiso esta revocado (ver 00-fundacion)
```

`IN (SELECT fn_mis_iglesias())` y no `= ANY(fn_mis_iglesias())`: envolver la llamada en un subselect hace que PostgreSQL la evalúe **una vez** como InitPlan, en lugar de una vez por fila. En una tabla de 5.000 personas la diferencia es de dos órdenes de magnitud. Es el detalle que más se olvida al escribir RLS en Supabase.

La ausencia de política de `DELETE` es intencional y refuerza el Requisito 3.2 de Fundación: sin política y sin `GRANT`, `DELETE` es imposible por dos motivos independientes.

Este patrón genérico ya no exige "no ser invitado": al quitar ese rol del enum (ver arriba), la restricción de escritura pasa a las reglas específicas de cada tabla (¿es líder de esta CdP? ¿es operativo de esta iglesia?), no a un rol transversal de solo lectura.

### Política de iglesia

`iglesia` no tiene `iglesia_id`; se filtra por su propio `id`:

```sql
CREATE POLICY pol_iglesia_select ON iglesia
  FOR SELECT TO authenticated
  USING (id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_iglesia_update ON iglesia
  FOR UPDATE TO authenticated
  USING (fn_es_operativo_en(id))
  WITH CHECK (fn_es_operativo_en(id));

CREATE POLICY pol_iglesia_insert ON iglesia
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_es_super_admin()
    OR (iglesia_padre_id IS NOT NULL AND fn_es_pastor_en(iglesia_padre_id))
  );
```

Decisión del owner (2026-07-17): tanto el Pastor como el admin técnico pueden crear iglesias, pero el admin técnico actúa solo a pedido/configuración — lo operativo lo hace el Pastor. En la práctica: la **iglesia raíz** (`iglesia_padre_id IS NULL`, ej. la futura Cochabamba si no cuelga de otra) solo la crea el `SUPER_ADMIN`, porque no hay todavía un Pastor con acceso a esa cadena. Una **iglesia hija** la puede crear directamente el Pastor de la iglesia madre — así arma su red de iglesias sin depender del soporte técnico para cada alta. Modificar la iglesia (nombre, moneda por defecto, etc.) lo puede hacer cualquiera de los dos roles operativos, vía `fn_es_operativo_en`.

### Selector de iglesia

El Requisito 5.8 pide una función para pintar el selector del pastor:

```sql
CREATE OR REPLACE FUNCTION fn_mis_iglesias_detalle()
RETURNS TABLE (id UUID, nombre VARCHAR, ciudad VARCHAR, es_operativo BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id)
  FROM iglesia i
  WHERE i.id IN (SELECT fn_mis_iglesias())
    AND i.activo
    AND i.fecha_eliminacion IS NULL
  ORDER BY i.nombre;
$$;
```

Se consume por RPC: `POST /rest/v1/rpc/fn_mis_iglesias_detalle`.

## Alta en cadena

```
Admin_Tecnico (SUPER_ADMIN)
   |
   +--> crea la Iglesia raiz (sin padre)
   +--> crea Persona del Pastor + su Usuario + rol PASTOR
             |
             +--> Pastor crea Iglesias hijas (el mismo puede repetir el paso anterior)
             +--> Pastor designa Supervisor de la Vision en Accion (rol SUPERVISOR_VISION_ACCION)
                       |
                       +--> Pastor o Supervisor crean Redes y Departamentos
                       +--> Solo el Pastor asigna cargos ministeriales (Pastor/Profeta/Evangelista/Maestro/Apostol)
                                 |
                                 +--> Supervisor o Lider de Red crean CdP
                                           +--> designan Lider (rol LIDER_CDP) y Sublider (rol SUBLIDER_CDP)
```

### Reglas que la base hace cumplir

```sql
CREATE OR REPLACE FUNCTION fn_validar_asignacion_rol()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Req 6.5: nadie se auto-asigna
  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  -- Req 6.1: solo el admin tecnico crea SUPER_ADMIN
  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
      USING ERRCODE = 'P0001';
  END IF;

  -- Alta de un Pastor nuevo: solo el admin tecnico
  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  -- Decision del owner: el Supervisor lo designa unicamente el Pastor de esa iglesia
  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT fn_es_pastor_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Roles operativos (Pastor o Supervisor pueden asignarlos)
  IF NEW.rol IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP') AND NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  -- Req 6.7: solo dentro de las iglesias accesibles
  IF NEW.iglesia_id IS NOT NULL
     AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_rol
  BEFORE INSERT OR UPDATE ON usuario_rol
  FOR EACH ROW EXECUTE FUNCTION fn_validar_asignacion_rol();
```

La regla "nadie se auto-asigna" es la única que no se puede expresar con RLS: RLS filtra filas, no compara el sujeto con el objeto. Va en disparador.

### El primer usuario

Hay un problema de arranque: `fn_validar_asignacion_rol` exige un `SUPER_ADMIN` existente para crear el primero. Se rompe una sola vez, desde el SQL Editor de Supabase con `service_role`, que ignora RLS:

```sql
-- Ejecutar UNA VEZ, manualmente, tras crear el usuario del admin tecnico en Auth
ALTER TABLE usuario_rol DISABLE TRIGGER trg_validar_rol;
INSERT INTO usuario_rol (usuario_id, iglesia_id, rol)
VALUES ('<uuid-del-admin-tecnico>', NULL, 'SUPER_ADMIN');
ALTER TABLE usuario_rol ENABLE TRIGGER trg_validar_rol;
```

Es deliberado que sea incómodo y manual. A partir de ahí la cadena se sostiene sola.

### Creación de usuarios

Crear un Usuario requiere la Admin API de Supabase, que necesita `SERVICE_ROLE_KEY` y **no puede exponerse al navegador**. Va en una Edge Function:

```
POST /functions/v1/crear-usuario
Body: { persona_id, email, rol, iglesia_id }
```

La función:
1. Verifica el JWT de quien llama.
2. Comprueba `fn_es_operativo_en(iglesia_id)`. Si no, 403.
3. Comprueba que `persona_id` pertenece a esa iglesia.
4. Llama a `auth.admin.inviteUserByEmail(email)`.
5. Actualiza `persona.usuario_id` con el UUID devuelto.
6. Inserta la fila en `usuario_rol`.

Todo dentro de una transacción; si el paso 6 falla, se revierte el 5 y se borra el usuario de Auth.

El Requisito 2.9 (cambio de contraseña en el primer ingreso) sale gratis: `inviteUserByEmail` manda un enlace y la persona fija su contraseña al entrar. No hace falta el campo `requiere_cambio_password` que pedía `software/modulos.md` — era necesario solo con auth propia.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Supabase Auth por email | Tabla `usuario` con username + email | Decisión del owner. Supabase no autentica por username; emularlo obliga a resolver username→email antes del login y a mantener sincronía entre dos fuentes de identidad. |
| `pastor_id` / `supervisor_id` en `iglesia` | Tabla `persona_iglesia_rol` | El dominio dice "un pastor, varias iglesias". Una FK en `iglesia` lo expresa directo. Una tabla intermedia agrega un JOIN a cada consulta sin ganar nada. |
| Funciones `SECURITY DEFINER` | `EXISTS` inline en la política | La recursión infinita de RLS no es evitable de otra forma cuando dos tablas se referencian. |
| `IN (SELECT fn_mis_iglesias())` | `= ANY(fn_mis_iglesias())` | El subselect se evalúa una vez por consulta; la otra forma, una vez por fila. |
| Rol por iglesia | Rol global | El Requisito 3.2 lo exige: el pastor puede ser PASTOR en una e invitado en otra. |
| Edge Function para crear usuarios | Crear usuarios desde el navegador | `SERVICE_ROLE_KEY` en el cliente expone la base entera. |
| `usuario_id` nulable en `persona` | Todo persona = un usuario | Miles de personas no tienen correo. |
| **Roles de dominio** (`PASTOR`, `SUPERVISOR_VISION_ACCION`, `LIDER_RED`, `LIDER_CDP`, `SUBLIDER_CDP`) | Enum genérico (`ADMIN`/`USUARIO`/`INVITADO`) | Decisión del owner, 2026-07-17. Con roles genéricos la base no puede exigir "esto solo lo hace el Pastor, no el Supervisor" — una regla real del dominio (crear iglesias, asignar cargos ministeriales). |
| **Pastor crea iglesias hijas** | Solo el admin técnico crea iglesias | Decisión del owner: lo operativo lo hace el Pastor; el admin técnico solo actúa a pedido/configuración (y sigue siendo el único que crea la iglesia raíz, por el orden de arranque). |
| Sin rol `INVITADO` | Mantenerlo como cuarto valor del enum | Con roles de dominio, "acceso limitado" se resuelve asignando el rol operativo que corresponda, no con un rol transversal de solo lectura. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Una tabla nueva se crea sin RLS y queda abierta a toda iglesia. | El Requisito 4.7 lo prohíbe. Se verifica con la consulta de la tarea 7.1, que lista tablas de `public` sin `rowsecurity`. Debe devolver cero filas. |
| `fn_mis_iglesias()` se evalúa por fila y degrada los dashboards. | Envolver siempre en `IN (SELECT ...)`. Verificar con `EXPLAIN ANALYZE` que aparece como InitPlan y no como SubPlan por fila. |
| El supervisor compartido entre dos iglesias ve datos mezclados en un dashboard. | RLS le da acceso a ambas; la separación visual es responsabilidad del selector de iglesia. Los dashboards **siempre** filtran por la iglesia activa, nunca asumen una sola. Ver [09-dashboards](../09-dashboards/). |
| Se borra la persona del pastor y `iglesia.pastor_id` queda apuntando a una fila eliminada. | `fn_mis_iglesias()` filtra por `fecha_eliminacion IS NULL` en `persona`. El pastor perdería acceso, que es el comportamiento correcto, pero deja la iglesia sin pastor: agregar alerta en el dashboard del Supervisor. |
| El `SERVICE_ROLE_KEY` se filtra y expone toda la base. | Nunca en el repositorio ni en el cliente. Solo en variables de entorno de Edge Functions. Rotar si se sospecha filtración. |
