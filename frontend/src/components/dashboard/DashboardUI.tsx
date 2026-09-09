import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { GRADIENTE_HERO, DEGRADADO_IDENTIDAD } from '@/components/shared/SeccionPerfil';
import { textoLegibleSobre, mezclarHaciaNegro } from '@/features/estructura-organizacional/contraste';

export { DEGRADADO_IDENTIDAD };

/**
 * Estilo compartido de los dashboards: hero con degradado, mosaicos KPI de
 * color pleno y el degradado propio de la identidad (azul → blanco). Se define
 * una sola vez acá para que los cuatro dashboards (Líder de Red, Líder de CdP,
 * Supervisor y Pastor) se vean idénticos. Las tarjetas de sección usan
 * `TarjetaHeader` de `shared/SeccionPerfil`.
 */

export const AZUL = 'var(--chart-1)';
export const VERDE = 'var(--chart-2)';
export const AMBAR = 'var(--chart-3)';
export const MORADO = 'var(--chart-4)';
export const MARINO = 'var(--brand-navy-soft)';
export const TEAL = 'color-mix(in oklab, var(--chart-2) 55%, var(--chart-1))';

/** Degradado sólido y elegante: mismo tono, apenas más profundo, sin pastel ni neón. */
export const mosaico = (c: string) => `linear-gradient(150deg, color-mix(in oklab, ${c} 92%, #000) 0%, color-mix(in oklab, ${c} 70%, #000) 100%)`;

/**
 * Variante "vidrio" de `mosaico()`: degradado de color con un poco de
 * transparencia real (para que `backdrop-blur-sm` tenga sentido), sin el
 * velo blanco que tenían las 2 versiones anteriores (2026-09-08) -- ese
 * brillo diagonal blanco + mezclar el color con transparente sobre el fondo
 * claro de la página era justo lo que lavaba el color ("le pierde el color,
 * capa blanquecina", pedido del owner). Vivo y transparente tiran para
 * lados opuestos: cuanto más se ve "a través" del fondo claro, más se lava
 * el color. Acá se prioriza el color -- opacidad alta (90%/74%, cerca del
 * `mosaico()` opaco de 92%/70%), transparencia real pero apenas perceptible,
 * el "vidrio" lo dan `backdrop-blur-sm` + `sombraVidrio()` (filo de luz +
 * sombra interna), no el color en sí.
 *
 * OJO -- riesgo de rendimiento conocido: `backdrop-blur-xl` real causó lag
 * confirmado en celulares de gama baja en este mismo proyecto (ver
 * `fix-lag-backdrop-blur-y-chunking`, 2026-09-05, sacado de Dialog/Select/
 * Popover). Acá se usa `backdrop-blur-sm` (4px, el más chico de Tailwind, no
 * el -xl de 24px que causó el problema) para acotar el costo, pero sigue
 * siendo blur real sobre 13 elementos en una grilla con scroll -- pedido
 * explícito del owner asumiendo que falta confirmar en un celular real de
 * gama baja antes de darlo por bueno del todo.
 */
export const mosaicoVidrio = (c: string) =>
  `linear-gradient(150deg, color-mix(in oklab, ${c} 90%, transparent) 0%, color-mix(in oklab, ${c} 74%, transparent) 100%)`;

/**
 * Sombras internas que le dan "volumen" al vidrio (2026-09-08, pedido del
 * owner: la primera versión traslúcida se veía plana) -- un filo de luz
 * arriba (como si el borde de vidrio atrapara la luz) y una sombra oscura
 * curva abajo (como si el vidrio tuviera espesor real), combinadas con el
 * resplandor de color de siempre hacia afuera.
 */
export const sombraVidrio = (c: string) =>
  `inset 0 1px 1px 0 rgba(255,255,255,0.55), inset 0 -18px 26px -20px rgba(0,0,0,0.4), 0 14px 26px -14px color-mix(in oklab, ${c} 75%, transparent)`;

/** Variantes de GRADIENTE_HERO/DEGRADADO_IDENTIDAD derivadas de un color propio
 * (ej. el de la Red) en vez del navy institucional fijo. El texto del banner
 * es blanco siempre -- si el color elegido es demasiado claro para eso
 * (mismo criterio que `textoLegibleSobre`, ya usado en el lienzo del
 * Constructor para las tarjetas de Red), se oscurece lo necesario; si no,
 * se muestra casi puro para que el color elegido se note de verdad.
 *
 * Bug real (2026-08-22): la primera versión usaba `color-mix(in oklab, ...)`
 * para mezclar hacia negro/blanco -- funciona en el degradado navy fijo de
 * siempre (por eso nunca se había notado), pero para un color elegido
 * libremente en el Constructor terminaba sin notarse el cambio. Se reescribe
 * con matemática de color en JS plano (`mezclarHaciaNegro`, mismo mecanismo
 * que ya usa `colorLegibleSobreBlanco` en el lienzo del Constructor) --
 * devuelve un hex real, sin depender de soporte CSS de mezcla de colores. */
export const gradienteHeroColor = (c: string) =>
  textoLegibleSobre(c) === '#ffffff'
    ? `linear-gradient(120deg, ${c} 0%, ${mezclarHaciaNegro(c, 0.35)} 100%)`
    : `linear-gradient(120deg, ${mezclarHaciaNegro(c, 0.55)} 0%, ${mezclarHaciaNegro(c, 0.7)} 100%)`;

/** Igual que `mosaico()` pero conservando el color elegido casi puro cuando
 * ya es lo bastante oscuro para texto blanco -- `mosaico()` oscurece fuerte
 * siempre (pensado para los 4 colores fijos del sistema), lo que aplastaba
 * la identidad de un color de Red elegido libremente. */
export const degradadoIdentidadColor = (c: string) =>
  textoLegibleSobre(c) === '#ffffff'
    ? `linear-gradient(135deg, ${c} 0%, ${mezclarHaciaNegro(c, 0.4)} 100%)`
    : `linear-gradient(135deg, ${mezclarHaciaNegro(c, 0.55)} 0%, ${mezclarHaciaNegro(c, 0.65)} 100%)`;

/** Banner de identidad del dashboard: degradado navy → blanco con el sello en degradado. */
export function DashboardHero({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  color,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  /** Línea chica opcional bajo el título (ej. nombre de quien lidera). No afecta a los dashboards que no la pasan. */
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Color propio opcional (ej. el elegido para la Red en el Constructor) --
   * si se pasa, reemplaza el degradado navy institucional por uno derivado
   * de este color. Sin esto, se mantiene el degradado uniforme de siempre
   * (Supervisor/Pastor, que administran varias Redes, no lo pasan). */
  color?: string;
}) {
  const fondo = color ? gradienteHeroColor(color) : GRADIENTE_HERO;
  const fondoSello = color ? degradadoIdentidadColor(color) : DEGRADADO_IDENTIDAD;
  return (
    <div
      className="relative overflow-hidden rounded-3xl px-6 py-6 text-white shadow-xl shadow-[var(--brand-navy)]/25 sm:px-8"
      style={{ background: fondo }}
    >
      <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/25" style={{ background: fondoSello }}>
            <Icon className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">{eyebrow}</span>
            {/* Bug real (2026-08-23): con `truncate` un nombre largo (de Red,
                CdP o líder) quedaba cortado con "..." en celulares angostos --
                ahora se envuelve en varias líneas en vez de recortarse, para
                que se lea completo sin importar el ancho de pantalla. */}
            <h1 className="text-2xl leading-tight font-bold tracking-tight break-words sm:text-3xl">{title}</h1>
            {subtitle && <p className="text-[13px] break-words text-white/70">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}

/**
 * Mosaico KPI de color pleno: degradado sólido y elegante con el número en
 * blanco, a la manera de un widget. `sub` agrega una línea chica opcional
 * (variación, meta, etc.).
 */
export function KpiMosaico({
  icon: Icon,
  label,
  color,
  sub,
  compact = false,
  onClick,
  vidrio = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  sub?: ReactNode;
  /** Variante angosta en fila (ícono + valor + label en una línea) para grupos de KPIs con poco contenido cada uno. */
  compact?: boolean;
  /** Si se pasa, la card se vuelve un botón de acceso rápido (mismo look de siempre, con affordance de hover/click) en vez de una card puramente informativa. */
  onClick?: () => void;
  /** Look "vidrio" de Apple: fondo translúcido de color + backdrop-blur real (chico, `blur-sm`) + brillo diagonal + borde de luz -- ver `mosaicoVidrio()`. Por defecto sigue siendo el mosaico sólido y opaco de siempre. */
  vidrio?: boolean;
  children: ReactNode;
}) {
  const estiloBase = {
    background: vidrio ? mosaicoVidrio(color) : mosaico(color),
    boxShadow: vidrio ? sombraVidrio(color) : `0 14px 26px -14px color-mix(in oklab, ${color} 75%, transparent)`,
  };
  const clasesInteractivas = onClick ? ' cursor-pointer text-left transition-transform hover:brightness-110 active:scale-[0.98]' : '';
  const clasesVidrio = vidrio ? ' border border-white/25 backdrop-blur-sm' : '';

  if (compact) {
    const contenido = (
      <>
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="relative min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl leading-none font-bold tracking-tight tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0_/_0.18)]">{children}</span>
            <span className="truncate text-[12px] font-medium text-white/85">{label}</span>
          </div>
          {sub && <p className="mt-0.5 truncate text-[11px] text-white/70">{sub}</p>}
        </div>
      </>
    );
    const clases = `relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3.5 text-white${clasesInteractivas}${clasesVidrio}`;
    return onClick ? (
      <button type="button" onClick={onClick} className={clases} style={estiloBase}>{contenido}</button>
    ) : (
      <div className={clases} style={estiloBase}>{contenido}</div>
    );
  }

  const contenido = (
    <>
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="relative">
        <div className="text-[26px] leading-none font-bold tracking-tight tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0_/_0.18)]">{children}</div>
        <p className="mt-1.5 text-[12px] font-medium text-white/85">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-white/70">{sub}</p>}
      </div>
    </>
  );
  const clases = `relative flex w-full flex-col justify-between gap-6 overflow-hidden rounded-2xl p-4 text-white${clasesInteractivas}${clasesVidrio}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={clases} style={estiloBase}>{contenido}</button>
  ) : (
    <div className={clases} style={estiloBase}>{contenido}</div>
  );
}

/**
 * Chip de indicador mínimo: para filas con muchos KPIs chicos (ej. censo
 * demográfico) donde el mosaico de color pleno pesa demasiado. Mismo patrón
 * que una fila de lista (ícono circular con tinte de color, `color-mix ...
 * 14%`) en vez de degradado -- pensado para que entren muchos por fila.
 */
export function KpiChip({
  icon: Icon,
  label,
  color,
  children,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <div className="text-base leading-none font-bold tracking-tight tabular-nums text-foreground">{children}</div>
        <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
