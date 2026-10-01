# Diseño técnico — Bautismo (instructivo explícito)

> **Para quien implemente esto (puede ser OpenCode u otra herramienta SIN el
> contexto de la sesión donde se escribió):** este documento es
> auto-contenido. Bautismo es **un clon de la pantalla de Altar** (ya
> construida y funcionando) con 3 cambios: (a) un proceso nuevo `BAUTISMO`,
> (b) un color suave distinto, (c) un botón "Llenar membresía". Seguí los
> pasos en orden. Verificá con `npx tsc -b` desde `frontend/` tras cada
> bloque. El idioma del proyecto es español (commits, comentarios, UI).

## Archivo de referencia (LEERLO PRIMERO, se copia casi tal cual)

`frontend/src/pages/AfirmacionAltar.tsx` -- es la pantalla de Altar: pestañas
Buscar / Nuevo / Datos, buscador de persona, alta rápida y registro del
proceso con historial. Bautismo es lo mismo cambiando el código de proceso.
Acepta props `{ iglesiaId?, onVolver? }` (para reusarse embebido en el portal
de Colaborar).

Backend genérico ya existente (NO se reescribe, ya soporta cualquier proceso):
- `fn_afirmacion_registrar_proceso(p_persona_id, p_proceso_codigo, p_fecha)`
- `fn_afirmacion_estado_proceso(p_persona_id, p_proceso_codigo)`
- `fn_afirmacion_historial_proceso(p_iglesia_id, p_proceso_codigo, p_registrado_por)`
Están en `supabase/migrations/20260927140000_kan481_altar_proceso_afirmacion.sql`.
Los hooks del frontend están en `frontend/src/hooks/useAfirmacion.ts`
(`useRegistrarProcesoAfirmacion`, `useHistorialProcesoAfirmacion`,
`useEstadoProcesoAfirmacion`).

## Paso 1 — Backend: agregar el proceso BAUTISMO

1a. Crear migración `supabase/migrations/2026XXXXXXXXXX_bautismo_proceso.sql`
con SOLO esto (ADD VALUE a un enum no puede ir junto con otras sentencias en
la misma transacción):

```sql
ALTER TYPE proceso_afirmacion_codigo_enum ADD VALUE IF NOT EXISTS 'BAUTISMO';
```

Aplicarla a producción (el proyecto no tiene CI/CD de DB, se aplica a mano):
`npx supabase db query --linked -f supabase/migrations/2026XXXXXXXXXX_bautismo_proceso.sql`

1b. Agregar `'BAUTISMO'` al tipo TypeScript del código de proceso. Buscar
`ProcesoAfirmacionCodigo` (en `frontend/src/types/afirmacion.types.ts` o
donde esté definido como `'ALTAR' | 'RSIL' | 'FIESTA_BIENVENIDA'`) y sumar
`| 'BAUTISMO'`.

## Paso 2 — Frontend: crear la pantalla de Bautismo

2a. Copiar `frontend/src/pages/AfirmacionAltar.tsx` a
`frontend/src/pages/AfirmacionBautismo.tsx` y renombrar el componente
exportado a `AfirmacionBautismo`.

2b. Cambios dentro del archivo copiado:
- Todos los `procesoCodigo: 'ALTAR'` / `'ALTAR'` que se pasan a los
  hooks/registro -> `'BAUTISMO'`.
- Textos de UI: el encabezado "ALTAR" -> "BAUTISMO"; "Registrar que pasó al
  Altar" / "Registrar Altar" -> equivalentes de Bautismo ("Registrar
  bautismo"); subtítulos análogos.
- **Color**: Altar usa el acento `#0071E3` (azul) y un degradado celeste.
  Para Bautismo usar un **color suave distinto** (sugerencia: un celeste-agua
  / teal suave, ej. `#30b0c7`, o lo que defina el owner -- ver
  open-questions #2). Cambiar el acento y el degradado de fondo a ese tono.
- La marca de agua / logo pueden quedar igual (es el logo de la iglesia).

2c. **Botón "Llenar membresía"** (lo único realmente nuevo respecto de
Altar). En el paso de confirmación, DESPUÉS de registrar el bautismo con
éxito (donde Altar muestra el toast de éxito y limpia), agregar un botón
secundario "Llenar membresía" que navegue a la Membresía (Nuevos) de esa
persona. La ruta es `ROUTES.AFIRMACION_MEMBRESIA_NUEVOS`
(`/afirmacion-membresia-nuevos`). Pasar la persona recién bautizada
(id + nombre) para que la Membresía la precargue -- OJO: hoy esa pantalla
arranca en blanco y todavía NO soporta "persona existente precargada"
(ver open-questions #1). Por ahora: dejar el botón navegando a esa ruta
(ej. con el `persona_id` en el state de navegación o query), y marcar en el
código con un `// TODO harness/24 #1` que la precarga depende de que
Membresía (Nuevos) acepte una persona existente.

2d. **Casa de Paz en "añadir nueva persona"** (decisión del owner 2026-10-01):
cuando se da de alta a esa persona del ~1% que no está en el sistema, el
formulario de alta debe además **capturar la Casa de Paz** con los 3 modos
(por invitador/afinidad, elegir de la lista, o ninguna → designación). Hay
un componente ya listo en master para esto: **`SelectorCasaDePaz`**
(`frontend/src/components/afirmacion/SelectorCasaDePaz.tsx`). Úsalo junto a
`DatosBasicosPersonaFields` en el paso "Nuevo":

```tsx
import { SelectorCasaDePaz, DATOS_CASA_DE_PAZ_VACIO, type DatosCasaDePaz } from '@/components/afirmacion/SelectorCasaDePaz';
// ...estado local: const [cdp, setCdp] = useState<DatosCasaDePaz>(DATOS_CASA_DE_PAZ_VACIO);
// ...en el render del alta: <SelectorCasaDePaz valores={cdp} onChange={setCdp} iglesiaId={iglesiaId} />
```

El **guardado** de esa CdP (asignar la persona a `casa_de_paz_membresia`
según el modo, o dejarla sin CdP si es ASIGNAR para que vaya a designación)
es lógica compartida que **todavía no existe** como RPC -- igual que el
guardado final de la Membresía (harness/21). Por ahora: crear la persona
con `crearPersona` (como hace Altar hoy) y dejar un `// TODO harness/23:
aplicar la CdP capturada (INVITADOR -> CdP del invitador, LISTA -> esa CdP,
ASIGNAR -> sin CdP/designación)`. **Si algo de esto no está claro,
preguntá antes de improvisar el guardado de CdP.**

## Paso 3 — Ruta + menú

3a. `frontend/src/utils/constants.ts`: agregar
`AFIRMACION_BAUTISMO: '/afirmacion-bautismo',` junto a `AFIRMACION_ALTAR`.

3b. `frontend/src/App.tsx`: `const AfirmacionBautismo = lazy(() => import('@/pages/AfirmacionBautismo').then((m) => ({ default: m.AfirmacionBautismo })));`
y registrar la ruta junto a la de Altar:
`<Route path={ROUTES.AFIRMACION_BAUTISMO} element={<RutaAfirmacion><AfirmacionBautismo /></RutaAfirmacion>} />`

3c. `frontend/src/utils/permisos.ts`: agregar `ROUTES.AFIRMACION_BAUTISMO`
en las dos listas donde ya está `ROUTES.AFIRMACION_ALTAR` (la lista de
Supervisor/Pastor y `RUTAS_LIDER_DEPARTAMENTO`), y agregar el item de nav en
`NAV_ITEMS_AFIRMACION` y en el catálogo del Supervisor, copiando la línea de
"Altar" y cambiando label a "Bautismo", path a `ROUTES.AFIRMACION_BAUTISMO`,
color al suave elegido, e `icon` a uno de bautismo (ej. `Droplets` de
lucide-react, ya usado en Colaborar.tsx para Bautismo).

## Paso 4 — Enchufar en el portal de Colaborar

En `frontend/src/pages/Colaborar.tsx`:
- En `COLABORACIONES_POR_DEPARTAMENTO.AFIRMACION`, la entrada `codigo:
  'BAUTISMO'` pasa de `disponible: false` a `disponible: true`.
- En `PortalColaborar`, agregar el caso `colaboracionAbierta === 'BAUTISMO'`
  que renderice `<AfirmacionBautismo iglesiaId={colaboracion.iglesia_id}
  onVolver={() => setColaboracionAbierta(null)} />` (igual que ya se hace
  con Altar).
- Importar `AfirmacionBautismo`.

## Verificación

- `cd frontend && npx tsc -b` sin errores nuevos; `npm run lint` sin errores
  nuevos.
- En vivo (dev server en `http://localhost:5174`, el proyecto corre en Docker
  con `docker compose up -d`): entrar al menú Afirmación -> "Bautismo";
  buscar una persona existente y registrar un bautismo; probar "añadir
  persona" (el ~1%); ver la pestaña Datos; confirmar que aparece el botón
  "Llenar membresía" tras registrar. Probar que todo entra sin scroll en
  PC y en móvil (375px).

## Qué NO tocar

- La pantalla de Altar (`AfirmacionAltar.tsx`) -- Bautismo es una copia
  aparte; el rediseño visual unificado de los tres (Altar/Bautismo/RSIL) es
  un trabajo posterior, no este.
- El backend genérico de procesos (ya soporta BAUTISMO con solo el ADD VALUE).
- La Membresía (Nuevos) -- solo se navega hacia ella; su guardado final y la
  precarga de persona existente son de harness/21, no de acá.
