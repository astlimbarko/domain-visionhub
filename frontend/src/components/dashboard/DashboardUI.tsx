import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { GRADIENTE_HERO, DEGRADADO_IDENTIDAD } from '@/components/shared/SeccionPerfil';

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

/** Variantes de GRADIENTE_HERO/DEGRADADO_IDENTIDAD derivadas de un color propio
 * (ej. el de la Red) en vez del navy institucional fijo -- mismo estilo
 * diagonal oscuro→claro, solo cambia el tono base. */
const gradienteHeroColor = (c: string) =>
  `linear-gradient(120deg, color-mix(in oklab, ${c} 85%, #000) 0%, ${c} 55%, color-mix(in oklab, ${c} 55%, #fff) 100%)`;
const degradadoIdentidadColor = (c: string) =>
  `linear-gradient(135deg, ${c} 0%, color-mix(in oklab, ${c} 52%, #fff) 100%)`;

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
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/25" style={{ background: fondoSello }}>
            <Icon className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">{eyebrow}</span>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="truncate text-[13px] text-white/70">{subtitle}</p>}
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
  children,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  sub?: ReactNode;
  /** Variante angosta en fila (ícono + valor + label en una línea) para grupos de KPIs con poco contenido cada uno. */
  compact?: boolean;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <div
        className="relative flex items-center gap-3 overflow-hidden rounded-2xl p-3.5 text-white"
        style={{ background: mosaico(color), boxShadow: `0 14px 26px -14px color-mix(in oklab, ${color} 75%, transparent)` }}
      >
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
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl p-4 text-white"
      style={{ background: mosaico(color), boxShadow: `0 14px 26px -14px color-mix(in oklab, ${color} 75%, transparent)` }}
    >
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="relative">
        <div className="text-[26px] leading-none font-bold tracking-tight tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0_/_0.18)]">{children}</div>
        <p className="mt-1.5 text-[12px] font-medium text-white/85">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-white/70">{sub}</p>}
      </div>
    </div>
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
