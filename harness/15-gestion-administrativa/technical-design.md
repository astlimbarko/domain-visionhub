# 15 — Gestión administrativa — technical-design.md

> Cómo se construye. Anclado al código real leído en `origin/master` (incluye el
> PR #7 de Matías). Cada decisión referencia el archivo concreto que la sostiene.

## 1. Principios

1. **No reinventar.** Reutilizar guards, permisos, sistema de diseño y el patrón
   de invitación dual ya existentes (§7). Antes de crear un componente, revisar
   `database-impact.md` y el catálogo de piezas de `frontend-style/SKILL.md`.
2. **Aditivo, no destructivo.** Toda migración de esquema (satélite, color de
   departamento, enum nuevo, OTP) se agrega sin romper RLS/dashboards actuales.
3. **El backend manda.** Cada botón de la UI debe corresponder a un permiso ya
   verificado en una función `SECURITY DEFINER`/trigger; nunca mostrar una acción
   que el backend vaya a rechazar.
4. **Migraciones numeradas** siguiendo la convención `harness/11-esquema-bd/sql/NN_*.sql`
   (próximos números libres: 55 en adelante — ver `database-impact.md`).

## 2. Mapa de permisos (estado actual, base para todo)

Fuente de verdad frontend: `frontend/src/utils/permisos.ts`.

- `RolUI = 'SUPER_ADMIN' | 'PASTOR' | 'SUPERVISOR' | 'LIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP' | 'SIN_ROL'`.
- `RUTAS_POR_ROL` define qué rutas ve cada rol; `CATALOGO_NAV` el nav; `obtenerNavItems(rol)` lo resuelve.
- `determinarRolUI()` (prioridad) y `calcularOpcionesRolUI()` (multi-sombrero).
- Guards: `RequiereRol` (por rol) y `RequiereCapacidad` (booleano ortogonal).

Backend (`harness/11-esquema-bd/sql/`):
- `fn_es_pastor_en` (40_) — PASTOR en la iglesia, sin bypass de Super-Admin.
- `fn_es_operativo_en` (43_) — **solo** SUPERVISOR_VISION_ACCION (Pastor ya no).
- `fn_validar_asignacion_rol` (40_) — trigger que gobierna quién asigna cada rol.
- `fn_crear_iglesia` (30_) — hoy Super-Admin + PIN.
- PIN: `usuario_pin` + `fn_establecer_pin`/`fn_verificar_pin`/`fn_exigir_pin` (30_).

## 3. Super-Admin — completar "Gestionar"

Página existente `pages/Administracion.tsx` (solo crear+listar). Se **extiende**,
no se rediseña.

**Frontend**
- Iglesias: agregar a cada fila un menú de acciones (`DropdownMenu` de `ui/*`)
  con Editar / Suspender-Reactivar / Eliminar. Nuevo `EditarIglesiaDialog`
  (calcado de `CrearIglesiaDialog`, mismo estilo).
- Usuarios: agregar acciones Editar cargo·iglesia / Suspender-Reactivar /
  Remover sobre cada `UsuarioListado`. Nuevo `GestionarUsuarioDialog`.
- Alta con doble vía: extender `InvitarUsuarioDialog` para incluir la Opción 1
  (buscar persona existente) reutilizando `BuscadorPersona` (§7).

**Backend (nuevas RPC, patrón `fn_*` + `p_pin`→OTP)**
- `fn_actualizar_iglesia(p_iglesia_id, p_sufijo, p_ciudad, p_correo, p_moneda_id, p_pin)`
- `fn_toggle_iglesia_activa(p_iglesia_id, p_activa, p_pin)`
- `fn_eliminar_iglesia(p_iglesia_id, p_pin)` — soft delete, con validación de que
  no queden dependencias activas colgando (redes/CdP), mismo criterio que
  `fn_validar_red_desactivacion` (08_).
- `fn_actualizar_usuario_rol(...)`, `fn_toggle_usuario_rol(...)`,
  `fn_remover_usuario_rol(...)` — soft delete de `usuario_rol`, respetando
  `fn_validar_asignacion_rol` y la regla de no-autoedición.

Todas exigen OTP (§9) para el Super-Admin, con el mismo `PERFORM fn_exigir_pin(p_pin)`
que ya usan las funciones sensibles actuales.

## 4. Pastor — pantalla de gestión (nueva)

Hoy `RUTAS_PASTOR` = Dashboard + Reportes + 2 Historiales. Se agrega:

- Nueva ruta `ROUTES.GESTION_IGLESIA` (o reutilizar un "Administración" acotado
  al Pastor) + entrada en `CATALOGO_NAV` visible solo para `PASTOR`.
- Pantalla con dos secciones (`TarjetaHeader` + contenido):
  1. **Mi Supervisor** — gestionar al Supervisor V.A. (doble vía §7); el backend
     ya lo permite (rama PASTOR de `fn_validar_asignacion_rol`).
  2. **Iglesias hijas y satélite** — listar las iglesias con
     `iglesia_padre_id = <mi iglesia>`, crear nuevas, convertir hija↔satélite,
     suspender/reactivar, eliminar (soft). Ver §5.

**Backend**
- Ampliar `fn_crear_iglesia` para aceptar también al Pastor de la iglesia madre
  (además del Super-Admin), fijando `iglesia_padre_id` y `tipo`.
- `fn_convertir_tipo_iglesia(p_iglesia_id, p_tipo, p_pin)` — cambia `tipo` con
  auditoría; valida que el llamante sea Pastor de la madre o Super-Admin.
- Guard: `RequiereRol permitidos={['PASTOR']}` en la ruta.

## 5. Iglesia satélite (migración aditiva)

`iglesia` (03_tenancy.sql) hoy: `id, prefijo, sufijo, nombre(gen), ciudad,
correo, iglesia_padre_id, cobertura_id, moneda_defecto_id, activo, auditoría`.

**Migración (nueva, p. ej. `55_iglesia_tipo.sql`)**
```sql
CREATE TYPE iglesia_tipo_enum AS ENUM ('HIJA', 'SATELITE');
ALTER TABLE iglesia
  ADD COLUMN tipo iglesia_tipo_enum NOT NULL DEFAULT 'HIJA';
```
- `DEFAULT 'HIJA'` → todas las filas actuales quedan válidas sin migración de
  datos. Ninguna política RLS ni dashboard consulta `tipo` hoy, así que nada se
  rompe (verificado: RLS de iglesia usa `iglesia_padre_id`/`fn_mis_iglesias`).
- La UI muestra la diferencia (etiqueta/ícono/color); la lógica se mantiene común
  mientras REQ-IS-2 siga vigente.
- `fn_dashboard_super_admin` (41_) y `fn_mis_iglesias_detalle` (43_) pueden
  exponer `tipo` opcionalmente (aditivo, no obligatorio en fase 1).

## 6. Supervisor de Red de la Visión en Acción (rol nuevo)

**Enum** (`01_enums.sql`): agregar `SUPERVISOR_RED_VISION_ACCION` a
`rol_sistema_enum`. Postgres solo permite `ALTER TYPE ... ADD VALUE` (no quitar);
es aditivo y seguro.

**Frontend** (`utils/permisos.ts`, `types/auth.types.ts`, `Administracion.tsx`
`NOMBRE_ROL`): agregar el nuevo `RolUI`/`RolSistema`, sus `RUTAS_POR_ROL`, su
`ROL_UI_META` y su detección en `determinarRolUI`/`calcularOpcionesRolUI`.

**Permisos** (`fn_validar_asignacion_rol`): agregar rama — asignable por
Supervisor de la Visión en Acción (`fn_es_operativo_en`) de la iglesia.

**Alcance funcional (propuesta, ver OQ-SR):** supervisa una o más Redes sin las
capacidades del Supervisor de la Visión en Acción (no gestiona departamentos, no
toca finanzas globales). Se acota en `open-questions.md` antes de implementar.

## 7. Alta con doble vía — reutilización (NO duplicar)

Patrón ya existente para líderes de CdP/Red:
- `components/casas-de-paz/BuscadorPersona.tsx` — busca persona existente
  (`useBuscarPersonas`).
- `components/casas-de-paz/AsignarCargoDialog.tsx` — asigna cargo a la persona
  elegida.
- Edge Function `supabase/functions/invitar-lider/index.ts` +
  `services/invitacion-lider.service.ts` — invita por correo (Opción 2) y
  dispara completar-cuenta.

**Diseño:** extraer un componente compartido `AltaPersonaConDobleVia`
(o componer `BuscadorPersona` + un tab "Invitar por correo") que sirva a:
Super-Admin (invitar Pastor/Supervisor), Pastor (Supervisor), Supervisor
(Supervisor de Red, líder de departamento). La Opción 2 de admin ya existe como
Edge Function `invitar-usuario`; se unifica la UI, no el backend.

## 8. Departamentos (Supervisor)

**Nav:** nuevo ítem "Departamentos" en `CATALOGO_NAV`, ruta
`ROUTES.DEPARTAMENTOS`, incluido en `RUTAS_SUPERVISOR`, guard
`RequiereRol permitidos={['SUPERVISOR']}`. **No** se mezcla con el Panel del
Supervisor ni con la gestión de usuarios.

**Pantalla:** una tarjeta por departamento (los 4, con su color) mostrando el
Líder vigente y acciones de gestión (doble vía §7) sobre `departamento_cargo`
(cargo `LIDER_DEPARTAMENTO`). El backend ya soporta la escritura (RLS
`fn_es_operativo_en`, migración 47_); faltan RPC de conveniencia:
- `fn_designar_lider_departamento(p_departamento_id, p_persona_id, p_pin)`
- `fn_remover_lider_departamento(p_departamento_cargo_id, p_pin)`

**Colores** — migración aditiva (p. ej. `56_departamento_color.sql`):
```sql
ALTER TABLE departamento ADD COLUMN color CHAR(7) NOT NULL DEFAULT '#6B7280'
  CONSTRAINT chk_departamento_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
-- seed por código: EVANGELISMO=#F5C518(amarillo), AFIRMACION=#0071E3(azul),
-- DISCIPULADO=#FF3B30(rojo), ENVIO=#8E8E93(gris). Verbos solo en UI.
```
Mismo patrón que `tipo_evento.color` (13_) y `tipo_evangelismo.color` (44_).

Los **verbos** (Evangelizar/Afirmar/Discipular/Enviar) son un mapeo de
presentación en el frontend (código interno intacto): un `Record<codigo, label>`
junto al `Record<codigo, color>`.

## 9. OTP por correo (reemplazo del PIN estático)

**Estado actual:** `usuario_pin(usuario_id, pin_hash)` + `fn_verificar_pin` (crypt
bcrypt) + `fn_exigir_pin(p_pin)` que muchas funciones invocan con
`PERFORM fn_exigir_pin(p_pin)`. El PIN es estático y se pide en el front.

**Diseño recomendado (custom OTP, mínimo acoplamiento):**

1. **Tabla** (nueva, `57_usuario_otp.sql`):
   ```sql
   CREATE TABLE usuario_otp (
     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     usuario_id   UUID NOT NULL REFERENCES auth.users(id),
     codigo_hash  TEXT NOT NULL,                 -- crypt(codigo, gen_salt('bf'))
     proposito    VARCHAR(60),                   -- ej. 'ACCION_SENSIBLE'
     expira_en    TIMESTAMPTZ NOT NULL,          -- now() + TTL
     usado_en     TIMESTAMPTZ,
     fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```
   RLS: sin políticas para `authenticated` (acceso solo vía RPC/Edge, patrón del
   proyecto). Índice por `usuario_id` + `expira_en`.

2. **Generar+enviar (Edge Function `solicitar-otp`):** genera 6 dígitos, guarda
   `codigo_hash` + `expira_en` (TTL, OQ-OTP-TTL), y envía el correo por SMTP
   Brevo con HTML propio (identidad "Centro de Vida 4 Anillo", nunca "VisionHub",
   registro formal). Rate-limit por usuario (reusar criterio de 30s de EMAILS-AUTH).

3. **Verificar:** `fn_exigir_pin(p_pin)` pasa a verificar el OTP:
   ```
   busca el último usuario_otp del usuario, no usado, no expirado;
   si crypt(p_pin, codigo_hash) coincide -> marca usado_en = now(), OK;
   si no -> RAISE 'PIN_INCORRECTO' (mismo error, el front ya lo maneja).
   ```
   Se mantiene el nombre/firma `fn_exigir_pin(p_pin)` y el parámetro `p_pin` en
   todas las funciones sensibles → **cero cambios en las ~10 funciones que ya lo
   llaman** (crear iglesia, fusiones, config, moneda, toggle depto, y las nuevas).

4. **Frontend:** el diálogo de PIN pasa a: botón "Enviar código" → llama
   `solicitar-otp` → el usuario ingresa el código recibido → se envía como
   `p_pin`. Componente compartido `ConfirmarConCodigoDialog`.

5. **Migración de `usuario_pin`:** se deja de usar para verificación (se puede
   conservar la tabla marcada como deprecada, o dropear en una migración
   posterior una vez validado el OTP en vivo — ver OQ-OTP-PIN).

**Alternativa evaluada (no elegida):** `supabase.auth.reauthenticate()` (nonce
por correo con plantilla nativa de Reauthentication). Descartada como opción
principal: acopla a GoTrue y no gatea RPCs arbitrarios de forma limpia. Se deja
documentada por si se prefiere no mantener Edge Function propia.

## 10. Transversal de UI

- **Pie de soporte** (`AppShell.tsx`): bloque en el pie del sidebar desktop y del
  drawer móvil (`SheetFooter`). `mailto:soporte@somoscdv.com` con `subject` y
  `body` prellenados (rol, iglesia activa, ruta actual para contexto). Estilo
  discreto según `frontend-style/SKILL.md`.
- **Hover azul estándar:** extraer `CAMPO_ESTILO` (hoy en
  `CamposMembresiaFields.tsx`) a un lugar compartido (p. ej. `lib/estilos.ts` o
  una clase utilitaria), aplicarlo en formularios nuevos, y **documentarlo** como
  patrón en `frontend-style/SKILL.md`. No se toca el uso actual de Matías.
- **Colores de departamento y tipo de iglesia:** documentar en el design system
  como tokens/constantes junto a la paleta existente (`DashboardUI`).

## 11. Verificación

- Backend: pruebas curl (`harness/12-pruebas-curl/`) para cada RPC nueva
  (permiso correcto, OTP exigido, soft delete, no-autoedición).
- Frontend: `cd frontend && npx tsc -b && npm run lint` sin errores nuevos.
- OTP: prueba de entrega real por correo (buzón desechable + `astlimbark@gmail.com`),
  como se hizo con las plantillas de EMAILS-AUTH.
