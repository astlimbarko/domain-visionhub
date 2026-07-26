import { useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, Coins, Gift, Home, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import { useDashboardLiderRed, useIngresosRedPeriodo } from '@/hooks/useDashboard';
import { PERIODOS_DASHBOARD, rangoPeriodoActual, type PeriodoDashboard } from '@/utils/periodo-dashboard';

const AZUL = 'var(--chart-1)';
const VERDE = 'var(--chart-2)';
const AMBAR = 'var(--chart-3)';
const MORADO = 'var(--chart-4)';

/**
 * DATE 'YYYY-MM-DD' → 'DD/MM/YYYY' sin zona horaria. `new Date('2026-07-13')`
 * se interpreta como UTC medianoche y en UTC-4 retrocede un día (mostraba
 * 12/7 por un reporte del 13/7); partir el string evita ese corrimiento.
 */
function fechaLocal(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * KPI con color y volumen: fondo de vidrio elevado teñido con el color de la
 * métrica, un glow difuso y un badge de ícono sólido y elevado (sombra del
 * mismo color) que le da profundidad. Sirve para dar de un vistazo el número
 * grande y qué representa.
 */
function KpiColor({ color, icon: Icon, titulo, valor, children }: {
  color: string;
  icon: LucideIcon;
  titulo: string;
  valor?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="glass-card-elevated relative flex flex-col gap-4 overflow-hidden rounded-3xl p-5">
      <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(150deg, color-mix(in oklab, ${color} 16%, transparent) 0%, transparent 58%)` }} />
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: color }} />
      <span
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 70%, #000) 100%)`,
          boxShadow: `0 10px 22px -8px color-mix(in oklab, ${color} 70%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.35)`,
        }}
      >
        <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
      </span>
      <div className="relative">
        {children ?? <p className="text-[28px] leading-none font-bold tracking-tight tabular-nums text-foreground">{valor ?? '—'}</p>}
        <p className="mt-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{titulo}</p>
      </div>
    </div>
  );
}

interface Props {
  redId: string;
  onSeleccionarCdp?: (cdpId: string) => void;
}

export function DashboardLiderRed({ redId, onSeleccionarCdp }: Props) {
  const { data, isLoading } = useDashboardLiderRed(redId);

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [rango, setRango] = useState<RangoFechas | null>(null);
  const { desde, hasta } = rango ?? rangoPeriodoActual(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : (PERIODOS_DASHBOARD.find((p) => p.value === periodo)?.etiqueta ?? 'este mes');
  const { data: ingresosPeriodo } = useIngresosRedPeriodo(redId, desde, hasta);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-3xl" />)}
        </div>
      </div>
    );
  }

  const { red, kpi, casas_de_paz, cdp_sin_reporte_semana } = data;
  const ingresos = ingresosPeriodo ?? data.ingresos ?? [];

  const ingresosPorMoneda = new Map<string, number>();
  for (const i of ingresos) ingresosPorMoneda.set(i.moneda_simbolo, (ingresosPorMoneda.get(i.moneda_simbolo) ?? 0) + Number(i.total));
  const ingresosEntradas = Array.from(ingresosPorMoneda.entries());

  const ranking = [...(casas_de_paz ?? [])].sort((a, b) => (b.ultima_asistencia ?? -1) - (a.ultima_asistencia ?? -1));
  const maxAsist = ranking.reduce((m, c) => Math.max(m, c.ultima_asistencia ?? 0), 0);
  const sinReporte = cdp_sin_reporte_semana ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero: identidad de la Red + salud de un vistazo ───────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-7 sm:px-8"
        style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}
      >
        <div className="pointer-events-none absolute -top-20 -right-14 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: AZUL }} />
        <div className="relative flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">Resumen de la Red</p>
            <h2 className="font-heading mt-1 text-[28px] leading-tight font-bold tracking-tight text-white">{red.nombre}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white">
              <Home className="h-3.5 w-3.5 text-white/70" /> {kpi.cdp_activas} Casas de Paz activas
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white">
              <Users className="h-3.5 w-3.5 text-white/70" /> {kpi.miembros_totales} miembros
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white">
              <Activity className="h-3.5 w-3.5 text-white/70" /> {kpi.asistencia_promedio ?? '—'} de asistencia promedio
            </span>
          </div>
        </div>
      </div>

      {/* ── Controles de período ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Mostrando datos de {etiquetaPeriodo}.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
            <SelectTrigger className="w-32 rounded-xl text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS_DASHBOARD.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <RangoFechasPopover value={rango} onChange={setRango} />
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiColor titulo="Casas de Paz activas" valor={kpi.cdp_activas} icon={Home} color={AZUL} />
        <KpiColor titulo="Miembros totales" valor={kpi.miembros_totales} icon={Users} color={MORADO} />
        <KpiColor titulo="Asistencia promedio" valor={kpi.asistencia_promedio ?? '—'} icon={Activity} color={VERDE} />
        <KpiColor titulo={`Ingresos de ${etiquetaPeriodo}`} icon={Wallet} color={AMBAR}>
          {ingresosEntradas.length === 0 ? (
            <p className="text-[28px] leading-none font-bold tracking-tight text-foreground">—</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {ingresosEntradas.map(([simbolo, total]) => (
                <p key={simbolo} className="text-xl leading-tight font-bold tracking-tight tabular-nums text-foreground">{simbolo} {total.toFixed(2)}</p>
              ))}
            </div>
          )}
        </KpiColor>
      </div>

      {/* ── Aviso: sin reporte esta semana ───────────────────────────────────────── */}
      {sinReporte.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 p-5" style={{ background: `color-mix(in oklab, ${AMBAR} 7%, var(--card))` }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${AMBAR} 16%, transparent)` }}>
              <AlertTriangle className="h-4.5 w-4.5" style={{ color: AMBAR }} />
            </span>
            <div>
              <p className="font-heading text-base font-semibold tracking-tight text-foreground">Sin reporte esta semana</p>
              <p className="text-[12px] text-muted-foreground">{sinReporte.length} Casa{sinReporte.length === 1 ? '' : 's'} de Paz todavía no cargó su reporte.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 pl-11.5">
            {sinReporte.map((c) => (
              <span key={c.id} className="rounded-full border border-amber-500/50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">{c.etiqueta}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Ranking por asistencia ───────────────────────────────────────────────── */}
      <Card className="rounded-3xl">
        <CardHeader>
          <SeccionIconHeader icon={Activity} color={VERDE} titulo="Casas de Paz por asistencia" descripcion="Ordenadas por su última reunión reportada" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta Red todavía no tiene Casas de Paz.</p>
          ) : (
            ranking.map((c, i) => {
              const asistio = c.ultima_asistencia ?? null;
              const pct = maxAsist > 0 && asistio !== null ? Math.max(5, (asistio / maxAsist) * 100) : 0;
              // Esfera por posición, con la paleta viva del sistema; el resto en gris.
              const esfera = ['#0071e3', '#af52de', '#ff9f0a'][i] ?? '#8e8e93';
              return (
                <button
                  key={c.casa_de_paz_id}
                  type="button"
                  disabled={!onSeleccionarCdp}
                  onClick={() => onSeleccionarCdp?.(c.casa_de_paz_id)}
                  className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/70 px-4 py-3.5 text-left shadow-[0_2px_10px_-4px_rgba(0,0,0,0.10)] transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-primary/30 enabled:hover:shadow-[0_12px_26px_-10px_rgba(0,0,0,0.22)]"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                    style={{
                      background: `radial-gradient(circle at 33% 28%, color-mix(in oklab, ${esfera} 42%, #fff) 0%, ${esfera} 46%, color-mix(in oklab, ${esfera} 68%, #000) 100%)`,
                      boxShadow: `0 9px 18px -5px color-mix(in oklab, ${esfera} 60%, transparent), inset 0 1px 3px rgba(255,255,255,0.55)`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{c.etiqueta}</p>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      {asistio !== null && (
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, color-mix(in oklab, ${VERDE} 55%, #fff) 0%, ${VERDE} 100%)`,
                            boxShadow: `0 0 10px color-mix(in oklab, ${VERDE} 55%, transparent)`,
                          }}
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {c.ultima_fecha ? `Última reunión: ${fechaLocal(c.ultima_fecha)}` : 'Sin reportes todavía'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {asistio !== null ? (
                      <>
                        <span className="text-[26px] leading-none font-bold tabular-nums text-foreground">{asistio}</span>
                        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">asistentes</span>
                      </>
                    ) : (
                      <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[11px] font-medium text-amber-600">sin reporte</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Ingresos por Casa de Paz ─────────────────────────────────────────────── */}
      {ingresos.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <SeccionIconHeader icon={Wallet} color={AMBAR} titulo="Ingresos por Casa de Paz" descripcion={`Ofrendas y diezmos de ${etiquetaPeriodo}`} />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ingresos.map((i, idx) => {
              const esOfrenda = i.tipo_codigo === 'OFRENDA';
              const tono = esOfrenda ? VERDE : AMBAR;
              const IconoTipo = esOfrenda ? Gift : Coins;
              const etiquetaTipo = esOfrenda ? 'Ofrenda' : i.tipo_codigo === 'DIEZMO' ? 'Diezmo' : i.tipo_codigo;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)]"
                  style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${tono} 6%, var(--card)) 0%, var(--card) 60%)` }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${tono} 0%, color-mix(in oklab, ${tono} 72%, #000) 100%)`,
                      boxShadow: `0 7px 15px -6px color-mix(in oklab, ${tono} 65%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.35)`,
                    }}
                  >
                    <IconoTipo className="h-5 w-5 text-white" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{etiquetaTipo}</p>
                    {i.casa_de_paz_nombre && <p className="truncate text-xs text-muted-foreground">{i.casa_de_paz_nombre}</p>}
                  </div>
                  <span className="shrink-0 text-lg font-bold tabular-nums" style={{ color: tono }}>
                    {i.moneda_simbolo} {Number(i.total).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
