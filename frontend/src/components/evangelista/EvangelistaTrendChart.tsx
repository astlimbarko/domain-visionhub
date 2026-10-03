import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EVANGELISTA_COLOR } from '@/utils/evangelista-colores';

interface Props {
  serieDiaria: { dia: number; cantidad: number }[];
}

function TooltipDia({ active, payload }: { active?: boolean; payload?: { payload: { dia: number; cantidad: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-popover-foreground">Día {punto.dia}</p>
      <p className="text-muted-foreground">{punto.cantidad} {punto.cantidad === 1 ? 'persona' : 'personas'}</p>
    </div>
  );
}

/** Gráfico "Personas evangelizadas" del dashboard (KAN-429, boceto
 * `evangelismo1.jpeg`): eje diario unitario, scroll horizontal táctil si no
 * entran todos los días del mes (mismo criterio de ancho mínimo por punto
 * que ya usa el calendario). Datos ya agregados por día desde el backend
 * (`fn_evangelista_dashboard`), no se recalculan acá. */
export function EvangelistaTrendChart({ serieDiaria }: Props) {
  const anchoMinimo = Math.max(serieDiaria.length * 34, 320);

  return (
    <div className="h-52 w-full overflow-x-auto">
      <div className="h-full" style={{ minWidth: anchoMinimo }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serieDiaria} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="evangelistaArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EVANGELISTA_COLOR.NARANJA} stopOpacity={0.35} />
                <stop offset="100%" stopColor={EVANGELISTA_COLOR.NARANJA} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
            <Tooltip content={<TooltipDia />} cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="cantidad"
              stroke={EVANGELISTA_COLOR.NARANJA}
              strokeWidth={2.5}
              fill="url(#evangelistaArea)"
              dot={{ r: 3, fill: EVANGELISTA_COLOR.NARANJA, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
