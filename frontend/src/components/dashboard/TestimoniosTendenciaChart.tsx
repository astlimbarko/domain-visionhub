import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface PuntoTestimonios {
  mes: string;
  cantidad: number;
}

interface Props {
  datos: PuntoTestimonios[];
}

const COLOR = '#ff2d55';

/** Tendencia de testimonios por mes, últimos 6 meses (2026-09-08, pedido del owner: gráfico nuevo, exclusivo de la pestaña Seguimiento). */
export function TestimoniosTendenciaChart({ datos }: Props) {
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no se registró ningún testimonio en los últimos 6 meses.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} testimonio${value === 1 ? '' : 's'}`, undefined]}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
          />
          <Line type="monotone" dataKey="cantidad" stroke={COLOR} strokeWidth={2} dot={{ r: 4, fill: COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
