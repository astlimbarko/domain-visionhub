import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Baby,
  BookOpen,
  Calendar,
  CalendarCheck2,
  Heart,
  Minus,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, VERDE, AMBAR, MORADO, MARINO, TEAL, DashboardHero, KpiMosaico } from './DashboardUI';
import { IndiceFidelidadRing } from './IndiceFidelidadRing';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import {
  useAsistenciaPromedioPeriodo,
  useDashboardLiderCdp,
  useDashboardSubliderCdp,
  useTendenciaAsistencia,
} from '@/hooks/useDashboard';
import { useTasaEvangelismo } from '@/hooks/useEvangelismo';
import {
  cantidadPorDefecto,
  etiquetaCantidad,
  etiquetaPeriodoEnFrase,
  granularidadPara,
  OPCIONES_CANTIDAD,
  PERIODOS_DASHBOARD,
  rangoPeriodoConCantidad,
  type PeriodoDashboard,
} from '@/utils/periodo-dashboard';

// Los 4 gráficos usan recharts (~una de las dependencias más pesadas del bundle).
// Se cargan bajo demanda para que roles que no ven este dashboard (pastor,
// supervisor, líder de red sin CDP propia) nunca descarguen ese código.
const AsistenciaComposicionChart = lazy(() =>
  import('./AsistenciaComposicionChart').then((m) => ({ default: m.AsistenciaComposicionChart }))
);
const EvangelismoComparativoChart = lazy(() =>
  import('./EvangelismoComparativoChart').then((m) => ({ default: m.EvangelismoComparativoChart }))
);
const EstadosMiembrosChart = lazy(() => import('./EstadosMiembrosChart').then((m) => ({ default: m.EstadosMiembrosChart })));
const TendenciaAsistenciaChart = lazy(() =>
  import('./TendenciaAsistenciaChart').then((m) => ({ default: m.TendenciaAsistenciaChart }))
);

interface Props {
  casaDePazId: string;
  esSublider?: boolean;
}

function fmt(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

/** Línea chica de variación para el pie de un mosaico KPI; cae al texto por defecto si no hay dato. */
function subVariacion(pct: number | null | undefined, fallback: ReactNode): ReactNode {
  if (pct === null || pct === undefined) return fallback;
  const Ico = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-1">
      <Ico className="h-3 w-3" /> {Math.abs(pct)}% vs. anterior
    </span>
  );
}

export function DashboardLiderCdp({ casaDePazId, esSublider = false }: Props) {
  const liderQuery = useDashboardLiderCdp(esSublider ? undefined : casaDePazId);
  const subliderQuery = useDashboardSubliderCdp(esSublider ? casaDePazId : undefined);
  const { data, isLoading } = esSublider ? subliderQuery : liderQuery;
  const contenedorRef = useRef<HTMLDivElement>(null);

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [cantidad, setCantidad] = useState<number>(() => cantidadPorDefecto('MES'));
  const [rango, setRango] = useState<RangoFechas | null>(null);
  // KPIs y gráfico de tendencia comparten el mismo rango -- antes las tarjetas
  // KPI usaban solo el período actual (rangoPeriodoActual) ignorando `cantidad`,
  // así que elegir "Últimos 3 meses" solo movía el gráfico de abajo y los
  // números de arriba seguían mostrando nada más que el mes en curso (pedido
  // del owner, 2026-09-02: que todo el dashboard se mueva junto).
  const { desde, hasta } = rango ?? rangoPeriodoConCantidad(periodo, cantidad);
  const granularidad = granularidadPara(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : etiquetaPeriodoEnFrase(periodo, cantidad);
  const opcionesCantidad = OPCIONES_CANTIDAD[periodo];

  // Las opciones de cantidad dependen del período elegido (ej. Año solo tiene "1"),
  // así que al cambiar de período hay que reencuadrar la cantidad a un valor válido.
  useEffect(() => {
    setCantidad(cantidadPorDefecto(periodo));
  }, [periodo]);

  const { data: tasaEvangelismo } = useTasaEvangelismo(casaDePazId, desde, hasta);
  const { data: asistenciaPromedioPeriodo } = useAsistenciaPromedioPeriodo(casaDePazId, desde, hasta);
  const { data: tendenciaAsistencia = [] } = useTendenciaAsistencia(casaDePazId, granularidad, cantidad, rango ?? undefined);

  // Un solo pase sobre miembros en vez de 4 .filter().length sueltos --
  // antes de tocar el early return de abajo, para no violar Rules of Hooks.
  const contadoresMiembros = useMemo(() => {
    const miembros = data?.miembros ?? [];
    let ninos = 0;
    let verdes = 0;
    let amarillos = 0;
    let rojos = 0;
    for (const m of miembros) {
      if (m.es_menor) ninos++;
      if (m.semaforo === 'VERDE') verdes++;
      else if (m.semaforo === 'AMARILLO') amarillos++;
      else if (m.semaforo === 'ROJO') rojos++;
    }
    return { ninos, verdes, amarillos, rojos };
  }, [data?.miembros]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const { casa_de_paz, kpi, miembros } = data;

  const totalMiembros = miembros?.length ?? 0;
  const { ninos, verdes, amarillos, rojos } = contadoresMiembros;
  const asistenciaPromedio = asistenciaPromedioPeriodo ?? kpi.asistencia_ultima.valor ?? 0;

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      <DashboardHero
        icon={Users}
        eyebrow="Casa de Paz"
        title={casa_de_paz.nombre ?? 'Tu Casa de Paz'}
        color={casa_de_paz.red_color && casa_de_paz.red_color.toUpperCase() !== '#FFFFFF' ? casa_de_paz.red_color : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
              <SelectTrigger size="sm" className="w-28 border-white/25 bg-white/10 text-sm text-white [&_svg]:text-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS_DASHBOARD.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={String(cantidad)} onValueChange={(v) => setCantidad(Number(v))} disabled={!!rango}>
              <SelectTrigger size="sm" className="w-40 border-white/25 bg-white/10 text-sm text-white [&_svg]:text-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                {opcionesCantidad.map((c) => (<SelectItem key={c} value={String(c)}>{etiquetaCantidad(periodo, c)}</SelectItem>))}
              </SelectContent>
            </Select>
            <RangoFechasPopover value={rango} onChange={setRango} />
            <DescargarPdfButton
              contenedorRef={contenedorRef}
              nombreArchivo={`dashboard-cdp-${casa_de_paz.nombre ?? 'casa-de-paz'}`}
              variant="ghost"
              className="h-9 shrink-0 gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            />
          </div>
        }
      />

      {/* ── Indicadores ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMosaico
          label="Miembros"
          icon={Users}
          color={TEAL}
          sub={subVariacion(kpi.miembros_activos.variacion_pct, 'Miembros activos')}
        >
          {kpi.miembros_activos.valor ?? totalMiembros}
        </KpiMosaico>
        <KpiMosaico
          label="Niños"
          icon={Baby}
          color={AMBAR}
          sub={totalMiembros > 0 ? `${Math.round((ninos / totalMiembros) * 100)}% de ${totalMiembros} miembros` : 'Menores de 12 años'}
        >
          {ninos}
        </KpiMosaico>
        <KpiMosaico
          label="Evangelizados"
          icon={UserPlus}
          color={MORADO}
          sub={tasaEvangelismo?.meta != null ? `Meta: ${tasaEvangelismo.meta} · ${etiquetaPeriodo}` : `En ${etiquetaPeriodo}`}
        >
          {tasaEvangelismo?.evangelizados ?? 0}
        </KpiMosaico>
        <KpiMosaico
          label="Última reunión"
          icon={CalendarCheck2}
          color={VERDE}
          sub={subVariacion(
            kpi.asistencia_ultima.variacion_pct,
            kpi.asistencia_ultima.fecha ? `Asistencia del ${fmt(kpi.asistencia_ultima.fecha)}` : 'Última reunión'
          )}
        >
          {kpi.asistencia_ultima.valor ?? '—'}
        </KpiMosaico>
      </div>

      {/* ── Asistencia y composición + Índice de fidelidad ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={TrendingUp} color={VERDE} titulo="Asistencia y composición" descripcion={`Asistencia promedio de ${etiquetaPeriodo}`} />
          <div className="p-5">
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
              <AsistenciaComposicionChart miembros={totalMiembros} asistenciaPromedio={asistenciaPromedio} ninos={ninos} />
            </Suspense>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Heart} color={MORADO} titulo="Índice de fidelidad" descripcion="Semáforo espiritual de los miembros" />
          <div className="p-5">
            <IndiceFidelidadRing verdes={verdes} amarillos={amarillos} rojos={rojos} />
          </div>
        </section>
      </div>

      {/* ── Evangelismo + Estados SSVA ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={UserPlus} color={AMBAR} titulo="Evangelismo" descripcion={`Evangelizados de ${etiquetaPeriodo}`} />
          <div className="p-5">
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
              <EvangelismoComparativoChart evangelizados={tasaEvangelismo?.evangelizados ?? 0} meta={tasaEvangelismo?.meta ?? null} />
            </Suspense>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={BookOpen} color={AZUL} titulo="Estados SSVA" descripcion="Distribución espiritual de miembros" />
          <div className="p-5">
            {totalMiembros > 0 ? (
              <Suspense fallback={<Skeleton className="h-44 w-full rounded-xl" />}>
                <EstadosMiembrosChart miembros={miembros ?? []} />
              </Suspense>
            ) : (
              <p className="text-sm text-muted-foreground">Sin miembros todavía.</p>
            )}
          </div>
        </section>
      </div>

      {/* ── Tendencia de asistencia ───────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Calendar}
          color={MARINO}
          titulo="Tendencia de asistencia"
          descripcion={`${etiquetaCantidad(periodo, cantidad)}, agrupado por ${granularidad}`}
        />
        <div className="p-5">
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
            <TendenciaAsistenciaChart datos={tendenciaAsistencia} granularidad={granularidad} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
