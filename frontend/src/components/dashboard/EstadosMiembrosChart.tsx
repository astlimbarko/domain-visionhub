import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { MiembroCdpDashboard } from '@/types/dashboard.types';

interface Props {
  miembros: MiembroCdpDashboard[];
}

// Mismo orden de colores que usaba el prototipo para Estados SSVA: azul, morado, rosa, naranja, verde.
const COLORES = ['var(--chart-1)', 'var(--chart-4)', '#ec4899', 'var(--chart-3)', 'var(--chart-2)'];

/** Distribución de miembros por estado espiritual (SSVA), con nombre completo y porcentaje descritos en la misma card. */
export function EstadosMiembrosChart({ miembros }: Props) {
  const conteos = new Map<string, number>();
  for (const m of miembros) {
    const clave = m.estado_nombre ?? 'Sin estado';
    conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
  }
  const total = miembros.length;
  const datos = Array.from(conteos.entries())
    .map(([estado, cantidad]) => ({ estado, cantidad, pct: total > 0 ? Math.round((cantidad / total) * 100) : 0 }))
    .sort((a, b) => b.cantidad - a.cantidad);

  if (datos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin miembros todavía.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} dataKey="cantidad" nameKey="estado" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="none">
              {datos.map((_, i) => (
                <Cell key={i} fill={COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} miembros`, name]}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--popover-foreground)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-[10px] text-muted-foreground">miembros</p>
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col gap-2">
        {datos.map((d, i) => (
          <div key={d.estado} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORES[i % COLORES.length] }} />
              {d.estado}
            </span>
            <span className="shrink-0 text-muted-foreground">
              <span className="font-semibold text-foreground">{d.cantidad}</span> · {d.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
