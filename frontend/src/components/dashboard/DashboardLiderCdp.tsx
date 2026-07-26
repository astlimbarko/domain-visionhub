import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Baby,
  BookOpen,
  Calendar,
  CalendarCheck2,
  DollarSign,
  Heart,
  Minus,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsistenciaComposicionChart } from './AsistenciaComposicionChart';
import { IndiceFidelidadRing } from './IndiceFidelidadRing';
import { EvangelismoComparativoChart } from './EvangelismoComparativoChart';
import { EstadosMiembrosChart } from './EstadosMiembrosChart';
import { TendenciaAsistenciaChart } from './TendenciaAsistenciaChart';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import {
  useAsistenciaPromedioPeriodo,
  useDashboardLiderCdp,
  useDashboardSubliderCdp,
  useIngresosCdpPeriodo,
  useTendenciaAsistencia,
} from '@/hooks/useDashboard';
import { useTasaEvangelismo } from '@/hooks/useEvangelismo';
import {
  cantidadPorDefecto,
  etiquetaCantidad,
  granularidadPara,
  OPCIONES_CANTIDAD,
  PERIODOS_DASHBOARD,
  rangoPeriodoActual,
  type PeriodoDashboard,
} from '@/utils/periodo-dashboard';

interface Props {
  casaDePazId: string;
  esSublider?: boolean;
}

function fmt(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

function VariacionBadge({ pct }: { pct: number }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        pct > 0 ? 'bg-chart-2/10 text-chart-2' : pct < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
      }`}
    >
      {pct > 0 ? <ArrowUp className="h-3 w-3" /> : pct < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(pct)}% vs. período anterior
    </span>
  );
}

/** Ícono + color propios de cada card, para identificar el tema de cada gráfica de un vistazo. */
function CardIconHeader({
  icon: Icon,
  color,
  titulo,
  descripcion,
}: {
  icon: LucideIcon;
  color: string;
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}
      >
        <Icon className="h-4.5 w-4.5" style={{ color }} />
      </div>
      <div>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
      </div>
    </div>
  );
}

export function DashboardLiderCdp({ casaDePazId, esSublider = false }: Props) {
  const liderQuery = useDashboardLiderCdp(esSublider ? undefined : casaDePazId);
  const subliderQuery = useDashboardSubliderCdp(esSublider ? casaDePazId : undefined);
  const { data, isLoading } = esSublider ? subliderQuery : liderQuery;

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [cantidad, setCantidad] = useState<number>(() => cantidadPorDefecto('MES'));
  const [rango, setRango] = useState<RangoFechas | null>(null);
  const { desde, hasta } = rango ?? rangoPeriodoActual(periodo);
  const granularidad = granularidadPara(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : (PERIODOS_DASHBOARD.find((p) => p.value === periodo)?.etiqueta ?? 'este mes');
  const opcionesCantidad = OPCIONES_CANTIDAD[periodo];

  // Las opciones de cantidad dependen del período elegido (ej. Año solo tiene "1"),
  // así que al cambiar de período hay que reencuadrar la cantidad a un valor válido.
  useEffect(() => {
    setCantidad(cantidadPorDefecto(periodo));
  }, [periodo]);

  // Si el sublíder no tiene permiso para ver ofrendas, el backend ya quita `kpi.ingresos_mes`
  // del payload: no hay que pedirle lo mismo por otro lado.
  const ingresosPermitidos = data?.kpi?.ingresos_mes !== undefined;

  const { data: tasaEvangelismo } = useTasaEvangelismo(casaDePazId, desde, hasta);
  const { data: asistenciaPromedioPeriodo } = useAsistenciaPromedioPeriodo(casaDePazId, desde, hasta);
  const { data: tendenciaAsistencia = [] } = useTendenciaAsistencia(casaDePazId, granularidad, cantidad, rango ?? undefined);
  const { data: ingresosPeriodo } = useIngresosCdpPeriodo(casaDePazId, desde, hasta, ingresosPermitidos);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full lg:col-span-3" />
        <Skeleton className="h-64 w-full lg:col-span-3" />
      </div>
    );
  }

  const { casa_de_paz, kpi, miembros } = data;

  const totalMiembros = miembros?.length ?? 0;
  const ninos = (miembros ?? []).filter((m) => m.es_menor).length;
  const verdes = (miembros ?? []).filter((m) => m.semaforo === 'VERDE').length;
  const amarillos = (miembros ?? []).filter((m) => m.semaforo === 'AMARILLO').length;
  const rojos = (miembros ?? []).filter((m) => m.semaforo === 'ROJO').length;
  const asistenciaPromedio = asistenciaPromedioPeriodo ?? kpi.asistencia_ultima.valor ?? 0;

  const ingresos = ingresosPermitidos ? (ingresosPeriodo ?? kpi.ingresos_mes ?? []) : [];
  const ofrendas = ingresos.filter((i) => i.tipo_codigo === 'OFRENDA');
  const diezmos = ingresos.filter((i) => i.tipo_codigo === 'DIEZMO');
  const monedasDistintas = new Set(ingresos.map((i) => i.moneda_codigo));
  const totalPorMoneda = new Map<string, { simbolo: string; total: number }>();
  for (const i of ingresos) {
    const actual = totalPorMoneda.get(i.moneda_codigo) ?? { simbolo: i.moneda_simbolo, total: 0 };
    actual.total += Number(i.total);
    totalPorMoneda.set(i.moneda_codigo, actual);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Vista general de {casa_de_paz.nombre ?? 'tu Casa de Paz'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
            <SelectTrigger className="w-32 rounded-xl border-border/60 bg-muted/40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS_DASHBOARD.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(cantidad)} onValueChange={(v) => setCantidad(Number(v))} disabled={!!rango}>
            <SelectTrigger className="w-44 rounded-xl border-border/60 bg-muted/40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesCantidad.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {etiquetaCantidad(periodo, c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RangoFechasPopover value={rango} onChange={setRango} />
        </div>
      </div>

      {/* KPIs compactos */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="glass-card flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">Miembros</p>
              <p className="text-2xl font-bold text-foreground">{kpi.miembros_activos.valor ?? totalMiembros}</p>
            </div>
          </div>
          {kpi.miembros_activos.variacion_pct !== null && kpi.miembros_activos.variacion_pct !== undefined ? (
            <VariacionBadge pct={kpi.miembros_activos.variacion_pct} />
          ) : (
            <p className="text-[11px] text-muted-foreground">Miembros activos en tu Casa de Paz</p>
          )}
        </div>

        <div className="glass-card flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--chart-4)]/10">
              <Baby className="h-5 w-5" style={{ color: 'var(--chart-4)' }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">Niños</p>
              <p className="text-2xl font-bold text-foreground">{ninos}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {totalMiembros > 0 ? `${Math.round((ninos / totalMiembros) * 100)}% de ${totalMiembros} miembros` : 'Menores de 12 años'}
          </p>
        </div>

        <div className="glass-card flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--chart-3)]/10">
              <UserPlus className="h-5 w-5" style={{ color: 'var(--chart-3)' }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">Evangelizados</p>
              <p className="text-2xl font-bold text-foreground">{tasaEvangelismo?.evangelizados ?? 0}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {tasaEvangelismo?.meta != null ? `Meta: ${tasaEvangelismo.meta} · ${etiquetaPeriodo}` : `En ${etiquetaPeriodo}`}
          </p>
        </div>

        <div className="glass-card flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10">
              <CalendarCheck2 className="h-5 w-5 text-pink-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">Última reunión</p>
              <p className="text-2xl font-bold text-foreground">{kpi.asistencia_ultima.valor ?? '—'}</p>
            </div>
          </div>
          {kpi.asistencia_ultima.variacion_pct !== null && kpi.asistencia_ultima.variacion_pct !== undefined ? (
            <VariacionBadge pct={kpi.asistencia_ultima.variacion_pct} />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {kpi.asistencia_ultima.fecha ? `Asistencia del ${fmt(kpi.asistencia_ultima.fecha)}` : 'Asistentes en la última reunión'}
            </p>
          )}
        </div>
      </div>

      {/* Asistencia y composición + Índice de fidelidad */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardIconHeader
              icon={TrendingUp}
              color="#5fa584"
              titulo="Asistencia y composición"
              descripcion={`Asistencia promedio de ${etiquetaPeriodo}`}
            />
          </CardHeader>
          <CardContent>
            <AsistenciaComposicionChart miembros={totalMiembros} asistenciaPromedio={asistenciaPromedio} ninos={ninos} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardIconHeader icon={Heart} color="var(--destructive)" titulo="Índice de fidelidad" />
          </CardHeader>
          <CardContent>
            <IndiceFidelidadRing verdes={verdes} amarillos={amarillos} rojos={rojos} />
          </CardContent>
        </Card>
      </div>

      {/* Evangelismo + Estados SSVA */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardIconHeader
              icon={UserPlus}
              color="var(--chart-3)"
              titulo="Evangelismo"
              descripcion={`Evangelizados de ${etiquetaPeriodo}`}
            />
          </CardHeader>
          <CardContent>
            <EvangelismoComparativoChart evangelizados={tasaEvangelismo?.evangelizados ?? 0} meta={tasaEvangelismo?.meta ?? null} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardIconHeader icon={BookOpen} color="var(--chart-1)" titulo="Estados SSVA" descripcion="Distribución espiritual de miembros" />
          </CardHeader>
          <CardContent>
            {totalMiembros > 0 ? (
              <EstadosMiembrosChart miembros={miembros ?? []} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin miembros todavía.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendencia de asistencia */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardIconHeader
            icon={Calendar}
            color="#6366f1"
            titulo="Tendencia de asistencia"
            descripcion={`${etiquetaCantidad(periodo, cantidad)}, agrupado por ${granularidad}`}
          />
        </CardHeader>
        <CardContent>
          <TendenciaAsistenciaChart datos={tendenciaAsistencia} granularidad={granularidad} />
        </CardContent>
      </Card>

      {/* Resumen financiero */}
      {ingresos.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <DollarSign className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Resumen financiero</h3>
              <p className="text-[11px] text-emerald-100">Total de {etiquetaPeriodo}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] text-emerald-100">Ofrendas</p>
              {ofrendas.length === 0 ? (
                <p className="text-xl font-bold">—</p>
              ) : (
                ofrendas.map((o, i) => (
                  <p key={i} className="text-xl font-bold">
                    {o.moneda_simbolo} {Number(o.total).toFixed(2)}
                  </p>
                ))
              )}
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] text-emerald-100">Diezmos</p>
              {diezmos.length === 0 ? (
                <p className="text-xl font-bold">—</p>
              ) : (
                diezmos.map((d, i) => (
                  <p key={i} className="text-xl font-bold">
                    {d.moneda_simbolo} {Number(d.total).toFixed(2)}
                  </p>
                ))
              )}
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] text-emerald-100">Total</p>
              {monedasDistintas.size === 0 ? (
                <p className="text-xl font-bold">—</p>
              ) : (
                Array.from(totalPorMoneda.values()).map((t, i) => (
                  <p key={i} className="text-xl font-bold">
                    {t.simbolo} {t.total.toFixed(2)}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
