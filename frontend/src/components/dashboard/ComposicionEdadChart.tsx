import { Baby, GraduationCap, Briefcase, Users as IconAdultos, Armchair, type LucideIcon } from 'lucide-react';

export interface RangoEtario {
  etiqueta: string;
  cantidad: number;
}

interface Props {
  rangos: RangoEtario[];
}

/** Un ícono reconocible por rango, en vez de solo un rótulo de texto -- se entiende de un vistazo sin leer los números del eje. */
const ICONO_POR_ETIQUETA: Record<string, LucideIcon> = {
  '0-11': Baby,
  '12-17': GraduationCap,
  '18-30': Briefcase,
  '31-59': IconAdultos,
  '60+': Armchair,
};

/** Un solo hue en rampa (más oscuro = más edad) -- son buckets ORDINALES (niños → mayores), no identidad nominal. */
function colorPorIndice(i: number, total: number) {
  const pct = total <= 1 ? 0 : i / (total - 1);
  return `color-mix(in oklab, var(--chart-3) ${Math.round(40 + pct * 55)}%, white)`;
}

/**
 * Composición por edad -- barras con un ícono propio por rango arriba
 * (2026-09-08, pedido del owner: más entendible de un vistazo, no solo un
 * eje con números).
 */
export function ComposicionEdadChart({ rangos }: Props) {
  const total = rangos.reduce((acc, r) => acc + r.cantidad, 0);
  const max = Math.max(1, ...rangos.map((r) => r.cantidad));

  if (total === 0) return <p className="text-sm text-muted-foreground">Sin personas todavía.</p>;

  return (
    <div className="flex items-end justify-between gap-2 sm:gap-4">
      {rangos.map((r, i) => {
        const Icon = ICONO_POR_ETIQUETA[r.etiqueta] ?? IconAdultos;
        const color = colorPorIndice(i, rangos.length);
        const alturaPct = Math.max(6, Math.round((r.cantidad / max) * 100));
        return (
          <div key={r.etiqueta} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[13px] font-bold text-foreground">{r.cantidad}</span>
            <div className="flex h-28 w-full items-end justify-center">
              <div className="w-full max-w-9 rounded-t-lg transition-[height] duration-500" style={{ height: `${alturaPct}%`, background: color }} />
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${color} 30%, transparent)` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </span>
            <span className="text-[10.5px] text-muted-foreground">{r.etiqueta}</span>
          </div>
        );
      })}
    </div>
  );
}
