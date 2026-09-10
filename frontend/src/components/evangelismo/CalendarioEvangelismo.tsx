import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { aISO, esHoy, grillaMesRecortada, nombresDias } from '@/utils/calendario-fechas';

// Verde suave para "hubo actividad" -- distinto del azul de "día
// seleccionado" (rediseño 2026-09-09, ver frontend-style: azul es para
// calendario/estados seleccionados, verde para progreso/actividad positiva).
const VERDE_ACTIVIDAD = 'var(--chart-2)';

interface Props {
  anio: number;
  mes: number;
  // Solo se lee `.fecha` -- estructural a propósito, así lo puede reusar
  // tanto Evangelismo.tsx (Evangelizado[], por CdP) como EvangelismoRed.tsx
  // (EvangelizadoRed[], agregado de toda la Red).
  evangelizados: { fecha: string }[];
  diaSeleccionado: string | null;
  onSeleccionarDia: (fechaISO: string) => void;
}

function esFinDeSemana(indiceColumna: number) {
  return indiceColumna === 0 || indiceColumna === 6;
}

/** Calendario del mes: marca los días en los que se registró al menos un evangelizado. */
export function CalendarioEvangelismo({ anio, mes, evangelizados, diaSeleccionado, onSeleccionarDia }: Props) {
  const celdas = grillaMesRecortada(anio, mes);

  // Un solo recorrido de la lista para armar el conteo por día -- antes cada
  // celda volvía a filtrar el array completo de evangelizados (O(celdas × N)
  // en cada render), acá se arma una vez y las celdas solo hacen un lookup.
  const { conteoPorDia, maxPorDia } = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const e of evangelizados) conteo.set(e.fecha, (conteo.get(e.fecha) ?? 0) + 1);
    return { conteoPorDia: conteo, maxPorDia: Math.max(1, ...conteo.values()) };
  }, [evangelizados]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="grid grid-cols-7 border-b border-border/70 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {nombresDias().map((d, i) => (
          <div key={d} className={cn('py-2.5', esFinDeSemana(i) && 'text-muted-foreground/60')}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map(({ fecha, delMes }, idx) => {
          const fechaISO = aISO(fecha);
          const columna = idx % 7;

          // Celda de relleno (día del mes vecino): queda en blanco, sin numero ni marca.
          if (!delMes) {
            return <div key={fechaISO} className="min-h-16 border-b border-r border-border/70 last:border-r-0 sm:min-h-24" />;
          }

          const cantidad = conteoPorDia.get(fechaISO) ?? 0;
          const hayActividad = cantidad > 0;
          const seleccionado = diaSeleccionado === fechaISO;
          const hoy = esHoy(fecha);
          const intensidad = Math.min(1, cantidad / maxPorDia);

          return (
            <button
              key={fechaISO}
              type="button"
              onClick={() => onSeleccionarDia(fechaISO)}
              className={cn(
                'group relative flex min-h-16 flex-col items-center justify-start gap-1.5 border-b border-r border-border/70 p-1.5 text-left transition-colors duration-150 last:border-r-0 sm:min-h-24 sm:p-2.5',
                esFinDeSemana(columna) && 'bg-muted/20',
                !seleccionado && 'hover:bg-accent/60'
              )}
              style={
                seleccionado
                  ? { backgroundColor: `color-mix(in oklab, ${AZUL} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${AZUL} 35%, transparent)` }
                  : hayActividad
                    ? { backgroundColor: `color-mix(in oklab, ${VERDE_ACTIVIDAD} ${8 + intensidad * 10}%, transparent)` }
                    : undefined
              }
            >
              {hoy && <span className="absolute inset-x-0 top-0 h-[3px] rounded-full bg-primary" />}
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] transition-transform',
                  hoy ? 'bg-primary font-bold text-primary-foreground shadow-sm shadow-primary/30' : 'font-medium text-foreground group-hover:scale-105'
                )}
              >
                {fecha.getDate()}
              </span>
              {/* Indicador sutil de actividad -- un puntito para 1, una píldora
                  chica con el número recién a partir de 2 (evita un badge
                  pesado en la mayoría de los días con actividad). */}
              {hayActividad &&
                (cantidad === 1 ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: VERDE_ACTIVIDAD }} />
                ) : (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
                    style={{ backgroundColor: VERDE_ACTIVIDAD }}
                  >
                    {cantidad}
                  </span>
                ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
