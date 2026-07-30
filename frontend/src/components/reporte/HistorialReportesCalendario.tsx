import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, History, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE } from '@/components/dashboard/DashboardUI';
import { useHistorialReportes } from '@/hooks/useReporte';
import { aISO, fechaLegible, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';

interface Props {
  casaDePazId: string | undefined;
}

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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
 * Calendario anual: una fila por mes, un círculo numerado por semana (1-53,
 * numeración continua a lo largo del año). Verde = se envió el reporte esa
 * semana; rojo = la semana ya cerró sin reporte; gris = semana actual o
 * futura, todavía no corresponde.
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

  // Numeración continua de semanas (1..N) en orden cronológico, para el rótulo de cada círculo.
  const numeroDeSemana = useMemo(() => {
    const mapa = new Map<string, number>();
    let n = 1;
    for (const g of grupos) for (const s of g.semanas) mapa.set(s.inicio, n++);
    return mapa;
  }, [grupos]);

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

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <TarjetaHeader
        icon={History}
        color={VERDE}
        titulo="Calendario"
        descripcion="Qué semanas mandó reporte esta Casa de Paz"
        accion={
          <div className="flex flex-wrap items-center gap-3">
            {/* Resumen compacto en una sola línea -- sin tarjetas que empujen el calendario hacia abajo */}
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {enviadas}/{vencidas}
              </span>
              <span className="inline-flex items-center gap-1" style={{ color: AZUL }}>
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
              <span className="text-xs font-semibold tracking-tight whitespace-nowrap">Año {anio}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setAnio((a) => a + 1)} aria-label="Año siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      />

      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : (
          <>
            {/* Leyenda */}
            <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: VERDE }} />
                Entregado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                No entregado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
                Próxima semana
              </span>
            </div>

            {/* Filas por mes: nombre completo + círculos numerados (semana 1-53 del año) */}
            <div className="flex flex-col gap-1">
              {grupos.map((grupo) => {
                const esMesActual = grupo.mes === hoy.getMonth() && anio === hoy.getFullYear();

                return (
                  <div
                    key={grupo.mes}
                    className="flex flex-wrap items-center gap-2.5 rounded-xl px-2 py-1.5"
                    style={esMesActual ? { backgroundColor: `color-mix(in oklab, ${VERDE} 8%, transparent)` } : undefined}
                  >
                    <span
                      className="w-28 shrink-0 text-[13px] font-semibold"
                      style={{ color: esMesActual ? VERDE : 'var(--muted-foreground)' }}
                    >
                      {NOMBRES_MES[grupo.mes]}
                    </span>
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {grupo.semanas.map((s) => {
                        const enviado = semanasConReporte.has(s.inicio);
                        const semanaVencida = s.fin < hoyISO;
                        const faltante = !enviado && semanaVencida;

                        return (
                          <div
                            key={s.inicio}
                            title={`${fechaLegible(s.inicio)} – ${fechaLegible(s.fin)}: ${enviado ? 'reporte entregado' : faltante ? 'no entregado' : 'todavía no corresponde'}`}
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-transform duration-150 hover:z-10 hover:scale-110',
                              enviado && 'text-white',
                              faltante && 'bg-destructive text-white shadow-sm shadow-destructive/30',
                              !enviado && !faltante && 'bg-muted text-muted-foreground/60'
                            )}
                            style={enviado ? { backgroundColor: VERDE, boxShadow: `0 4px 10px -4px color-mix(in oklab, ${VERDE} 60%, transparent)` } : undefined}
                          >
                            {numeroDeSemana.get(s.inicio)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
