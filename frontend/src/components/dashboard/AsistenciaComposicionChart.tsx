import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  miembros: number;
  asistenciaPromedio: number;
  ninos: number;
}

/** Comparativa rápida: miembros activos, promedio de asistencia y niños, con el valor exacto sobre cada barra. */
export function AsistenciaComposicionChart({ miembros, asistenciaPromedio, ninos }: Props) {
  const datos = [
    { name: 'Miembros', value: miembros },
    { name: 'Asistencia prom.', value: asistenciaPromedio },
    { name: 'Niños', value: ninos },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
          />
          <Bar dataKey="value" fill="#5fa584" radius={[8, 8, 0, 0]}>
            <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
