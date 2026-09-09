import { Bar, BarChart, Cell, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface PuntoTestimonios {
  mes: string;
  cantidad: number;
}

interface Props {
  datos: PuntoTestimonios[];
}

const COLOR = '#ff2d55';

/**
 * Testimonios por mes -- columnas con el mes pico resaltado en color pleno y
 * el resto en un tinte más claro (2026-09-08, pedido del owner: no repetir
 * la forma de área/línea que ya usa "Tendencia de asistencia" en Indicadores;
 * acá el foco es "¿cuál fue el mejor mes?", no la curva completa).
 */
export function TestimoniosTendenciaChart({ datos }: Props) {
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no se registró ningún testimonio en los últimos 6 meses.</p>;
  }
  const max = Math.max(...datos.map((d) => d.cantidad));

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} testimonio${value === 1 ? '' : 's'}`, undefined]}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
            cursor={{ fill: 'color-mix(in oklab, var(--foreground) 6%, transparent)' }}
          />
          <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={36}>
            <LabelList dataKey="cantidad" position="top" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--foreground)' }} />
            {datos.map((d, i) => (
              <Cell key={i} fill={d.cantidad === max && max > 0 ? COLOR : `color-mix(in oklab, ${COLOR} 35%, white)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
