import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Minus, MoreVertical } from 'lucide-react';

export type TendenciaIndicador = 'positiva' | 'negativa' | 'neutral';

interface Props {
  icon: LucideIcon;
  label: string;
  color: string;
  valor: ReactNode;
  descripcion: string;
  variacion?: { texto: string; tendencia: TendenciaIndicador } | null;
  onClick?: () => void;
}

const ICONO_TENDENCIA: Record<TendenciaIndicador, LucideIcon> = {
  positiva: ArrowUp,
  negativa: ArrowDown,
  neutral: Minus,
};

const COLOR_TENDENCIA: Record<TendenciaIndicador, string> = {
  positiva: '#18a66a',
  negativa: '#e5484d',
  neutral: '#8a94a6',
};

/**
 * Card de indicador estilo "SaaS claro" -- pedido puntual del owner
 * (2026-09-08) a partir de una spec de diseño (fondo pastel, ícono en caja de
 * color pleno, número grande, indicador de variación, blob decorativo).
 * Usada en las 13 cards del dashboard (pedido explícito: "deben aplicarse a
 * todas las cards", no solo las 4 originales). Deliberadamente NO es una
 * variante de `KpiMosaico` (`DashboardUI.tsx`): el lenguaje visual es opuesto
 * (fondo claro vs. degradado oscuro pleno), así que se mantiene como
 * componente local de este dashboard -- no toca el sistema compartido que
 * usan Red/Supervisor/Pastor. Fijo en modo claro a propósito (la spec es
 * explícitamente un look claro/pastel, no hay equivalente oscuro pedido).
 *
 * Tamaño compacto (2026-09-08, segundo ajuste): la primera versión era
 * demasiado grande ("no deben ocupar todo el campo, así se ve mejor en
 * matriz") y el ícono resaltaba de más -- se achicó todo (caja de ícono,
 * ícono, número, padding, alto) para que entren 4 por fila como antes.
 */
export function CardIndicadorPastel({ icon: Icon, label, color, valor, descripcion, variacion, onClick }: Props) {
  const fondo = `color-mix(in oklab, ${color} 8%, white)`;
  const borde = `color-mix(in oklab, ${color} 14%, white)`;
  const IconoTendencia = variacion ? ICONO_TENDENCIA[variacion.tendencia] : null;

  const contenido = (
    <>
      {/* Decoración: 3 curvas superpuestas (radial-gradient, no un rectángulo
          ni un linear-gradient plano) que nacen de la esquina inferior
          derecha y se desvanecen hacia el centro -- pedido explícito del
          owner (2026-09-08). El clip final lo da `overflow-hidden` de la
          card misma, no hace falta uno propio acá. */}
      <div className="pointer-events-none absolute right-0 bottom-0 h-[52%] w-[40%]" aria-hidden="true">
        <div
          className="absolute -right-[12%] -bottom-[18%] h-[95%] w-[95%] rounded-full"
          style={{ background: `radial-gradient(circle at 68% 68%, color-mix(in oklab, ${color} 16%, transparent) 0%, transparent 72%)` }}
        />
        <div
          className="absolute -right-[2%] -bottom-[6%] h-[62%] w-[62%] rounded-full"
          style={{ background: `radial-gradient(circle at 72% 72%, color-mix(in oklab, ${color} 32%, transparent) 0%, transparent 74%)` }}
        />
        <div
          className="absolute right-[4%] bottom-[2%] h-[34%] w-[34%] rounded-full"
          style={{ background: `radial-gradient(circle at 76% 76%, color-mix(in oklab, ${color} 48%, transparent) 0%, transparent 76%)` }}
        />
      </div>

      <div className="relative flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]"
          style={{ background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 80%, #000) 100%)` }}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <MoreVertical className="h-4 w-4 shrink-0 text-[#8a94a6] transition-colors hover:text-[#5b6472]" />
      </div>

      <div className="relative flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-[0.06em] text-[#5b6472] uppercase">{label}</p>
        <p className="text-[30px] leading-none font-extrabold tracking-tight text-[#152238] tabular-nums">{valor}</p>
        <p className="truncate text-[13px] text-[#6b7688]">{descripcion}</p>
      </div>

      <div className="relative h-[16px]">
        {variacion && IconoTendencia && (
          <p className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: COLOR_TENDENCIA[variacion.tendencia] }}>
            <IconoTendencia className="h-3 w-3" />
            {variacion.texto}
          </p>
        )}
      </div>
    </>
  );

  const clases = `group relative flex min-h-[164px] flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all duration-200${
    onClick ? ' cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(15,23,42,0.1)]' : ''
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clases} style={{ background: fondo, borderColor: borde }}>
        {contenido}
      </button>
    );
  }
  return (
    <div className={clases} style={{ background: fondo, borderColor: borde }}>
      {contenido}
    </div>
  );
}
