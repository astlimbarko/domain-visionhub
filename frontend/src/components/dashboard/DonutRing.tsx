import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  /** 0–100. Cuando es null/undefined se dibuja solo el aro (sin arco de progreso). */
  porcentaje?: number | null;
  size?: number;
  strokeWidth?: number;
  /** Color del arco. Por defecto usa --primary. */
  color?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}

/**
 * Aro tipo "Activity ring" para KPIs. Solo rellena el arco cuando `porcentaje`
 * representa una proporción real (valor/máximo); si no hay una razón genuina
 * se muestra como marco decorativo con el ícono al centro, nunca con un
 * relleno inventado.
 */
export function DonutRing({ porcentaje, size = 64, strokeWidth = 7, color = 'var(--primary)', icon: Icon, children }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circunferencia = 2 * Math.PI * radius;
  const tienePorcentaje = porcentaje !== null && porcentaje !== undefined;
  const pct = tienePorcentaje ? Math.min(100, Math.max(0, porcentaje)) : 0;
  const offset = circunferencia * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {tienePorcentaje && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (Icon && <Icon className="h-[18px] w-[18px] text-muted-foreground" style={tienePorcentaje ? { color } : undefined} />)}
      </div>
    </div>
  );
}
