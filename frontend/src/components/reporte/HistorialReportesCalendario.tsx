import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, History, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { useHistorialReportes } from '@/hooks/useReporte';
import { aISO, fechaLegible, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';

interface Props {
  casaDePazId: string | undefined;
}

const NOMBRES_MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Numero de dia (1-31) a partir de una fecha ISO, para el rotulo compacto de cada celda. */
const diaDelMes = (iso: string) => Number(iso.slice(8, 10));

/**
 * Todas las semanas (lunes a domingo) del año, con criterio ISO 8601: la
 * semana 1 es la que contiene el 4 de enero, y cada semana pertenece al año
 * que contiene su jueves. Esto da 52 o 53 semanas según el año (nunca un
 * número fijo adivinado) y garantiza que TODOS los días del año, incluido el
 * 31 de diciembre, caigan en exactamente una semana -- antes el ciclo se
 * cortaba a las 52 iteraciones desde el lunes de la semana de enero, lo que
 * dejaba afuera los últimos días de diciembre y, en años donde esa semana
 * arrancaba en diciembre del año anterior, mostraba una fila "Dic" con
 * fechas que en realidad eran del año pasado.
 */
function semanasDelAnio(anio: number): { inicio: string; fin: string }[] {
  const semanas: { inicio: string; fin: string }[] = [];
  let cursor = inicioSemanaISO(aISO(new Date(anio, 0, 4)));
  for (;;) {
    const fin = finSemanaISO(cursor);
    const jueves = new Date(`${cursor}T00:00:00`);
    jueves.setDate(jueves.getDate() + 3);
    if (jueves.getFullYear() !== anio) break;
    semanas.push({ inicio: cursor, fin });
    const siguiente = new Date(`${cursor}T00:00:00`);
    siguiente.setDate(siguiente.getDate() + 7);
    cursor = aISO(siguiente);
  }
  return semanas;
}

/** Mes (0-11) con más días dentro del rango de la semana, para etiquetar cada fila con el mes real. */
function mesPredominante(inicioISO: string, finISO: string): number {
  const conteo = new Array(12).fill(0);
  const cursor = new Date(`${inicioISO}T00:00:00`);
  const fin = new Date(`${finISO}T00:00:00`);
  while (cursor <= fin) {
    conteo[cursor.getMonth()]++;
    cursor.setDate(cursor.getDate() + 1);
  }
  let mejor = 0;
  for (let m = 1; m < 12; m++) if (conteo[m] > conteo[mejor]) mejor = m;
  return mejor;
}

/** Agrupa las semanas del año por el mes predominante de cada una, para renderizarlas como filas de un calendario anual. */
function semanasDelAnioPorMes(anio: number) {
  const grupos: { mes: number; semanas: { inicio: string; fin: string }[] }[] = [];
  for (const s of semanasDelAnio(anio)) {
    const mes = mesPredominante(s.inicio, s.fin);
    const ultimoGrupo = grupos[grupos.length - 1];
    if (ultimoGrupo && ultimoGrupo.mes === mes) {
      ultimoGrupo.semanas.push(s);
    } else {
      grupos.push({ mes, semanas: [s] });
    }
  }
  return grupos;
}

/**
 * Calendario anual compacto: una fila por mes, una celda por semana (52 en
 * total), con el rango de dias de cada semana rotulado directamente en la
 * celda -- no solo en el tooltip -- para que se lea sin pasar el mouse.
 * Verde = se envió el reporte esa semana; ámbar punteado = la semana ya
 * cerró sin reporte (no rojo -- una semana suelta no es una emergencia);
 * neutro punteado = semana actual o futura, todavía no corresponde.
 */
export function HistorialReportesCalendario({ casaDePazId }: Props) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const hoyISO = aISO(hoy);

  const grupos = useMemo(() => semanasDelAnioPorMes(anio), [anio]);
  const desde = grupos[0].semanas[0].inicio;
  const hasta = grupos[grupos.length - 1].semanas.at(-1)!.fin;

  const { data: fechasReportadas = [], isLoading } = useHistorialReportes(casaDePazId, desde, hasta);

  const semanasConReporte = useMemo(() => new Set(fechasReportadas.map((f) => inicioSemanaISO(f))), [fechasReportadas]);

  const { enviadas, vencidas, rachaActual } = useMemo(() => {
    const semanasVencidas = grupos.flatMap((g) => g.semanas).filter((s) => s.fin < hoyISO);
    const enviadas = semanasVencidas.filter((s) => semanasConReporte.has(s.inicio)).length;

    let racha = 0;
    for (let i = semanasVencidas.length - 1; i >= 0; i--) {
      if (!semanasConReporte.has(semanasVencidas[i].inicio)) break;
      racha++;
    }

    return { enviadas, vencidas: semanasVencidas.length, rachaActual: racha };
  }, [grupos, semanasConReporte, hoyISO]);

  const cumplimiento = vencidas > 0 ? Math.round((enviadas / vencidas) * 100) : 0;
  const totalSemanas = grupos.reduce((acc, g) => acc + g.semanas.length, 0);

  return (
    <div className="glass-card-elevated rounded-2xl p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SeccionIconHeader icon={History} color="var(--chart-2)" titulo="Calendario anual" descripcion={`Las ${totalSemanas} semanas del año`} size="sm" />
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {/* Resumen compacto en una sola línea -- sin tarjetas que empujen el calendario hacia abajo */}
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {enviadas}/{vencidas}
            </span>
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--chart-1)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              {cumplimiento}%
            </span>
            <span className={cn('inline-flex items-center gap-1', rachaActual > 0 ? 'text-orange-500' : 'text-muted-foreground/50')}>
              <Flame className="h-3.5 w-3.5" />
              {rachaActual}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setAnio((a) => a - 1)} aria-label="Año anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-11 text-center text-xs font-semibold tracking-tight">{anio}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setAnio((a) => a + 1)} aria-label="Año siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-80 w-full rounded-2xl" />
      ) : (
        <>
          {/* Grilla anual: una fila por mes, una celda por cada una de las 52 semanas */}
          <div className="mt-3 flex flex-col gap-0.5">
            {grupos.map((grupo) => {
              const esMesActual = grupo.mes === hoy.getMonth() && anio === hoy.getFullYear();

              return (
                <div
                  key={grupo.mes}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-1 py-0.5 sm:gap-2',
                    esMesActual && 'bg-primary/5 ring-1 ring-primary/20'
                  )}
                >
                  <span
                    className={cn(
                      'w-7 shrink-0 text-[10px] font-semibold tracking-wide uppercase',
                      esMesActual ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {NOMBRES_MES_CORTO[grupo.mes]}
                  </span>
                  <div className="flex flex-1 gap-0.5 sm:gap-1">
                    {grupo.semanas.map((s) => {
                      const enviado = semanasConReporte.has(s.inicio);
                      const semanaVencida = s.fin < hoyISO;
                      const faltante = !enviado && semanaVencida;
                      const esSemanaActual = hoyISO >= s.inicio && hoyISO <= s.fin;

                      return (
                        <div
                          key={s.inicio}
                          title={`${fechaLegible(s.inicio)} – ${fechaLegible(s.fin)}: ${enviado ? 'reporte enviado' : faltante ? 'sin reporte' : 'todavía no corresponde'}`}
                          className={cn(
                            'relative flex flex-1 flex-col items-center justify-center gap-px rounded-md py-1 leading-none transition-all duration-150 hover:z-10 hover:scale-110',
                            enviado && 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/30',
                            faltante && 'border-2 border-dashed border-amber-500/70 bg-amber-500/5 text-amber-600 dark:text-amber-400',
                            !enviado && !faltante && 'border border-dashed border-border/50 bg-muted/10 text-muted-foreground/40',
                            esSemanaActual && 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                          )}
                        >
                          {enviado ? <Check className="h-3 w-3" /> : faltante ? <X className="h-3 w-3" /> : <span className="h-3 w-3" />}
                          <span className="text-[7px] font-bold tabular-nums sm:text-[8px]">
                            {diaDelMes(s.inicio)}-{diaDelMes(s.fin)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600" />
              Reporte enviado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-500/70" />
              Semana sin reporte
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-border/50" />
              Todavía no corresponde
            </span>
          </div>
        </>
      )}
    </div>
  );
}
