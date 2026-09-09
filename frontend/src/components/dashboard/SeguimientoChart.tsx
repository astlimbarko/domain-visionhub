import { HeartHandshake, PhoneCall, UserX } from 'lucide-react';
import { DonutRing } from './DonutRing';

interface Props {
  inactivos: number;
  reconciliados: number;
  simpatizantes: number;
  /** % sobre el total de referencia de cada categoría -- le da sentido al relleno del anillo (no son partes de un mismo 100%, cada uno es su propia proporción). */
  pctInactivos: number;
  pctReconciliados: number;
  pctSimpatizantes: number;
}

// Mismo trío que ya usa "Índice de fidelidad" en esta misma pantalla -- acá
// cada categoría es un estado real (no "serie 4"), por eso corresponde color
// de estado, no una paleta categórica.
const VERDE = 'var(--chart-2)';
const AMARILLO = '#f59e0b';
const ROJO = 'var(--destructive)';

/**
 * "A quiénes seguir de cerca" -- 3 anillos de estado con ícono propio (reusa
 * `DonutRing`) en vez de una barra horizontal más -- 2026-09-08, pedido del
 * owner: varios gráficos quedaban con la misma forma de barra. Cada anillo
 * se lee solo, sin tener que comparar largos entre sí.
 */
export function SeguimientoChart({ inactivos, reconciliados, simpatizantes, pctInactivos, pctReconciliados, pctSimpatizantes }: Props) {
  const datos = [
    { label: 'Inactivos', sub: 'Necesitan una visita', valor: inactivos, pct: pctInactivos, color: ROJO, icon: UserX },
    { label: 'Simpatizantes', sub: 'Necesitan una llamada', valor: simpatizantes, pct: pctSimpatizantes, color: AMARILLO, icon: PhoneCall },
    { label: 'Reconciliados', sub: 'Volvieron -- tendencia positiva', valor: reconciliados, pct: pctReconciliados, color: VERDE, icon: HeartHandshake },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {datos.map(({ label, sub, valor, pct, color, icon: Icon }) => (
        <div key={label} className="flex flex-col items-center gap-2 text-center">
          <DonutRing porcentaje={pct} size={80} strokeWidth={8} color={color} trackColor={`color-mix(in oklab, ${color} 12%, transparent)`}>
            <div className="flex flex-col items-center">
              <Icon className="h-4 w-4" style={{ color }} />
              <span className="text-lg font-bold text-foreground">{valor}</span>
            </div>
          </DonutRing>
          <div>
            <p className="text-[12.5px] font-semibold text-foreground">{label}</p>
            <p className="text-[10.5px] text-muted-foreground">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
