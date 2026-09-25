import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Flame, History, Pencil, PartyPopper, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, MORADO, VERDE } from '@/components/dashboard/DashboardUI';
import { useDiasLimiteEdicionReporte, usePrimeraFechaReunion, useReportesParaCalendario, useReunionesNoRealizadas } from '@/hooks/useReporte';
import { dentroDeVentanaEdicionReporte } from '@/services/reporte.service';
import { ROUTES, rutaReporteEditar } from '@/utils/constants';
import { aISO, fechaLegible, fechaLegibleConDia, finSemanaISO, inicioSemanaISO } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';

/**
 * KAN-393 usó `AZUL` (marca/cumplimiento, ya usado en el header de esta misma
 * tarjeta para el % de cumplimiento) para "reunión no realizada" -- pedido
 * explícito del owner (2026-09-17): tiene que ser un color propio, no el
 * mismo azul que ya representa otro concepto en la misma pantalla.
 *
 * KAN-450 (pedido explícito del owner, 2026-09-25): el celeste original se
 * veía "como un lila" -- pasa a un gris oscuro (entre negro y gris), sin
 * tocar el resto de la paleta compartida (`DashboardUI`).
 */
const NO_REALIZADA_COLOR = '#3f3f46';

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

  // KAN-367: en táctil no hay hover -- el tooltip informativo (círculos sin
  // acción, rojos/grises) no tiene forma de abrirse solo. En dispositivos
  // táctiles el tap sobre esos círculos lo abre/cierra a mano (uno solo a la
  // vez); en desktop se deja el comportamiento normal por hover de Radix
  // (no se toca `open`/`onOpenChange`, undefined = no controlado). Los
  // círculos editables NO pasan por acá -- tocarlos ya navega directo,
  // sin paso intermedio de "ver resumen primero" (mismo criterio que en
  // desktop: el click siempre fue la acción, nunca hizo falta pasar por
  // el tooltip antes).
  // Inicializado en el mismo render (no en el efecto) a propósito: si
  // arrancara en `false` y el efecto lo corrigiera después, el Tooltip
  // pasaría de no-controlado a controlado entre el primer render y el
  // segundo -- React (vía Radix) tira warning por ese cambio, y en un
  // dispositivo táctil real pasaría siempre, no solo en pruebas.
  const [esTactil, setEsTactil] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onChange = (e: MediaQueryListEvent) => setEsTactil(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [semanaAbiertaTactil, setSemanaAbiertaTactil] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!semanaAbiertaTactil) return;
    function cerrarSiEsAfuera(e: PointerEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setSemanaAbiertaTactil(null);
    }
    document.addEventListener('pointerdown', cerrarSiEsAfuera);
    return () => document.removeEventListener('pointerdown', cerrarSiEsAfuera);
  }, [semanaAbiertaTactil]);

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
        /** KAN-409: reportado como Megafiesta -- indicador morado propio, distinto del verde normal. */
        esMegafiesta: boolean;
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
        esMegafiesta: r.es_megafiesta,
      });
    }
    return mapa;
  }, [reportes]);

  // KAN-393: semanas "reunión no realizada" -- quedan afuera de
  // useReportesParaCalendario a propósito (v_reporte_totales las excluye,
  // ver la migración), así que se resuelven con un query aparte.
  const { data: reunionesNoRealizadas = [] } = useReunionesNoRealizadas(casaDePazId, desde, hasta);
  const motivoNoRealizadaPorSemana = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of reunionesNoRealizadas) mapa.set(inicioSemanaISO(r.fecha_reunion), r.motivo ?? '');
    return mapa;
  }, [reunionesNoRealizadas]);

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
    // KAN-392: "reunión no realizada" tampoco cuenta como vencida -- no debe
    // contabilizarse ni como presentado ni como no presentado, queda afuera
    // del cálculo de cumplimiento por completo (pedido explícito del owner).
    const semanasVencidas = grupos
      .flatMap((g) => g.semanas)
      .filter(
        (s) => s.fin < hoyISO && (!primeraSemanaISO || s.inicio >= primeraSemanaISO) && !motivoNoRealizadaPorSemana.has(s.inicio)
      );
    const enviadas = semanasVencidas.filter((s) => semanasConReporte.has(s.inicio)).length;

    let racha = 0;
    for (let i = semanasVencidas.length - 1; i >= 0; i--) {
      if (!semanasConReporte.has(semanasVencidas[i].inicio)) break;
      racha++;
    }

    return { enviadas, vencidas: semanasVencidas.length, rachaActual: racha };
  }, [grupos, semanasConReporte, hoyISO, primeraSemanaISO, motivoNoRealizadaPorSemana]);

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
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NO_REALIZADA_COLOR }} />
                Reunión no realizada
              </span>
              {/* KAN-409: indicador propio para semanas reportadas como
                  Megafiesta -- "hubo actividad, pero fue Megafiesta", no un
                  nuevo estado de completitud (sigue siendo "entregado"). */}
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MORADO }} />
                Megafiesta
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
            <div ref={contenedorRef} className="flex flex-col gap-1">
              {grupos.map((grupo) => {
                const esMesActual = grupo.mes === hoy.getMonth() && anio === hoy.getFullYear();

                return (
                  <div
                    key={grupo.mes}
                    // KAN-392 (bug real reportado por el owner en su celular): con `flex-wrap`
                    // el mes de 5 semanas se quedaba sin ancho para el 5to círculo y lo
                    // mandaba a una segunda línea, dando la impresión de "2 filas" para ese
                    // mes -- la fila de un mes SIEMPRE tiene que verse en una sola línea.
                    // `flex-nowrap` fuerza eso; el label achicado en mobile (abajo) + los
                    // círculos también más chicos en mobile le hacen lugar de sobra incluso a
                    // 6-7 semanas en 390px. `overflow-x-auto` en el contenedor de círculos
                    // (no acá) queda como red de seguridad, no como mecanismo principal.
                    className="flex flex-nowrap items-center gap-1.5 rounded-xl px-2 py-1.5 sm:gap-2.5"
                    style={esMesActual ? { backgroundColor: `color-mix(in oklab, ${VERDE} 8%, transparent)` } : undefined}
                  >
                    <span
                      className="w-9 shrink-0 text-[13px] font-semibold sm:w-28"
                      style={{ color: esMesActual ? VERDE : 'var(--muted-foreground)' }}
                    >
                      {/* Mobile: mes abreviado (menos ancho fijo para dejarle lugar a los
                          círculos); desde `sm` en adelante, nombre completo como siempre. */}
                      <span className="sm:hidden">{NOMBRES_MES[grupo.mes].slice(0, 3)}</span>
                      <span className="hidden sm:inline">{NOMBRES_MES[grupo.mes]}</span>
                    </span>
                    {/* KAN-435 (2026-09-23, bug real reportado por el owner): `overflow-x-auto`
                        sin padding vertical hace que el navegador trate también el eje Y como
                        recortado (regla CSS: un eje con overflow no-visible fuerza el otro a
                        `auto` si estaba en `visible`) -- el círculo, al crecer con
                        `hover:scale-110`, quedaba cortado arriba/abajo en vez de verse como una
                        burbuja completa. `py-1.5` le da lugar al crecimiento sin necesitar
                        overflow vertical real. */}
                    <div className="flex flex-1 flex-nowrap gap-1 overflow-x-auto py-1.5 sm:gap-1.5">
                      {grupo.semanas.map((s) => {
                        const enviado = semanasConReporte.has(s.inicio);
                        const semanaVencida = s.fin < hoyISO;
                        // KAN-367: antes de la primera reunión real de esta CdP, la semana no
                        // "faltó" un reporte -- todavía no existía/no se reunía. Va en gris, no roja.
                        const antesDePrimera = !enviado && !!primeraSemanaISO && s.inicio < primeraSemanaISO;
                        // KAN-393: "reunión no realizada" tiene prioridad sobre "faltante" --
                        // no debe aparecer simultáneamente como no presentado.
                        const motivoNoRealizada = motivoNoRealizadaPorSemana.get(s.inicio);
                        const noRealizada = motivoNoRealizada !== undefined;
                        const faltante = !enviado && !noRealizada && semanaVencida && !antesDePrimera;
                        // KAN-367: el círculo verde se puede editar mientras el reporte de esa
                        // semana siga dentro de la ventana configurable (desde que se cargó,
                        // no desde la reunión) -- el permiso real lo valida el backend igual,
                        // esto solo decide si el círculo se muestra como clickeable.
                        const reporteSemana = reportePorSemana.get(s.inicio);
                        const editable = enviado && !!reporteSemana && dentroDeVentanaEdicionReporte(reporteSemana.fechaCreacion, diasLimiteEdicion);

                        const estadoTexto = enviado
                          ? 'reporte entregado'
                          : noRealizada
                            ? 'reunión no realizada'
                            : antesDePrimera
                              ? 'antes de la primera reunión'
                              : faltante
                                ? 'no entregado'
                                : 'todavía no corresponde';

                        return (
                          <Tooltip
                            key={s.inicio}
                            {...(esTactil
                              ? {
                                  open: semanaAbiertaTactil === s.inicio,
                                  onOpenChange: (abierto: boolean) => setSemanaAbiertaTactil(abierto ? s.inicio : null),
                                }
                              : {})}
                          >
                            <TooltipTrigger asChild>
                              {/* KAN-367: sin `disabled` nativo a propósito -- un <button disabled>
                                  deja de recibir hover en algunos motores (Safari), lo que le
                                  tapaba el tooltip a las semanas no editables. `aria-disabled` +
                                  omitir onClick logra lo mismo (no clickeable) sin perder el hover.
                                  En táctil, sin hover, los círculos editables siguen navegando
                                  directo al tap (no hace falta ver el resumen antes -- mismo
                                  criterio que en desktop, el click siempre fue la acción); los no
                                  editables abren/cierran el tooltip a mano, es su única forma de
                                  mostrar el resumen sin mouse. */}
                              <button
                                type="button"
                                aria-disabled={!editable && !faltante}
                                tabIndex={editable || faltante ? 0 : -1}
                                onClick={
                                  editable
                                    ? () => navigate(rutaReporteEditar(reporteSemana.reporteId))
                                    : // KAN-435 (pedido del owner): el círculo rojo "no entregado" no
                                      // tiene reporte -- abre directo el formulario en blanco con la
                                      // fecha de esa semana precargada, sin ningún aviso intermedio
                                      // (mismo criterio que los verdes: el click ya es la acción).
                                      faltante
                                      ? () => navigate(`${ROUTES.REPORTES}?fecha=${s.inicio}`)
                                      : esTactil
                                        ? () => setSemanaAbiertaTactil((actual) => (actual === s.inicio ? null : s.inicio))
                                        : undefined
                                }
                                className={cn(
                                  // KAN-392: círculo más chico en mobile (h-7/w-7) -- junto con el
                                  // label abreviado y `flex-nowrap` de arriba, evita que la fila de
                                  // un mes de 5-6 semanas necesite una segunda línea en 390px.
                                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-none text-[11px] font-bold tabular-nums transition-transform duration-150 hover:z-10 hover:scale-110 sm:h-8 sm:w-8',
                                  enviado && 'text-white',
                                  faltante && 'bg-destructive text-white shadow-sm shadow-destructive/30',
                                  noRealizada && 'text-white',
                                  !enviado && !faltante && !noRealizada && 'bg-muted text-muted-foreground/60',
                                  editable && 'cursor-pointer ring-1 ring-inset ring-white/40 hover:brightness-[0.97]',
                                  faltante && 'cursor-pointer ring-1 ring-inset ring-white/40 hover:brightness-110',
                                  !editable && !faltante && 'cursor-default'
                                )}
                                // KAN-367 (pedido del owner, 2026-09-17): entregado-editable vs
                                // entregado-vencido son el mismo estado semántico (verde) pero uno
                                // se puede tocar y el otro no -- distinto tono (no solo el anillo)
                                // para que se note a simple vista sin depender del hover/tooltip.
                                // KAN-393 (color pedido explícito por el owner, 2026-09-17): "reunión
                                // no realizada" usa NO_REALIZADA_COLOR, no AZUL -- AZUL ya representa el % de
                                // cumplimiento en el header de esta misma tarjeta, reusarlo acá
                                // mezclaba dos conceptos distintos bajo el mismo color.
                                style={
                                  enviado
                                    ? reporteSemana?.esMegafiesta
                                      ? {
                                          backgroundColor: editable ? MORADO : `color-mix(in oklab, ${MORADO} 55%, var(--muted-foreground))`,
                                          boxShadow: editable
                                            ? `0 4px 10px -4px color-mix(in oklab, ${MORADO} 60%, transparent)`
                                            : undefined,
                                        }
                                      : {
                                          backgroundColor: editable ? VERDE : `color-mix(in oklab, ${VERDE} 55%, var(--muted-foreground))`,
                                          boxShadow: editable
                                            ? `0 4px 10px -4px color-mix(in oklab, ${VERDE} 60%, transparent)`
                                            : undefined,
                                        }
                                    : noRealizada
                                      ? { backgroundColor: NO_REALIZADA_COLOR }
                                      : undefined
                                }
                              >
                                {numeroDeSemana.get(s.inicio)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {enviado && reporteSemana ? (
                                <div className="flex flex-col gap-[3px]">
                                  <p className="font-semibold">{conMayusInicial(fechaLegibleConDia(reporteSemana.fechaReunion))}</p>
                                  {reporteSemana.esMegafiesta && (
                                    <p className="flex items-center gap-1.5 font-medium" style={{ color: MORADO }}>
                                      <PartyPopper className="h-3 w-3 shrink-0" />
                                      Megafiesta de Casa de Paz
                                    </p>
                                  )}
                                  <p className="text-muted-foreground">Reporte cargado: {fechaLegible(aISO(new Date(reporteSemana.fechaCreacion)))}</p>
                                  <p className="text-muted-foreground">Adultos: {reporteSemana.totalMayores}</p>
                                  <p className="text-muted-foreground">Niños: {reporteSemana.totalMenores}</p>
                                  <p className="text-muted-foreground">Ofrenda: {reporteSemana.totalOfrendas}</p>
                                  <p className="text-muted-foreground">Diezmos: {reporteSemana.totalDiezmos}</p>
                                  {editable && <p className="mt-0.5 font-medium text-primary">Click para modificar</p>}
                                </div>
                              ) : noRealizada ? (
                                <div className="flex flex-col gap-[3px]">
                                  <p className="flex items-center gap-1.5 font-semibold" style={{ color: NO_REALIZADA_COLOR }}>
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: NO_REALIZADA_COLOR }} />
                                    Reunión no realizada
                                  </p>
                                  <p className="text-muted-foreground">Motivo: {motivoNoRealizada || '—'}</p>
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
                                  <p className="mt-0.5 font-medium text-primary">Click para completar este reporte</p>
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
