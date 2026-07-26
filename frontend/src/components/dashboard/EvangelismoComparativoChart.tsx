import { Bar, BarChart, Cell, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  evangelizados: number;
  meta: number | null;
}

/**
 * Evangelizados del mes vs. meta (si hay una definida). El prototipo mostraba
 * "Contactos"/"Conversiones" pero esos conceptos no existen en el modelo de
 * datos actual (solo se registra evangelismo, sin distinguir contacto vs.
 * conversión) — se compara contra la meta real en su lugar.
 */
export function EvangelismoComparativoChart({ evangelizados, meta }: Props) {
  const datos = [
    { name: 'Evangelizados', value: evangelizados, fill: 'var(--chart-3)' },
    ...(meta !== null ? [{ name: 'Meta', value: meta, fill: '#06b6d4' }] : []),
  ];
  const pctMeta = meta !== null && meta > 0 ? Math.round((evangelizados / meta) * 100) : null;

  return (
    <div className="flex flex-col gap-2">
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
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} />
              {datos.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        {pctMeta !== null
          ? `${pctMeta}% de la meta alcanzado${pctMeta >= 100 ? ' — ¡meta superada!' : ''}`
          : 'Todavía no definiste una meta de evangelismo para este período.'}
      </p>
    </div>
  );
}
