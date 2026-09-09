import { Bar, BarChart, Cell, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface RangoInactividad {
  etiqueta: string;
  cantidad: number;
}

interface Props {
  rangos: RangoInactividad[];
}

/** Un solo hue en rampa (más oscuro = más semanas sin venir) -- son buckets ORDINALES de severidad, mismo criterio que un rango etario. */
function colorPorIndice(i: number, total: number) {
  const pct = total <= 1 ? 0 : i / (total - 1);
  return `color-mix(in oklab, var(--destructive) ${Math.round(45 + pct * 50)}%, white)`;
}

/**
 * Hace cuánto que los inactivos no vienen (2026-09-08, pedido del owner:
 * gráfico nuevo, exclusivo de la pestaña Seguimiento) -- distinto de "A
 * quiénes seguir de cerca" (esa es un conteo por categoría; esta es la
 * severidad DENTRO de la categoría "Inactivos").
 */
export function AntiguedadInactividadChart({ rangos }: Props) {
  const datos = rangos.map((r, i) => ({ ...r, fill: colorPorIndice(i, rangos.length) }));
  const total = rangos.reduce((acc, r) => acc + r.cantidad, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Nadie superó el umbral de inactividad -- buena señal.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="etiqueta" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={90} />
          <Tooltip
            formatter={(value) => [`${value} persona${value === 1 ? '' : 's'}`, undefined]}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
          />
          <Bar dataKey="cantidad" radius={[0, 6, 6, 0]} maxBarSize={22}>
            <LabelList dataKey="cantidad" position="right" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
            {datos.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
