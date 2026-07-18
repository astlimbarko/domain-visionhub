import { cn } from '@/lib/utils';
import { aISO, esHoy, grillaMes, nombresDias } from '@/utils/calendario-fechas';
import type { Cumpleanos, Evento } from '@/types/calendario.types';

interface Props {
  anio: number;
  mes: number;
  eventos: Evento[];
  cumpleanos: Cumpleanos[];
  diaSeleccionado: string | null;
  onSeleccionarDia: (fechaISO: string) => void;
}

export function CalendarioGrid({ anio, mes, eventos, cumpleanos, diaSeleccionado, onSeleccionarDia }: Props) {
  const celdas = grillaMes(anio, mes);

  function eventosDelDia(fechaISO: string) {
    return eventos.filter((e) => {
      const fin = e.fecha_fin ?? e.fecha_inicio;
      return fechaISO >= e.fecha_inicio && fechaISO <= fin;
    });
  }

  function cumpleanosDelDia(fechaISO: string) {
    return cumpleanos.filter((c) => c.fecha_cumpleanos === fechaISO);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {nombresDias().map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map(({ fecha, delMes }) => {
          const fechaISO = aISO(fecha);
          const evs = eventosDelDia(fechaISO);
          const cums = cumpleanosDelDia(fechaISO);
          const seleccionado = diaSeleccionado === fechaISO;

          return (
            <button
              key={fechaISO}
              type="button"
              onClick={() => onSeleccionarDia(fechaISO)}
              className={cn(
                'flex min-h-16 flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left last:border-r-0 sm:min-h-24 sm:p-2',
                !delMes && 'bg-muted/30 text-muted-foreground/50',
                seleccionado && 'bg-accent'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  esHoy(fecha) && 'bg-primary font-semibold text-primary-foreground'
                )}
              >
                {fecha.getDate()}
              </span>
              <div className="flex flex-wrap gap-1">
                {evs.slice(0, 4).map((e) => (
                  <span
                    key={e.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: e.color }}
                    title={e.titulo}
                  />
                ))}
                {cums.length > 0 && <span className="text-xs" title="Cumpleaños">🎂</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
