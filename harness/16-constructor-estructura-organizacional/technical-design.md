# 16 — Constructor de Estructura Organizacional — technical-design.md

> Diseño técnico propuesto. Anclado al repositorio y al Supabase productivo
> `Centro de Vida` auditados en modo lectura el 2026-08-04. Nada marcado
> `[PROPUESTO]` está aplicado por este documento.

## 1. Principios

1. **Supabase sigue siendo el backend.** No se crea servidor Node/Express.
2. **HostGator sirve únicamente archivos estáticos.** `@xyflow/react` se ejecuta
   en el navegador y queda incluido por Vite dentro de `frontend/dist/`.
   Node.js y Docker son herramientas de desarrollo/compilación; nunca serán un
   requisito del servidor de producción. El despliegue debe respetar
   `harness/DEPLOY.md` y no registrar una aplicación Node.js en cPanel.
3. **Una fuente de verdad por concepto.** El dominio define relaciones; la tabla
   de layout solo define posiciones visuales.
4. **Aditivo y reversible.** Nuevas tablas/RPC sin debilitar RLS o flujos existentes.
5. **Aislamiento por iglesia desde la base.** Cada lectura/escritura incluye
   `iglesia_id` y autorización verificable.
6. **Reutilizar antes de crear.** Personas, cargos, redes, CdP, departamentos,
   invitaciones y OTP ya tienen piezas funcionales.
7. **Interacción progresiva.** Vista resumida primero; detalle y formularios bajo demanda.
8. **No aplicar migraciones desde esta fase.** `database-impact.md` es inventario,
   no ejecución.

## 2. Motor del lienzo

### Decisión: `@xyflow/react`

React Flow encaja con el stack React 19 y ya incluye nodos controlados,
arrastre, pan, zoom/pinch, `fitView`, selección, controles, fondo cuadriculado y
nodos personalizados. Referencias oficiales:

- https://reactflow.dev/
- https://reactflow.dev/learn/concepts/the-viewport
- https://reactflow.dev/learn/concepts/built-in-components
- https://reactflow.dev/examples/nodes/drag-handle

La dependencia quedó instalada y fijada por `package-lock.json` como
`@xyflow/react@12.11.2`; su compilación fue validada dentro de Docker.

### Configuración base

- Flujo controlado (`nodes`, `edges`, `onNodesChange`).
- `nodesDraggable` depende del rol y del “Modo organizar”.
- `nodesConnectable={false}` y conexiones no seleccionables: las relaciones no
  se dibujan manualmente.
- `snapToGrid` con cuadrícula propuesta de 16×16 px.
- `Background` con puntos/líneas de contraste muy bajo.
- `minZoom` aproximado 0.25; `maxZoom` aproximado 1.8, ajustable tras pruebas.
- `fitView` para “Centrar estructura”.
- `MiniMap` condicional en estructuras grandes o activada por el usuario.
- Controles propios en la barra para conservar el diseño de referencia.
- `dragHandle` en nodos móviles para separar arrastre de botones internos;
  controles interactivos usan clases `nodrag`/`nopan`.

## 3. Modelo visual

### Tipos de nodo

```ts
type TipoNodoEstructura =
  | 'PASTOR_SLOT'
  | 'SUPERVISOR_SLOT'
  | 'GRUPO_DEPARTAMENTOS'
  | 'DEPARTAMENTO'
  | 'GRUPO_REDES'
  | 'RED'
  | 'CASA_DE_PAZ';
```

Los responsables se muestran dentro de la entidad; no se convierten en nodos
independientes salvo Pastor/Supervisor, porque el organigrama representa cargos
principales y entidades, no un grafo libre de todas las personas.

### Claves estables

```text
pastor
supervisor-principal
grupo-departamentos
departamento:{departamento_id}
grupo-redes
red:{red_id}
cdp:{casa_de_paz_id}
```

La clave estable evita perder la posición cuando cambia la persona asignada.

### Aristas derivadas

Las aristas se generan en memoria desde datos oficiales:

- `pastor → supervisor-principal`
- `supervisor-principal → grupo-departamentos`
- `supervisor-principal → grupo-redes`
- `grupo-departamentos → cada departamento`
- `grupo-redes → cada red`
- `red → cada CdP vigente`

No se persisten aristas visuales: ya existen en `departamento`, `red`,
`casa_de_paz_red` y tablas de cargos.

## 4. Layout automático y manual

### Coordenadas iniciales

El algoritmo calcula bandas horizontales:

1. Pastor.
2. Supervisor.
3. Contenedores Departamentos y Redes.
4. Departamentos / Redes.
5. Casas de Paz de cada Red.

Los nodos nuevos se colocan en el primer espacio libre de su banda, ordenados
por `orden` oficial o nombre, evitando solapamiento con un margen fijo.

### Creación incremental

Cuando aparece un nodo nuevo:

1. Se conservan todas las posiciones guardadas.
2. Se calcula solamente la posición del nodo nuevo.
3. Se ajusta a cuadrícula.
4. Se guarda por RPC con versión del layout.

### Reorganización completa

“Organizar automáticamente”:

1. muestra confirmación;
2. recalcula todos los nodos;
3. presenta vista previa local;
4. guarda el lote en una transacción;
5. incrementa `layout_version` una sola vez.

### Concurrencia

Cada guardado envía `p_version_esperada`. Si otro administrador ya modificó el
layout, la RPC devuelve `ESTRUCTURA_LAYOUT_DESACTUALIZADO`; el frontend recarga y
ofrece reintentar. No se usa “última escritura gana” de forma silenciosa.

## 5. Estado frontend propuesto

```text
pages/EstructuraOrganizacional.tsx       composición y permisos
components/estructura/
  LienzoEstructura.tsx                   React Flow y viewport
  nodos/                                 nodos personalizados
  aristas/                               estilos de conexión
  BarraEstructura.tsx                    búsqueda, centrar, zoom, OTP
  PanelEstructura.tsx                    panel/sheet reutilizable
  AsignarPersonaPanel.tsx                doble vía
  CrearRedPanel.tsx
  CrearCasaDePazPanel.tsx
  DetalleAsignacionPanel.tsx
hooks/useEstructuraOrganizacional.ts      queries/mutations
services/estructura-organizacional.service.ts
types/estructura-organizacional.types.ts
utils/layout-estructura.ts                layout puro y comprobable
```

Reglas:

- `nodeTypes` y `edgeTypes` se declaran fuera del componente para evitar renders.
- Los nodos reciben datos mínimos y callbacks estables/memorizados.
- TanStack Query conserva caché por `['estructura-organizacional', iglesiaId]`.
- Las mutaciones invalidan solamente iglesia/entidad afectada.
- Zustand no duplicará datos remotos; solo puede guardar cámara/preferencias UI.

## 6. Carga de datos

### RPC agregadora `[PROPUESTO]`

`fn_estructura_obtener(p_iglesia_id uuid)` devuelve un JSON tipado con:

```json
{
  "iglesia": {},
  "pastor": null,
  "supervisores": [],
  "departamentos": [],
  "redes": [{ "casas_de_paz": [] }],
  "asignaciones_pendientes": [],
  "layout": { "version": 0, "nodos": [] },
  "configuracion": { "otp_requerido": false },
  "capacidades": {}
}
```

Ventajas: una carga inicial, snapshot coherente, sin N+1. Los detalles extensos
se consultan al seleccionar un nodo.

La RPC verifica que el usuario sea Super Admin o Supervisor autorizado para
`p_iglesia_id`. No confía en `iglesiaId` de la URL.

## 7. Persistencia propuesta

### `estructura_organigrama`

Una fila por iglesia:

```sql
create table public.estructura_organigrama (
  iglesia_id uuid primary key references public.iglesia(id),
  otp_requerido boolean not null default false,
  layout_version bigint not null default 0 check (layout_version >= 0),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id)
);
```

No replica nombre/tipo de iglesia. La fila se crea bajo demanda al abrir/guardar
por primera vez, o por seed para iglesias existentes.

### `estructura_nodo_posicion`

```sql
create table public.estructura_nodo_posicion (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesia(id),
  clave_nodo text not null,
  tipo_nodo text not null,
  entidad_id uuid,
  posicion_x numeric(12,2) not null,
  posicion_y numeric(12,2) not null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  constraint uq_estructura_nodo_clave unique (iglesia_id, clave_nodo),
  constraint chk_estructura_tipo_nodo check (tipo_nodo in
    ('PASTOR_SLOT','SUPERVISOR_SLOT','GRUPO_DEPARTAMENTOS','DEPARTAMENTO',
     'GRUPO_REDES','RED','CASA_DE_PAZ'))
);

create index idx_estructura_nodo_iglesia
  on public.estructura_nodo_posicion (iglesia_id);
```

`entidad_id` es una referencia polimórfica informativa y no puede tener una FK
única. La RPC valida que la entidad pertenezca a la iglesia y que la clave sea
coherente. Al borrar lógicamente una entidad, su posición deja de devolverse y
puede limpiarse después; nunca decide la existencia de la entidad.

## 8. RLS y privilegios

Ambas tablas nuevas:

- `ENABLE ROW LEVEL SECURITY`.
- `SELECT`: solo usuarios dentro del alcance de la iglesia y roles autorizados.
- escrituras directas desde PostgREST: preferentemente revocadas; usar RPC.
- RPC con `SECURITY DEFINER`, `SET search_path = ''` o esquema explícito,
  comprobación de `auth.uid()` y permiso antes de leer/escribir.
- `REVOKE EXECUTE FROM PUBLIC, anon`; `GRANT` mínimo a `authenticated`.
- índices en FKs y columnas usadas por RLS.

RPC propuestas:

- `fn_estructura_obtener(uuid)`
- `fn_estructura_guardar_posiciones(uuid, jsonb, bigint)`
- `fn_estructura_reorganizar(uuid, jsonb, bigint)`
- `fn_estructura_configurar_otp(uuid, boolean, text)`

`fn_estructura_configurar_otp` exige OTP solamente al pasar `true → false`.

## 9. OTP aislado

No se modifica `fn_verificar_otp` ni se relajan RPC globales. Se crean entradas
específicas del constructor que:

1. autorizan Super Admin/Supervisor;
2. leen `estructura_organigrama.otp_requerido`;
3. si está activo, validan `p_otp` mediante el mecanismo existente;
4. ejecutan la operación transaccional;
5. auditan la acción.

Una RPC de otro panel conserva su OTP aunque el switch del constructor esté apagado.

## 10. Designación y confirmación de lectura

### Estados propuestos

```text
PENDIENTE_CONFIRMACION → CONFIRMADA
                      ↘ CANCELADA (solo administración)
```

No existe `RECHAZADA`. La confirmación no decide el nombramiento; acredita que
la persona lo vio y permite activar acceso.

### Separación de asignación y permisos

- La entidad muestra inmediatamente el correo/persona designada y punto gris.
- Se registra una designación pendiente vinculada a cargo y destino.
- No se crea todavía la asignación efectiva que habilita el rol/capacidad, o se
  mantiene marcada como no habilitada en una tabla de designaciones separada.
- Al confirmar lectura y completar/vincular cuenta, una RPC transaccional crea
  la fila histórica oficial (`usuario_rol`, `red_cargo`, `departamento_cargo` o
  `casa_de_paz_cargo`) y cambia a verde.

Este diseño evita que una dirección mal escrita reciba permisos antes de ser
verificada. `invitacion_lider` es la base existente, pero requiere ampliar su
semántica/campos para confirmación de lectura y corrección segura.

### Corrección y reenvío

- Reenviar genera enlace/token nuevo y registra `ultimo_envio_en`/contador.
- Corregir correo invalida todos los enlaces previos antes de enviar el nuevo.
- Cancelar marca soft/cancelado y no elimina personas.
- Los tokens son de un solo uso, expirables y nunca se guardan en texto plano.

## 11. Operaciones transaccionales

No reutilizar `crearCdp()` tal como está para este módulo sin revisar: hoy crea
CdP, red y cargos en varias llamadas y degrada algunos errores en silencio. Para
el constructor se proponen RPC atómicas:

- `fn_estructura_crear_red(...)`
- `fn_estructura_crear_cdp(...)`
- `fn_estructura_asignar(...)`
- `fn_estructura_corregir_designacion(...)`
- `fn_estructura_cancelar_designacion(...)`

Cada RPC valida tenancy, duplicados, historia, switch OTP y pertenencia antes de
confirmar. Si falla un paso, hace rollback completo.

## 12. Departamentos y colores

`departamento` en Supabase no tiene `color` al 2026-08-04. Se propone columna
`text NOT NULL` con CHECK hexadecimal y seed idempotente de los colores oficiales
ya acordados en harness 15. El estado tenue/intenso se calcula por existencia de
`LIDER_DEPARTAMENTO` vigente/confirmado; no se cambia `activo` automáticamente.

## 13. Iglesias hijas y satélite

El Supabase real ya tiene `iglesia.tipo` (`HIJA|SATELITE`) e
`iglesia_padre_id`. El layout siempre usa el `iglesia_id` abierto. La madre no
absorbe visualmente a la satélite en su organigrama; puede mostrar una acción o
etiqueta que abre el organigrama independiente de la satélite.

## 14. UI responsive

- Desktop: panel lateral derecho; navegación tipo mapa.
- Tablet horizontal: panel lateral; vertical: sheet/pantalla completa según ancho.
- Teléfono: formulario a pantalla completa; lienzo detrás preservado.
- “Modo organizar” habilita `nodesDraggable`; fuera de él, un dedo hace pan.
- Drag handle dedicado; botones internos nunca arrastran el nodo.
- La barra compacta agrupa zoom/OTP secundarios sin eliminarlos.
- Safe areas y acciones Guardar/Cancelar siempre visibles.

## 15. Rendimiento

- Una RPC agregada evita N+1.
- Consultas por `iglesia_id` con índices.
- Nodos memorizados y callbacks estables.
- Persistencia al finalizar drag con debounce 300–500 ms, no por cada píxel.
- Batch upsert de posiciones en una transacción.
- Virtualización no es primera opción porque React Flow ya maneja viewport;
  medir antes de añadir complejidad.
- Pruebas objetivo: 0, 20, 100 y 500 nodos; pan/zoom fluido y sin bloqueos largos.

## 16. Pruebas

- Unitarias: layout incremental, layout completo, snap grid, claves y contraste.
- Componentes: estados vacío/gris/verde, selección y panel.
- Integración: crear Red/CdP, asignar por ambas vías, reenviar/corregir, OTP on/off.
- RLS: iglesia A nunca lee/escribe layout o asignaciones de B.
- Concurrencia: dos versiones del layout; la antigua debe fallar claramente.
- Mobile: Android/iPhone/iPad, vertical/horizontal, pan/pinch y modo organizar.
- Regresión: RPC existentes siguen exigiendo OTP según sus reglas actuales.
