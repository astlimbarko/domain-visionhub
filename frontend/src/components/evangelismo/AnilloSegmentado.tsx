import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export interface SegmentoAnillo {
  id: string;
  etiqueta: string;
  cantidad: number;
}

// Gris neutro para "sin evangelizados" -- ni la Red/CdP ni el anillo entero
// (cuando no hay ningún dato) deben inventar un color con significado.
const COLOR_SIN_DATOS = '#D1D5DB';

interface Props {
  datos: SegmentoAnillo[];
  colores: string[];
  centroLabel?: string;
  tamano?: number;
  onSeleccionar?: (id: string) => void;
}

/**
 * Anillo (donut) genérico con centro vacío + leyenda al lado -- un color fijo
 * por entrada de `datos` (mismo índice en el anillo y en la leyenda, incluso
 * si esa entrada tiene 0 y no se dibuja como sector). Si el total es 0, se
 * dibuja un anillo gris completo en vez de inventar proporciones.
 */
export function AnilloSegmentado({ datos, colores, centroLabel = 'evangelizados', tamano = 176, onSeleccionar }: Props) {
  const conColor = datos.map((d, i) => ({ ...d, color: colores[i % colores.length] }));
  const total = conColor.reduce((s, d) => s + d.cantidad, 0);
  const sinDatos = total === 0;
  const segmentosVisibles = sinDatos ? [{ id: '__vacio__', etiqueta: 'Sin evangelizados', cantidad: 1, color: COLOR_SIN_DATOS }] : conColor.filter((d) => d.cantidad > 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segmentosVisibles}
              dataKey="cantidad"
              nameKey="etiqueta"
              innerRadius={tamano * 0.32}
              outerRadius={tamano * 0.48}
              paddingAngle={sinDatos ? 0 : 3}
              stroke="none"
              isAnimationActive={false}
            >
              {segmentosVisibles.map((s) => (
                <Cell
                  key={s.id}
                  fill={s.color}
                  className={onSeleccionar && !sinDatos ? 'cursor-pointer' : undefined}
                  onClick={onSeleccionar && !sinDatos ? () => onSeleccionar(s.id) : undefined}
                />
              ))}
            </Pie>
            {!sinDatos && (
              <Tooltip
                formatter={(value, name) => [`${value} evangelizado${value === 1 ? '' : 's'}`, name]}
                contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-[10px] text-muted-foreground">{centroLabel}</p>
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col gap-1">
        {sinDatos ? (
          <p className="text-sm text-muted-foreground">Sin evangelizados en este período.</p>
        ) : (
          conColor.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => d.cantidad > 0 && onSeleccionar?.(d.id)}
              disabled={!onSeleccionar || d.cantidad === 0}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors',
                onSeleccionar && d.cantidad > 0 ? 'hover:bg-muted/50' : 'cursor-default'
              )}
            >
              <span className={cn('flex items-center gap-2', d.cantidad === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.cantidad === 0 ? COLOR_SIN_DATOS : d.color }} />
                {d.etiqueta}
              </span>
              <span className={cn('shrink-0 font-semibold', d.cantidad === 0 ? 'text-muted-foreground' : 'text-foreground')}>{d.cantidad}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
