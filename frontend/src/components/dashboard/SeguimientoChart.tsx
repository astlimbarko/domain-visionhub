import { Bar, BarChart, Cell, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  inactivos: number;
  reconciliados: number;
  simpatizantes: number;
}

// Mismo trío que ya usa "Índice de fidelidad" (IndiceFidelidadRing.tsx) en
// esta misma pantalla -- acá cada barra es un estado real (no "series 4"),
// así que corresponde color de estado, no una paleta categórica.
const VERDE = 'var(--chart-2)';
const AMARILLO = '#f59e0b';
const ROJO = 'var(--destructive)';

/**
 * KPIs "de seguimiento" (2026-09-08, pedido del owner: gráfico, no más
 * cards) -- 3 categorías que representan estados distintos (necesita
 * atención / necesita una llamada / tendencia positiva), por eso llevan
 * color de estado en vez de un solo hue.
 */
export function SeguimientoChart({ inactivos, reconciliados, simpatizantes }: Props) {
  const datos = [
    { name: 'Inactivos', value: inactivos, fill: ROJO },
    { name: 'Simpatizantes en seguimiento', value: simpatizantes, fill: AMARILLO },
    { name: 'Reconciliados', value: reconciliados, fill: VERDE },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={150} />
            <Tooltip
              formatter={(value) => [`${value} persona${value === 1 ? '' : 's'}`, '']}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--popover-foreground)',
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
              <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
              {datos.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Rojo = necesitan una visita urgente · Amarillo = necesitan una llamada · Verde = tendencia positiva
      </p>
    </div>
  );
}
