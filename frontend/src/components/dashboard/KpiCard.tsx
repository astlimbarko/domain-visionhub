import { ArrowDown, ArrowUp, Gauge, Minus, type LucideIcon } from 'lucide-react';
import { DonutRing } from './DonutRing';

interface Props {
  titulo: string;
  valor: string | number | null | undefined;
  variacionPct?: number | null;
  subtitulo?: string;
  icon?: LucideIcon;
  /** 0–100. Pasar solo cuando representa una proporción real (ej. asistencia/miembros). */
  porcentaje?: number | null;
  /** Color del aro — por defecto azul de marca. Usar para semántica (verde/ámbar/rojo). */
  color?: string;
}

export function KpiCard({ titulo, valor, variacionPct, subtitulo, icon = Gauge, porcentaje, color }: Props) {
  return (
    <div className="glass-card flex items-center gap-4 rounded-3xl p-5">
      <DonutRing porcentaje={porcentaje} icon={icon} color={color ?? 'var(--primary)'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{titulo}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">{valor ?? '—'}</p>
        {subtitulo && <p className="truncate text-[11px] text-muted-foreground">{subtitulo}</p>}
        {variacionPct !== undefined && variacionPct !== null && (
          <div className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            variacionPct > 0 ? 'bg-chart-2/10 text-chart-2' : variacionPct < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
          }`}>
            {variacionPct > 0 ? <ArrowUp className="h-3 w-3" /> : variacionPct < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(variacionPct)}%
          </div>
        )}
      </div>
    </div>
  );
}
