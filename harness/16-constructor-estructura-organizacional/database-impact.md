# 16 — Constructor de Estructura Organizacional — database-impact.md

> Inventario de solo lectura del Supabase activo `Centro de Vida`
> (`mkgdeunylrmuogrfmdnq`) y del repositorio, realizado el 2026-08-04.
> **No se aplicó ninguna migración ni se modificó ningún dato.**

## 1. Estado real: EXISTE y debe reutilizarse

| Objeto | Estado confirmado | Uso en el constructor |
|---|---|---|
| `iglesia` | `iglesia_padre_id`, `tipo HIJA/SATELITE`, `pastor_id`, `supervisor_id` | organigrama independiente y responsables superiores |
| `red` | nombre, activo, color `CHAR(7)` | tarjetas de red |
| `casa_de_paz`, `casa_de_paz_red` | entidad e historial de red | nodos CdP y conexión oficial |
| `cargo` | incluye `SUBLIDER_RED` retitulado | Supervisor de Red |
| `red_cargo` | historial por persona/cargo/red | líderes y supervisores de red |
| `casa_de_paz_cargo` | líder, sublíder y anfitrión | responsables de CdP |
| `departamento` | cuatro entidades por iglesia; `color_nombre` y `color` aplicados el 2026-08-05 | grupo de departamentos |
| `departamento_cargo` | historial de líderes | líder/estado visual |
| `usuario_rol` | roles de sistema | Pastor/Supervisor y permisos |
| `invitacion_lider` | correo, destino, estado pendiente/completada | base para designación por correo |
| `usuario_otp` | OTP hasheado, expiración y uso | protección opcional del módulo |
| `solicitud_estructura` | solicitudes de cambio existentes | no se elimina; revisar convivencia |
| `configuracion_definicion/valor` | configuración genérica por iglesia | evaluado; no ideal para layout |
| `fn_mis_iglesias()` | alcance por usuario/rol | referencia de tenancy, no autorización única |
| `fn_es_super_admin()` | helper existente | autorización módulo |
| `fn_es_operativo_en(uuid)` | Supervisor de la Visión de la iglesia | autorización módulo |
| `fn_verificar_otp(text)` | consume OTP válido | switch OTP del módulo |
| Edge Function `invitar-lider` | correo y completar cuenta | extender, no duplicar SMTP |

## 2. Divergencias importantes

1. Harness 15 proponía “Supervisor de Red” como enum nuevo, pero el estado
   vigente lo resolvió como cargo `SUBLIDER_RED` con paridad de Líder de Red.
   **No crear un rol nuevo.**
2. `departamento.color_nombre` y `departamento.color` se aplicaron de forma
   aditiva el 2026-08-05, con seed oficial y restricciones de integridad.
3. `invitacion_lider.estado` conoce `PENDIENTE`/completada, pero no modela de
   forma explícita “confirmó que leyó”, reenvío/corrección segura ni reserva de
   slot sin permisos.
4. No existe almacenamiento de posiciones ni versión del layout.
5. No existe switch OTP exclusivo del constructor.
6. RPC existentes de departamentos y cambios sensibles exigen OTP global. No
   deben relajarse para implementar el modo inicial rápido.

## 3. Cambios PROPUESTOS

### 3.1 Tablas nuevas

| Objeto | Propósito | Riesgo |
|---|---|---|
| `estructura_organigrama` | una configuración/versionado por iglesia; switch OTP | Bajo: tabla aditiva |
| `estructura_nodo_posicion` | posiciones canónicas de nodos | Bajo: no altera dominio |
| `estructura_designacion` o ampliación controlada de `invitacion_lider` | reserva, confirmación de lectura, reenvío/corrección | Medio: toca alta/permisos |

La decisión entre tabla nueva y ampliación de `invitacion_lider` debe hacerse al
implementar tras revisar todos sus consumidores. Recomendación: tabla
`estructura_designacion` si la semántica nueva complica compatibilidad; una
designación no es exactamente la invitación histórica.

### 3.1.1 Decisión implementada para Redes — 2026-08-05

- Se mantienen `estructura_organigrama` y `estructura_nodo_posicion` como tablas propias del constructor, aislando layout/OTP del dominio existente.
- Para las designaciones de Líder y Supervisor de Red se reutiliza de forma controlada `invitacion_lider`; no se creó una tabla duplicada.
- “Supervisor de Red” usa el cargo de dominio `SUBLIDER_RED` y conserva `LIDER_RED` como rol funcional existente; no se agregó un enum nuevo.
- Se añadió el índice parcial `idx_invitacion_lider_red_pendiente` para consultar reservas pendientes por iglesia, Red y cargo.
- Las RPC `fn_estructura_validar_otp_red`, `fn_estructura_invitar_supervisor_red` y `fn_estructura_listar_invitaciones_red` tienen `search_path` fijo, autorización interna y ejecución exclusiva de `authenticated`.
- Las migraciones se aplicaron de forma aditiva; no se reasignaron Redes, Casas de Paz ni cargos existentes.
- Sigue pendiente resolver el correo equivocado/cancelación y el caso de cuenta ya existente antes de declarar completa la semántica de designación.
### 3.2 Columnas aditivas

| Tabla | Cambio |
|---|---|
| `departamento` | `color_nombre text NOT NULL` + `color text NOT NULL` + CHECK de nombre/hexadecimal + seed |

No agregar columnas de posición a `red`, `casa_de_paz` o `departamento`: mezclaría
presentación con dominio y dificultaría múltiples vistas futuras.

### 3.3 RPC nuevas

- lectura agregada del organigrama;
- batch upsert de posiciones con versión optimista;
- configuración OTP local;
- creación atómica de Red/CdP desde el constructor;
- designación/corrección/cancelación/reenvío;
- asignación transaccional al confirmar lectura.

Ninguna RPC propuesta debe confiar únicamente en RLS de tablas internas. Cada
una valida `auth.uid()`, rol, iglesia, destino y estado.

## 4. RLS propuesta

### Lectura

- Super Admin: cualquier iglesia.
- Supervisor: solamente `fn_es_operativo_en(iglesia_id)`.
- Pastor: sin acceso al módulo hasta decisión futura.
- Demás roles: sin acceso a tablas/layout del constructor.

### Escritura

- Solo RPC; revocar INSERT/UPDATE/DELETE directos cuando sea compatible.
- `estructura_nodo_posicion`: escritura únicamente Super Admin/Supervisor.
- diseño/confirmación: usuario destinatario solo puede confirmar su propia
  designación mediante RPC específica; no puede cambiar cargo/destino.

### Funciones `SECURITY DEFINER`

- esquema/calificación explícita y `search_path` seguro;
- comprobación interna de `auth.uid()`;
- `REVOKE EXECUTE` a `PUBLIC` y `anon`;
- `GRANT` mínimo a `authenticated`;
- no usar `user_metadata` para autorización;
- no usar `TO authenticated` sin predicado de iglesia/propiedad.

## 5. Índices y restricciones

- PK/FK e índice en todo `iglesia_id` nuevo.
- `UNIQUE (iglesia_id, clave_nodo)`.
- índice parcial para designaciones pendientes por iglesia/destino si la tabla
  nueva lo requiere.
- unicidad que impida dos designaciones pendientes iguales para persona/correo,
  cargo y entidad.
- CHECK de tipos/estados; fechas `timestamptz`.
- índice en tokens hasheados/identificador público según el diseño final, nunca
  almacenar token plano.

Antes de escribir SQL se ejecutará la consulta de FKs sin índice y los advisors
de seguridad/rendimiento; después de migrar se repiten.

## 6. Atomicidad

Las operaciones del constructor no deben repetir el flujo frontend multillamada
de creación actual. La RPC debe crear entidad, relación, designación y posición
en una sola transacción. Si el correo falla después de confirmar la transacción,
la designación queda pendiente y reintentable; no se revierte el dominio por un
fallo SMTP ni se duplica al reenviar.

## 7. OTP sin impacto global

`estructura_organigrama.otp_requerido` es independiente por iglesia.

- `false`: RPC del constructor no solicita código.
- `true`: RPC del constructor llama `fn_verificar_otp`.
- `true → false`: siempre exige OTP.
- RPC externas continúan exactamente igual.

No modificar `fn_verificar_otp` para leer el switch; el switch se evalúa solo en
el límite del constructor.

## 8. Datos existentes y backfill

- Una fila de `estructura_organigrama` puede crearse lazy con `otp=false`,
  `version=0` por cada iglesia.
- Las posiciones iniciales se calculan al primer acceso y se guardan al primer
  cambio/reorganización; no es obligatorio poblar miles de filas en migración.
- Los cuatro colores de departamento se actualizan idempotentemente por código.
- Ninguna Red/CdP/cargo existente se reasigna durante la migración.

## 9. Secuencia de migración profesional

1. Confirmar último número libre en `harness/11-esquema-bd/sql/`.
2. Crear archivo con `supabase migration new <nombre>` cuando se implemente.
3. Probar primero en rama/proyecto de desarrollo, nunca directamente en producción.
4. Aplicar tablas/configuración y RLS.
5. Ejecutar pruebas de aislamiento con usuarios reales de dos iglesias.
6. Ejecutar advisors de seguridad y rendimiento.
7. Generar/actualizar tipos TypeScript.
8. Recién entonces conectar frontend.

No se necesita token manual mientras el MCP de Supabase continúe autorizado. Si
la sesión pierde autorización, se solicitará OAuth/token sin copiar secretos al repositorio.

