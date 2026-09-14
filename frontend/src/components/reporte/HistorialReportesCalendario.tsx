import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Flame, History, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE } from '@/components/dashboard/DashboardUI';
import { useDiasLimiteEdicionReporte, usePrimeraFechaReunion, useReportesParaCalendario } from '@/hooks/useReporte';
import { dentroDeVentanaEdicionReporte } from '@/services/reporte.service';
import { rutaReporteEditar } from '@/utils/constants';
import { aISO, fechaLegible, fechaLegibleConDia, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';

interface Props {
  casaDePazId: string | undefined;
  /** KAN-367: hace falta para resolver la ventana de edición configurable por iglesia. */
  iglesiaId: string | undefined;
}

/** `capitalize` de CSS pone mayúscula a cada palabra ("Domingo 8 De Febrero") -- esto solo a la primera letra. */
function conMayusInicial(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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
export function HistorialReportesCalendario({ casaDePazId, iglesiaId }: Props) {
  const navigate = useNavigate();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const hoyISO = aISO(hoy);

  const grupos = useMemo(() => semanasDelAnioPorMes(anio), [anio]);
  const desde = grupos[0].semanas[0].inicio;
  const hasta = grupos[grupos.length - 1].semanas.at(-1)!.fin;

  const { data: reportes = [], isLoading } = useReportesParaCalendario(casaDePazId, desde, hasta);
  // KAN-367: ventana de edición del propio Líder/Sublíder de esta CdP (el
  // calendario es su vista, no la de Red/Supervisor -- esa usa la ventana larga en ControlReportesVista).
  const { data: diasLimiteEdicion = 3 } = useDiasLimiteEdicionReporte(iglesiaId, 'DIAS_LIMITE_EDICION_REPORTE_CDP');
  // KAN-367: antes de la primera reunión real de esta CdP, ninguna semana
  // "faltó" un reporte -- todavía no existía/no se reunía. Se pinta gris, no roja.
  const { data: primeraFechaReunion } = usePrimeraFechaReunion(casaDePazId);
  const primeraSemanaISO = useMemo(() => (primeraFechaReunion ? inicioSemanaISO(primeraFechaReunion) : null), [primeraFechaReunion]);

  const fechasReportadas = useMemo(() => reportes.map((r) => r.fecha_reunion), [reportes]);
  const semanasConReporte = useMemo(() => new Set(fechasReportadas.map((f) => inicioSemanaISO(f))), [fechasReportadas]);
  // Un reporte por semana (mismo criterio que el resto del calendario) -- si
  // hubiera más de uno en la misma semana, se queda con el último leído.
  const reportePorSemana = useMemo(() => {
    const mapa = new Map<
      string,
      {
        reporteId: string;
        fechaReunion: string;
        fechaCreacion: string;
        totalMayores: number;
        totalMenores: number;
        totalOfrendas: number;
        totalDiezmos: number;
      }
    >();
    for (const r of reportes) {
      mapa.set(inicioSemanaISO(r.fecha_reunion), {
        reporteId: r.reporte_id,
        fechaReunion: r.fecha_reunion,
        fechaCreacion: r.fecha_creacion,
        totalMayores: r.total_mayores,
        totalMenores: r.total_menores,
        totalOfrendas: r.total_ofrendas,
        totalDiezmos: r.total_diezmos,
      });
    }
    return mapa;
  }, [reportes]);

  // Numeración continua de semanas (1..N) en orden cronológico, para el rótulo de cada círculo.
  const numeroDeSemana = useMemo(() => {
    const mapa = new Map<string, number>();
    let n = 1;
    for (const g of grupos) for (const s of g.semanas) mapa.set(s.inicio, n++);
    return mapa;
  }, [grupos]);

  const { enviadas, vencidas, rachaActual } = useMemo(() => {
    // KAN-367: una semana anterior a la primera reunión real no cuenta como
    // "vencida" -- no se le puede pedir un reporte a una CdP que todavía no existía.
    const semanasVencidas = grupos
      .flatMap((g) => g.semanas)
      .filter((s) => s.fin < hoyISO && (!primeraSemanaISO || s.inicio >= primeraSemanaISO));
    const enviadas = semanasVencidas.filter((s) => semanasConReporte.has(s.inicio)).length;

    let racha = 0;
    for (let i = semanasVencidas.length - 1; i >= 0; i--) {
      if (!semanasConReporte.has(semanasVencidas[i].inicio)) break;
      racha++;
    }

    return { enviadas, vencidas: semanasVencidas.length, rachaActual: racha };
  }, [grupos, semanasConReporte, hoyISO, primeraSemanaISO]);

  const cumplimiento = vencidas > 0 ? Math.round((enviadas / vencidas) * 100) : 0;

  // KAN-367: aviso de que los círculos verdes se pueden editar -- solo aparece si hay al menos uno editable a la vista.
  const hayReporteEditable = useMemo(
    () => reportes.some((r) => dentroDeVentanaEdicionReporte(r.fecha_creacion, diasLimiteEdicion)),
    [reportes, diasLimiteEdicion]
  );

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

            {/* KAN-367: aviso de que los círculos verdes se pueden editar -- solo si hay al menos uno editable a la vista. */}
            {hayReporteEditable && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Pencil className="h-3 w-3" />
                </span>
                Tocá un círculo verde para modificar ese reporte (hasta {diasLimiteEdicion} días después de cargado).
              </div>
            )}

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
                        // KAN-367: antes de la primera reunión real de esta CdP, la semana no
                        // "faltó" un reporte -- todavía no existía/no se reunía. Va en gris, no roja.
                        const antesDePrimera = !enviado && !!primeraSemanaISO && s.inicio < primeraSemanaISO;
                        const faltante = !enviado && semanaVencida && !antesDePrimera;
                        // KAN-367: el círculo verde se puede editar mientras el reporte de esa
                        // semana siga dentro de la ventana configurable (desde que se cargó,
                        // no desde la reunión) -- el permiso real lo valida el backend igual,
                        // esto solo decide si el círculo se muestra como clickeable.
                        const reporteSemana = reportePorSemana.get(s.inicio);
                        const editable = enviado && !!reporteSemana && dentroDeVentanaEdicionReporte(reporteSemana.fechaCreacion, diasLimiteEdicion);

                        const estadoTexto = enviado
                          ? 'reporte entregado'
                          : antesDePrimera
                            ? 'antes de la primera reunión'
                            : faltante
                              ? 'no entregado'
                              : 'todavía no corresponde';

                        return (
                          <Tooltip key={s.inicio}>
                            <TooltipTrigger asChild>
                              {/* KAN-367: sin `disabled` nativo a propósito -- un <button disabled>
                                  deja de recibir hover en algunos motores (Safari), lo que le
                                  tapaba el tooltip a las semanas no editables. `aria-disabled` +
                                  omitir onClick logra lo mismo (no clickeable) sin perder el hover. */}
                              <button
                                type="button"
                                aria-disabled={!editable}
                                tabIndex={editable ? 0 : -1}
                                onClick={editable ? () => navigate(rutaReporteEditar(reporteSemana.reporteId)) : undefined}
                                className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-none text-[11px] font-bold tabular-nums transition-transform duration-150 hover:z-10 hover:scale-110',
                                  enviado && 'text-white',
                                  faltante && 'bg-destructive text-white shadow-sm shadow-destructive/30',
                                  !enviado && !faltante && 'bg-muted text-muted-foreground/60',
                                  editable ? 'cursor-pointer ring-1 ring-inset ring-white/40 hover:brightness-[0.97]' : 'cursor-default'
                                )}
                                style={enviado ? { backgroundColor: VERDE, boxShadow: `0 4px 10px -4px color-mix(in oklab, ${VERDE} 60%, transparent)` } : undefined}
                              >
                                {numeroDeSemana.get(s.inicio)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {enviado && reporteSemana ? (
                                <div className="flex flex-col gap-[3px]">
                                  <p className="font-semibold">{conMayusInicial(fechaLegibleConDia(reporteSemana.fechaReunion))}</p>
                                  <p className="text-muted-foreground">Reporte cargado: {fechaLegible(aISO(new Date(reporteSemana.fechaCreacion)))}</p>
                                  <p className="text-muted-foreground">Adultos: {reporteSemana.totalMayores}</p>
                                  <p className="text-muted-foreground">Niños: {reporteSemana.totalMenores}</p>
                                  <p className="text-muted-foreground">Ofrenda: {reporteSemana.totalOfrendas}</p>
                                  <p className="text-muted-foreground">Diezmos: {reporteSemana.totalDiezmos}</p>
                                  {editable && <p className="mt-0.5 font-medium text-primary">Click para modificar</p>}
                                </div>
                              ) : faltante ? (
                                <div className="flex flex-col gap-[3px]">
                                  <p className="flex items-center gap-1.5 font-semibold text-destructive">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" />
                                    Reporte no entregado
                                  </p>
                                  <p className="text-muted-foreground">
                                    Fecha supuesta: {fechaLegible(s.inicio)} – {fechaLegible(s.fin)}
                                  </p>
                                </div>
                              ) : (
                                <p>
                                  {fechaLegible(s.inicio)} – {fechaLegible(s.fin)}: {estadoTexto}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
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
