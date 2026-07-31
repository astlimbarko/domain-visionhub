---
name: frontend-style
description: Sistema de diseño visual del frontend de VisionHub (estilo Apple minimalista — degradados sólidos KpiMosaico, headers TarjetaHeader/SeccionIconHeader, DonutRing, paleta de tokens compartida). Usar SIEMPRE al crear o modificar cualquier página, componente, card, dashboard, KPI, header de sección o estado vacío/carga dentro de frontend/src, para que se vea consistente con el resto del proyecto en vez de inventar un estilo nuevo.
---

# Estilo de frontend — VisionHub

Sistema de diseño ya consolidado en los 4 dashboards (Líder de Red, Líder de
CdP, Supervisor, Pastor) y adoptado en las demás pantallas. **No inventes
markup ni colores nuevos para una card o un KPI**: reusá las piezas de acá.
Antes de estilizar algo a mano, revisá si ya existe el bloque que necesitás.

Referencias vivas (leelas si tenés dudas de cómo se ven en código real):
`src/components/dashboard/DashboardUI.tsx`, `src/components/shared/SeccionPerfil.tsx`,
`src/components/dashboard/DashboardLiderCdp.tsx`, `src/components/dashboard/DashboardPastor.tsx`.

## Identidad visual

Look "Apple system": blanco/negro puro, esquinas muy redondeadas, sombras
suaves, sin bordes duros, sin gradientes neón. Tipografía Geist Variable.
Los tokens de color y radio viven en `src/index.css` (`@theme`, `:root`, `.dark`)
— nunca hardcodees un hex que ya tenga variable equivalente, y siempre pensá
en cómo se ve en dark mode (los tokens ya resuelven eso solos).

**Radios** (escala custom en `index.css`, no la de Tailwind por defecto):
- `rounded-xl` — inputs, botones, chips pequeños, iconos chicos dentro de una card.
- `rounded-2xl` — la unidad por defecto de toda card/sección/skeleton.
- `rounded-3xl` — piezas "hero" (`DashboardHero`) o cards de KPI grandes (`KpiCard`).
- `rounded-full` — avatares, badges de punto, pastillas de estado.

**Sombra**: `shadow-sm` en cards planas sobre fondo blanco; los mosaicos de
color (`KpiMosaico`) usan una sombra de color propia (`boxShadow` con
`color-mix`), nunca `shadow-sm` genérico sobre un fondo de color sólido.

## Paleta compartida — usar SIEMPRE las constantes, nunca hex sueltos

Importar de `@/components/dashboard/DashboardUI`:

```ts
import { AZUL, VERDE, AMBAR, MORADO, MARINO, TEAL, DEGRADADO_IDENTIDAD, mosaico } from '@/components/dashboard/DashboardUI';
```

- `AZUL` (`--chart-1`) — identidad/marca, cumplimiento, información neutra positiva.
- `VERDE` (`--chart-2`) — éxito, asistencia, reportes enviados, ingresos.
- `AMBAR` (`--chart-3`) — alerta suave, rachas, niños/atención, nunca error real.
- `MORADO` (`--chart-4`) — evangelismo, fidelidad espiritual, secundario energético.
- `MARINO` (`--brand-navy-soft`) — dato "serio"/estructural (tendencias, asistencia total).
- `TEAL` — mezcla verde+azul, para financiero o miembros cuando ya usaste verde/azul cerca.

Reglas de color:
- Elegí el color por **significado semántico** (igual variable = mismo concepto en toda la app), no por "el que quede bonito".
- Para un tinte de fondo tenue de un color: `color-mix(in oklab, ${COLOR} 8%|12%|14%, transparent)` (así se hace en `TarjetaHeader` y en las filas de lista).
- Ámbar/rojo solo cuando hay una razón real (ej. `< 80%` de cumplimiento). Nunca "decorar" con rojo una cifra que no es un problema.
- `--destructive` es exclusivo para acciones/estado de error real, no para "cosas pendientes".

## Piezas reutilizables

### `DashboardHero` (`dashboard/DashboardUI.tsx`)
Banner superior de un dashboard: degradado navy→blanco (`GRADIENTE_HERO`),
sello con ícono en `DEGRADADO_IDENTIDAD`, título grande + eyebrow. Uno por
página de dashboard, con `actions` a la derecha (selects de período, etc.).

### `KpiMosaico` (`dashboard/DashboardUI.tsx`)
La tarjeta de KPI por defecto de todo el proyecto: degradado sólido de color
pleno (`mosaico(color)`), texto blanco, ícono en caja `bg-white/20
backdrop-blur-sm`, número grande arriba de una línea de label y un `sub`
opcional (variación, meta, aclaración corta).

```tsx
<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <KpiMosaico label="Miembros" icon={Users} color={TEAL} sub="Miembros activos">
    {kpi.miembros_activos.valor}
  </KpiMosaico>
</div>
```

Reglas:
- Grid de KPIs siempre `grid-cols-2 ... lg:grid-cols-4` (o `sm:grid-cols-3` si son 3), `gap-3`.
- `sub` es texto corto (una línea), no un componente pesado. Para variaciones use el
  helper `subVariacion(pct, fallback)` (flecha ↑/↓ + `Minus` si es 0) como en `DashboardLiderCdp.tsx`.
- Si el valor es un porcentaje, mostralo como children directamente (`{pct}%`), **no** metas un
  `DonutRing` adentro de un `KpiMosaico` — no es el patrón, ver sección DonutRing abajo.
- Loading: un `Skeleton` por tile (`h-28 w-full rounded-2xl` o `h-32` si la card es más alta), nunca un único skeleton ancho tapando el grid entero.

### `TarjetaHeader` (`shared/SeccionPerfil.tsx`)
Header bandeado para toda `section` de contenido (gráficos, listas, tablas).
Franja tenue del color de la sección + ícono en caja de color sólido + título
del mismo color + descripción chica. Acepta `accion` (selects, botones,
navegación) alineado a la derecha.

```tsx
<section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
  <TarjetaHeader icon={Wallet} color={VERDE} titulo="Resumen financiero" descripcion="Total del mes" />
  <div className="p-5">{/* contenido */}</div>
</section>
```

Este es el wrapper estándar de **toda card de sección** (no solo dashboards):
`section.overflow-hidden.rounded-2xl.border.border-border/60.bg-card` +
`TarjetaHeader` + `div.p-5` (o `p-4` si el contenido es denso, como una grilla
de calendario). No uses `border-border` sólido ni te olvides `overflow-hidden`
(la franja de color del header necesita que las esquinas la recorten).

### `SeccionIconHeader` (`shared/SeccionIconHeader.tsx`)
Versión **suelta**, sin franja ni borde inferior: ícono en caja tenue
(`color-mix ... 14%`) + título + descripción. Se usa como encabezado de
subsección *dentro* de un formulario largo, o donde no corresponde otra
`section` con su propio marco (por eso no lleva `accion`). Si el bloque que
estás armando es una card independiente con su propio borde, usá
`TarjetaHeader`, no este.

### `DonutRing` (`dashboard/DonutRing.tsx`)
Anillo tipo "Activity ring". Úsalo **solo** cuando `porcentaje` es una
proporción real (asistencia/miembros, cumplimiento/semanas). Si no hay razón
genuina, pasalo sin `porcentaje` (queda de marco decorativo con el ícono al
centro) — nunca inventes un número para rellenarlo. Vive suelto dentro de una
card propia (ver `KpiCard`), no dentro de un `KpiMosaico`.

### `KpiCard` (`dashboard/KpiCard.tsx`)
Variante de KPI con `DonutRing` a la izquierda en vez de degradado sólido:
`rounded-3xl border border-border bg-card p-5 shadow-sm`. Es el patrón
"antiguo" pre-`KpiMosaico`; para KPIs nuevos preferí `KpiMosaico` salvo que el
dato sea genuinamente una proporción y quieras el anillo como protagonista.

### `ProximamentePlaceholder` (`shared/ProximamentePlaceholder.tsx`)
Estado vacío estándar: `rounded-2xl border border-border bg-card py-20
shadow-sm`, ícono circular `bg-primary/10`, título + descripción centrados.
Usalo para "todavía no hay X" en vez de un `<p>` suelto.

### `Skeleton` (`ui/skeleton.tsx`) — loading
Siempre con el `rounded-*` y alto aproximado de la pieza real que reemplaza
(`h-28 w-full rounded-2xl` para un `KpiMosaico`, `h-96 rounded-2xl` para una
página entera). Nunca un spinner genérico centrado.

## Composición de una página nueva

1. `DashboardHero` (si es un dashboard) o un encabezado simple si es una página utilitaria.
2. Grid de `KpiMosaico` (si hay indicadores numéricos).
3. `section` + `TarjetaHeader` + `div.p-5` por cada bloque de contenido (gráfico, tabla, lista, calendario).
4. Listas dentro de una sección: filas `flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted/50` con un ícono circular tenue (`h-8 w-8 rounded-full`, fondo `color-mix(... 12%, transparent)`) a la izquierda.
5. Todo el layout de página en `flex flex-col gap-6`; entre KPIs de un mismo grid, `gap-3`; entre dos `section` lado a lado, `gap-5` o `gap-6`.

## Tipografía y texto chico

- Label uppercase de KPI: `text-[11px] font-semibold tracking-wider text-muted-foreground uppercase` (o `text-white/85` sin uppercase dentro de un `KpiMosaico`).
- Número grande: `text-2xl font-bold tracking-tight` en card blanca; `text-[26px] font-bold tracking-tight tabular-nums` con `text-shadow` sutil dentro de `KpiMosaico`.
- Texto secundario/meta: `text-[11px] text-muted-foreground`.
- Números que se comparan en columna (montos, conteos): `tabular-nums`.

## Componentes base (no reinventar)

Botones, inputs, selects, badges, cards genéricas, diálogos ya están en
`src/components/ui/*` (shadcn + `class-variance-authority`, `radix-ui`). Usalos
tal cual — `Button` ya trae `rounded-xl`, tamaños (`sm`/`icon`/`icon-sm`...) y
variantes (`default`/`outline`/`ghost`/`destructive`). No armes un botón a
mano con `<button className="...">`.

## Patrones de gestión administrativa (15-gestion-administrativa)

### Hover azul de formularios — estándar de todo formulario nuevo

`CAMPO_ESTILO` (`@/lib/estilos.ts`) es el estándar de proyecto para campos de
formulario de captura de datos (`Input`/`SelectTrigger`): más contraste que el
default, con resplandor al pasar el mouse/enfocar, usando el token `--ring`
(respeta claro/oscuro solo). Nació en Afirmación (14-afirmacion) y se adoptó
como estándar (REQ-UI-2). **Todo formulario nuevo de captura de datos debe
usarlo**, no el borde default de `<Input>`.

```tsx
import { CAMPO_ESTILO } from '@/lib/estilos';

<Input className={CAMPO_ESTILO} {...register('campo')} />
<SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>...</SelectTrigger>
```

### Pie de soporte institucional

`SoporteFooter` (definido en `components/layout/AppShell.tsx`) es el bloque
discreto al pie del sidebar/drawer que abre un `mailto:soporte@somoscdv.com`
con asunto y cuerpo prellenados (usuario, rol, iglesia, sección actual). No
duplicar este patrón en otra pantalla sin necesidad real — vive una sola vez
en el layout, no por página.

### Colores institucionales de Departamento

Los 4 departamentos oficiales (Evangelismo/Afirmación/Discipulado/Envío en la
BD) se muestran en la UI con **verbo** + color propio. Aún no existe columna
`color` en la tabla `departamento` (llega con el Panel 3 de
`15-gestion-administrativa/implementation-plan.md`) — cuando se implemente,
usar esta paleta, consistente en toda pantalla que muestre departamentos:

| Código BD | Verbo (UI) | Color | Hex de referencia |
|---|---|---|---|
| `EVANGELISMO` | Evangelizar | Amarillo | `#F5C518` |
| `AFIRMACION` | Afirmar | Azul | `#0071E3` |
| `DISCIPULADO` | Discipular | Rojo | `#FF3B30` |
| `ENVIO` | Enviar | Gris | `#8E8E93` |

No hardcodear estos hex sueltos por archivo: cuando se construya la pantalla
"Departamentos", centralizarlos en un único lugar (mapa `codigo -> {verbo,
color}`), igual que `NOMBRE_ROL`/`NOMBRE_ROL_CORTO` en `Administracion.tsx`.

### Iglesia satélite (concepto visual, backend en Panel 4)

Cuando exista `iglesia.tipo` (`HIJA` | `SATELITE`, ver Panel 4), la diferencia
es **solo conceptual/visual** por ahora: mismo comportamiento funcional, distinta
etiqueta/ícono/badge. No inventar lógica de negocio distinta entre ambos tipos
sin que el owner lo pida explícitamente (ver `open-questions.md OQ-SAT-DIFF`).

## Antes de dar por terminado un cambio visual

- `npx tsc -b` y `npm run lint` (oxlint) desde `frontend/` sin errores nuevos.
- Revisá que no quedó ningún hex suelto que debería ser una constante compartida (`AZUL`, `VERDE`, etc.) o un token de `index.css`.
- Si agregaste una card nueva, confirmá que tiene el wrapper `overflow-hidden rounded-2xl border border-border/60 bg-card` + `TarjetaHeader`, no un estilo ad-hoc.
