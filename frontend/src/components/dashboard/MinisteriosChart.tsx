import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface MinisterioConteo {
  nombre: string;
  cantidad: number;
}

interface Props {
  ministerios: MinisterioConteo[];
}

/** Una sola serie (identidad nominal: el orden de los ministerios no cambia su significado) -- mismo hue en todas las barras. */
const COLOR = 'var(--chart-2)';

/** Top ministerios con más gente participando (2026-09-08, pedido del owner: gráfico nuevo, exclusivo de la pestaña Personas). */
export function MinisteriosChart({ ministerios }: Props) {
  if (ministerios.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía nadie de tu Casa de Paz participa en un ministerio.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ministerios} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="nombre" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={120} />
          <Tooltip
            formatter={(value) => [`${value} persona${value === 1 ? '' : 's'}`, undefined]}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
          />
          <Bar dataKey="cantidad" radius={[0, 6, 6, 0]} maxBarSize={22} fill={COLOR}>
            <LabelList dataKey="cantidad" position="right" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
