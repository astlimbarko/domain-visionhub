import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  hombres: number;
  mujeres: number;
}

// Identidad de 2 categorías nominales -- cada una su propio hue fijo (no un
// solo color ni un ramp, acá "sexo" sí es identidad, no magnitud/orden).
const AZUL = 'var(--chart-1)';
const ROSA = '#ff2d55';

/** Composición por sexo del roster de la CdP (2026-09-08, pedido del owner: gráfico nuevo, exclusivo de la pestaña Personas). */
export function ComposicionSexoChart({ hombres, mujeres }: Props) {
  const total = hombres + mujeres;
  const datos = [
    { name: 'Hombres', value: hombres, fill: AZUL },
    { name: 'Mujeres', value: mujeres, fill: ROSA },
  ];

  if (total === 0) return <p className="text-sm text-muted-foreground">Sin personas todavía.</p>;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3} stroke="none">
              {datos.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} persona${value === 1 ? '' : 's'}`, name]}
              contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-foreground">{total}</p>
          <p className="text-[10px] text-muted-foreground">personas</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {datos.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
              {d.name}
            </span>
            <span className="font-semibold text-foreground">
              {d.value} <span className="font-normal text-muted-foreground">({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
