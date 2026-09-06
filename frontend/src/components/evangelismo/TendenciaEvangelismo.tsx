import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { aISO, desdeISO, inicioSemanaISO, nombreMesCorto, nombresDias, numeroSemanaISO, sumarDiasISO } from '@/utils/calendario-fechas';

type Granularidad = 'dia' | 'semana' | 'mes';

const OPCIONES: { valor: Granularidad; etiqueta: string }[] = [
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'dia', etiqueta: 'Día' },
];

const COLOR = DEPARTAMENTO_META.EVANGELISMO.color;

interface Punto {
  clave: string;
  etiqueta: string;
  /** Segunda línea del tick del eje X -- mes (en semana) o día de semana (en día). Vacío en mes. */
  subEtiqueta: string;
  cantidad: number;
}

function armarBuckets(granularidad: Granularidad): { clave: string; etiqueta: string; subEtiqueta: string }[] {
  const hoy = aISO(new Date());

  if (granularidad === 'dia') {
    // Últimos 30 días -- pensado para eventos puntuales, no es la vista de rutina.
    return Array.from({ length: 30 }, (_, i) => {
      const clave = sumarDiasISO(hoy, -(29 - i));
      const fecha = desdeISO(clave);
      return { clave, etiqueta: String(fecha.getDate()), subEtiqueta: nombresDias()[fecha.getDay()] };
    });
  }

  if (granularidad === 'mes') {
    const base = desdeISO(hoy);
    return Array.from({ length: 12 }, (_, i) => {
      const offset = 11 - i;
      const d = new Date(base.getFullYear(), base.getMonth() - offset, 1);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { clave, etiqueta: nombreMesCorto(d.getMonth()), subEtiqueta: '' };
    });
  }

  // Semana (default): últimas 12 semanas ISO, lunes a domingo.
  const inicioActual = inicioSemanaISO(hoy);
  return Array.from({ length: 12 }, (_, i) => {
    const clave = sumarDiasISO(inicioActual, -(11 - i) * 7);
    const mesInicio = desdeISO(clave).getMonth();
    return { clave, etiqueta: `Sem ${numeroSemanaISO(clave)}`, subEtiqueta: nombreMesCorto(mesInicio) };
  });
}

function claveDeFecha(fecha: string, granularidad: Granularidad): string {
  if (granularidad === 'dia') return fecha;
  if (granularidad === 'mes') return fecha.slice(0, 7);
  return inicioSemanaISO(fecha);
}

function Tooltip2({ active, payload, granularidad }: { active?: boolean; payload?: { payload: Punto }[]; granularidad: Granularidad }) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0].payload;
  const titulo = granularidad === 'dia' ? `${punto.subEtiqueta} ${punto.etiqueta}` : granularidad === 'semana' ? `${punto.etiqueta} (${punto.subEtiqueta})` : punto.etiqueta;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-popover-foreground">{titulo}</p>
      <p className="mt-0.5 text-popover-foreground">{punto.cantidad} evangelizado{punto.cantidad === 1 ? '' : 's'}</p>
    </div>
  );
}

/** Tick de 2 líneas: la etiqueta principal (número de semana / día del mes /
 * nombre de mes) y, debajo, una segunda línea chica de contexto -- a qué mes
 * pertenece esa semana, o qué día de la semana es ese día. Sin esto, "Sem 36"
 * o "6" solos no dicen a qué mes/día caen (pedido explícito del owner). */
function TickEjeX({ x, y, payload, index, datos }: { x?: number; y?: number; payload?: { value: string }; index?: number; datos: Punto[] }) {
  if (x == null || y == null || !payload) return null;
  const punto = index != null ? datos[index] : undefined;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
        {payload.value}
      </text>
      {punto?.subEtiqueta && (
        <text dy={24} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" opacity={0.7}>
          {punto.subEtiqueta}
        </text>
      )}
    </g>
  );
}

/** Número visible en cada punto con actividad (se omite en 0 para no
 * ensuciar la línea con ceros repetidos). */
function EtiquetaValor({ x, y, value }: { x?: number; y?: number; value?: number }) {
  if (x == null || y == null || !value) return null;
  return (
    <text x={x} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={COLOR}>
      {value}
    </text>
  );
}

/**
 * Línea de tiempo de Evangelismo con 3 granularidades (KAN-285, pedido
 * explícito del owner 2026-09-06). Semana es la principal -- evangelismo no
 * es una actividad diaria de rutina, Día queda para eventos puntuales
 * (inauguraciones, campañas), no es la vista por defecto.
 *
 * `evangelizados` viene ya traído por el padre con un rango amplio (últimos
 * 12 meses hasta hoy) -- este componente solo agrupa y recorta en el cliente
 * según la granularidad elegida, no vuelve a pedir datos.
 */
export function TendenciaEvangelismo({ evangelizados, cargando }: { evangelizados: { fecha: string }[]; cargando?: boolean }) {
  const [granularidad, setGranularidad] = useState<Granularidad>('semana');

  const datos = useMemo<Punto[]>(() => {
    const buckets = armarBuckets(granularidad);
    const conteo = new Map<string, number>();
    for (const e of evangelizados) {
      const clave = claveDeFecha(e.fecha, granularidad);
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }
    return buckets.map((b) => ({ ...b, cantidad: conteo.get(b.clave) ?? 0 }));
  }, [evangelizados, granularidad]);

  const intervalo = granularidad === 'dia' ? 2 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 self-start rounded-xl bg-muted/50 p-1">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => setGranularidad(o.valor)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              granularidad === o.valor ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="h-56 w-full animate-pulse rounded-2xl bg-muted/40" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 20, right: 8, left: -20, bottom: 4 }}>
              <defs>
                <linearGradient id="tendenciaEvangelismoArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={COLOR} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="etiqueta" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} interval={intervalo} height={36} tick={<TickEjeX datos={datos} />} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
              <Tooltip content={<Tooltip2 granularidad={granularidad} />} cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }} />
              <Area
                type="monotone"
                dataKey="cantidad"
                name="Evangelizados"
                stroke={COLOR}
                strokeWidth={2.5}
                fill="url(#tendenciaEvangelismoArea)"
                dot={{ r: 3, fill: COLOR, stroke: 'var(--background)', strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              >
                <LabelList dataKey="cantidad" content={<EtiquetaValor />} />
              </Area>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
