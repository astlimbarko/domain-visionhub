import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Evangelizado } from '@/types/evangelismo.types';

interface Props {
  anio: number;
  mes: number;
  evangelizados: Evangelizado[];
}

interface PuntoDia {
  dia: number;
  cantidad: number;
  acumulado: number;
  nombres: string[];
}

function DotDia({ cx, cy, payload }: { cx?: number; cy?: number; payload?: PuntoDia }) {
  if (cx == null || cy == null || !payload || payload.cantidad === 0) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill="var(--chart-3)" stroke="var(--background)" strokeWidth={1.5} />;
}

function TooltipDia({ active, payload }: { active?: boolean; payload?: { payload: PuntoDia }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0].payload;
  return (
    <div className="max-w-52 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-popover-foreground">Día {punto.dia}</p>
      {punto.cantidad === 0 ? (
        <p className="mt-0.5 text-muted-foreground">Sin evangelizados</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-0.5">
          {punto.nombres.map((n, i) => (
            <li key={i} className="truncate text-popover-foreground">
              {n}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 border-t border-border/60 pt-1 text-[11px] text-muted-foreground">Acumulado del mes: {punto.acumulado}</p>
    </div>
  );
}

/**
 * Línea de tiempo día por día de todo el mes (no solo los días con datos):
 * el área marca la cantidad de ese día y la línea punteada el acumulado, con
 * tooltip que lista los nombres. Se oculta si no hubo nadie en el mes.
 */
export function EvangelismoTrendChart({ anio, mes, evangelizados }: Props) {
  if (evangelizados.length === 0) return null;

  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const nombresPorFecha = new Map<string, string[]>();
  for (const e of evangelizados) {
    const lista = nombresPorFecha.get(e.fecha) ?? [];
    lista.push(e.nombre_completo);
    nombresPorFecha.set(e.fecha, lista);
  }

  let acumulado = 0;
  const datos: PuntoDia[] = Array.from({ length: ultimoDia }, (_, i) => {
    const dia = i + 1;
    const fecha = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const nombres = nombresPorFecha.get(fecha) ?? [];
    acumulado += nombres.length;
    return { dia, cantidad: nombres.length, acumulado, nombres };
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="evangelismoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="dia"
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval={ultimoDia > 20 ? 2 : ultimoDia > 10 ? 1 : 0}
          />
          <YAxis yAxisId="dia" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
          <YAxis yAxisId="acumulado" orientation="right" hide allowDecimals={false} />
          <Tooltip content={<TooltipDia />} cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }} />
          <Area
            yAxisId="dia"
            type="monotone"
            dataKey="cantidad"
            name="Ese día"
            stroke="var(--chart-3)"
            strokeWidth={2}
            fill="url(#evangelismoArea)"
            dot={<DotDia />}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="acumulado"
            type="monotone"
            dataKey="acumulado"
            name="Acumulado"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
