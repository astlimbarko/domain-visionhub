import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  pctBautizados: number;
  pctConMinisterio: number;
  pctMembresiaFormal: number;
  pctDiscipuladoActivo: number;
}

/** Una sola serie (identidad nominal: swapear el orden de las 4 categorías no
 * cambia el significado), así que las 4 barras van del mismo color -- sin
 * leyenda, el título de la sección ya dice qué se mide. */
const COLOR = 'var(--chart-1)';

/**
 * KPIs "de compromiso" (2026-09-08, pedido del owner: gráfico, no más cards)
 * como % del total de tu gente -- mismo denominador en las 4 barras para que
 * sean directamente comparables entre sí.
 */
export function CompromisoPersonasChart({ pctBautizados, pctConMinisterio, pctMembresiaFormal, pctDiscipuladoActivo }: Props) {
  const datos = [
    { name: 'Bautizados', value: pctBautizados },
    { name: 'Con ministerio', value: pctConMinisterio },
    { name: 'Membresía formal', value: pctMembresiaFormal },
    { name: 'Discipulado activo', value: pctDiscipuladoActivo },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={112} />
          <Tooltip
            formatter={(value) => [`${value}%`, 'del total de tu gente']}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22} fill={COLOR}>
            <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
