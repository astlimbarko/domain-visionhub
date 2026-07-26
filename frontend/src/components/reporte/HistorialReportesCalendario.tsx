import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { useHistorialReportes } from '@/hooks/useReporte';
import { aISO, esHoy, finSemanaISO, grillaMesRecortada, inicioSemanaISO, nombreMes, nombresDias } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';

interface Props {
  casaDePazId: string | undefined;
}

function esFinDeSemana(indiceColumna: number) {
  return indiceColumna === 0 || indiceColumna === 6;
}

/**
 * Calendario minimalista: solo pinta dos cosas -- el dia real en que se
 * envio el reporte (punto lleno) y, si una semana ISO (lunes a domingo) ya
 * paso por completo sin reporte, un aviso en su domingo de cierre. El resto
 * de los dias queda neutro a proposito -- no hay "expectativa" de reporte
 * dia por dia, solo semana por semana (unq_reporte_cdp_semana). El "falta"
 * usa ambar (aviso), no rojo -- una sola semana suelta no es una emergencia.
 */
export function HistorialReportesCalendario({ casaDePazId }: Props) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());

  const celdas = useMemo(() => grillaMesRecortada(anio, mes), [anio, mes]);
  // La consulta sigue alineada a semanas ISO completas (aunque el grillado ya
  // no muestre los días de relleno): un domingo de cierre al borde del mes
  // puede pertenecer a una semana cuyo reporte se cargó del lado del mes
  // vecino, y esa semana necesita el dato igual para no marcarse "faltante" por error.
  const primerDiaMes = aISO(new Date(anio, mes, 1));
  const ultimoDiaMes = aISO(new Date(anio, mes + 1, 0));
  const desde = inicioSemanaISO(primerDiaMes);
  const hasta = finSemanaISO(ultimoDiaMes);
  const hoyISO = aISO(hoy);

  const { data: fechasReportadas = [], isLoading } = useHistorialReportes(casaDePazId, desde, hasta);

  const fechasReportadasSet = useMemo(() => new Set(fechasReportadas), [fechasReportadas]);
  const semanasConReporte = useMemo(
    () => new Set(fechasReportadas.map((f) => inicioSemanaISO(f))),
    [fechasReportadas]
  );

  function irMesAnterior() {
    const f = new Date(anio, mes - 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  function irMesSiguiente() {
    const f = new Date(anio, mes + 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  return (
    <div className="glass-card-elevated rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SeccionIconHeader
          icon={History}
          color="var(--chart-2)"
          titulo="Calendario"
          descripcion="Qué semanas mandó reporte esta Casa de Paz"
          size="sm"
        />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-32 text-center text-sm font-semibold tracking-tight capitalize">{nombreMes(anio, mes)}</span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-80 w-full rounded-2xl" />
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
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
                  return <div key={fechaISO} className="min-h-12 border-b border-r border-border/70 last:border-r-0 sm:min-h-16" />;
                }

                const hoyCelda = esHoy(fecha);
                const enviado = fechasReportadasSet.has(fechaISO);
                const esDomingo = fecha.getDay() === 0;
                const semanaVencida = finSemanaISO(fechaISO) < hoyISO;
                const faltante = esDomingo && semanaVencida && !semanasConReporte.has(inicioSemanaISO(fechaISO));

                return (
                  <div
                    key={fechaISO}
                    title={enviado ? 'Reporte enviado' : faltante ? 'Semana sin reporte' : undefined}
                    className={cn(
                      'group relative flex min-h-12 flex-col items-center justify-center gap-1 border-b border-r border-border/70 last:border-r-0 sm:min-h-16',
                      esFinDeSemana(columna) && 'bg-muted/20'
                    )}
                  >
                    {hoyCelda && <span className="absolute inset-x-0 top-0 h-[3px] rounded-full bg-primary" />}
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-transform group-hover:scale-105',
                        enviado && 'bg-[var(--chart-2)] text-white shadow-sm shadow-[var(--chart-2)]/40',
                        faltante && 'border-2 border-amber-500 text-amber-600 dark:text-amber-400',
                        !enviado && !faltante && hoyCelda && 'font-bold text-primary'
                      )}
                    >
                      {enviado ? <Check className="h-3.5 w-3.5" /> : faltante ? <X className="h-3.5 w-3.5" /> : fecha.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-2)]" />
              Reporte enviado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-500" />
              Semana sin reporte (marca el domingo de cierre)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
