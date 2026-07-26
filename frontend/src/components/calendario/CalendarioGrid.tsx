import { Cake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aISO, esHoy, grillaMesRecortada, nombresDias } from '@/utils/calendario-fechas';
import { iconoTipoEvento } from '@/utils/tipo-evento-icono';
import type { Cumpleanos, Evento } from '@/types/calendario.types';

interface Props {
  anio: number;
  mes: number;
  eventos: Evento[];
  cumpleanos: Cumpleanos[];
  diaSeleccionado: string | null;
  onSeleccionarDia: (fechaISO: string) => void;
}

const MAX_CHIPS = 3;

function esFinDeSemana(indiceColumna: number) {
  // grillaMes arranca en domingo (columna 0); domingo y sábado (6) son fin de semana.
  return indiceColumna === 0 || indiceColumna === 6;
}

export function CalendarioGrid({ anio, mes, eventos, cumpleanos, diaSeleccionado, onSeleccionarDia }: Props) {
  const celdas = grillaMesRecortada(anio, mes);

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
    <div className="glass-card overflow-hidden rounded-2xl">
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

          // Celda de relleno (día del mes vecino): queda en blanco, sin numero ni eventos.
          if (!delMes) {
            return <div key={fechaISO} className="min-h-14 border-b border-r border-border/70 last:border-r-0 sm:min-h-24" />;
          }

          const evs = eventosDelDia(fechaISO);
          const cums = cumpleanosDelDia(fechaISO);
          const seleccionado = diaSeleccionado === fechaISO;
          const hoy = esHoy(fecha);

          const hayCumples = cums.length > 0;
          const espacioEventos = MAX_CHIPS - (hayCumples ? 1 : 0);
          const evsVisibles = evs.slice(0, espacioEventos);
          const overflow = evs.length - evsVisibles.length;

          return (
            <button
              key={fechaISO}
              type="button"
              onClick={() => onSeleccionarDia(fechaISO)}
              className={cn(
                'group relative flex min-h-14 flex-col items-start gap-1.5 border-b border-r border-border/70 p-1.5 text-left transition-colors last:border-r-0 sm:min-h-24 sm:p-2.5',
                esFinDeSemana(columna) && 'bg-muted/25',
                !seleccionado && 'hover:bg-accent/60',
                seleccionado && 'bg-accent ring-1 ring-inset ring-primary/50'
              )}
            >
              {hoy && <span className="absolute inset-x-0 top-0 h-[3px] rounded-full bg-primary" />}
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] transition-transform',
                  hoy
                    ? 'bg-primary font-bold text-primary-foreground shadow-sm shadow-primary/30'
                    : 'font-medium group-hover:scale-105'
                )}
              >
                {fecha.getDate()}
              </span>

              {/* Detalle completo: chips con ícono + título, visible desde sm hacia arriba */}
              <div className="hidden w-full min-w-0 flex-col gap-1 sm:flex">
                {hayCumples && (
                  <span
                    className="flex items-center gap-1.5 truncate rounded-md border-l-[3px] py-0.5 pr-1.5 pl-1.5 text-[10.5px] font-bold"
                    style={{
                      borderColor: 'var(--chart-4)',
                      backgroundColor: 'color-mix(in oklab, var(--chart-4) 20%, transparent)',
                      color: 'var(--chart-4)',
                    }}
                    title={cums.map((c) => `${c.nombre} cumple ${c.edad_cumple} años`).join(', ')}
                  >
                    <Cake className="h-3 w-3 shrink-0" />
                    <span className="truncate">{cums.length === 1 ? cums[0].nombre : `${cums.length} cumpleaños`}</span>
                  </span>
                )}
                {evsVisibles.map((e) => {
                  const Icono = iconoTipoEvento(e.tipo_codigo);
                  return (
                    <span
                      key={e.id}
                      className="flex items-center gap-1.5 truncate rounded-md border-l-[3px] py-0.5 pr-1.5 pl-1.5 text-[10.5px] font-bold"
                      style={{
                        borderColor: e.color,
                        backgroundColor: `color-mix(in oklab, ${e.color} 20%, transparent)`,
                        color: e.color,
                      }}
                      title={`${e.titulo} (${e.tipo_nombre})${e.hora_inicio ? ` · ${e.hora_inicio.slice(0, 5)}` : ''}`}
                    >
                      <Icono className="h-3 w-3 shrink-0" />
                      <span className="truncate">{e.titulo}</span>
                    </span>
                  );
                })}
                {overflow > 0 && <span className="px-1.5 text-[10.5px] font-medium text-muted-foreground">+{overflow} más</span>}
              </div>

              {/* Compacto: puntitos de color, solo en mobile */}
              <div className="flex flex-wrap items-center gap-1 sm:hidden">
                {evs.slice(0, 4).map((e) => (
                  <span key={e.id} className="h-2 w-2 rounded-full ring-1 ring-black/5" style={{ backgroundColor: e.color }} title={e.titulo} />
                ))}
                {hayCumples && <Cake className="h-3.5 w-3.5" style={{ color: 'var(--chart-4)' }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
