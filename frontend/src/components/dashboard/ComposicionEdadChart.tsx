import { Bar, BarChart, Cell, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface RangoEtario {
  etiqueta: string;
  cantidad: number;
}

interface Props {
  rangos: RangoEtario[];
}

/** Un solo hue en rampa (más oscuro = más edad) -- son buckets ORDINALES (niños → mayores), no identidad nominal. */
function colorPorIndice(i: number, total: number) {
  const pct = total <= 1 ? 0 : i / (total - 1);
  return `color-mix(in oklab, var(--chart-1) ${Math.round(40 + pct * 55)}%, white)`;
}

/** Composición por edad del roster de la CdP (2026-09-08, pedido del owner: gráfico nuevo, exclusivo de la pestaña Personas). */
export function ComposicionEdadChart({ rangos }: Props) {
  const datos = rangos.map((r, i) => ({ ...r, fill: colorPorIndice(i, rangos.length) }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="etiqueta" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} persona${value === 1 ? '' : 's'}`, undefined]}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
          />
          <Bar dataKey="cantidad" radius={[8, 8, 0, 0]} maxBarSize={44}>
            <LabelList dataKey="cantidad" position="top" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
            {datos.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
