import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Coins,
  Gift,
  Home,
  Network,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE, AMBAR, MORADO, MARINO, TEAL, DEGRADADO_IDENTIDAD, DashboardHero, KpiMosaico } from './DashboardUI';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import { useAuthStore } from '@/store/auth.store';
import { useDashboardLiderRed, useIngresosRedPeriodo } from '@/hooks/useDashboard';
import { PERIODOS_DASHBOARD, rangoPeriodoActual, type PeriodoDashboard } from '@/utils/periodo-dashboard';

/**
 * DATE 'YYYY-MM-DD' → 'DD/MM/YYYY' sin zona horaria. `new Date('2026-07-13')`
 * se interpreta como UTC medianoche y en UTC-4 retrocede un día (mostraba
 * 12/7 por un reporte del 13/7); partir el string evita ese corrimiento.
 */
function fechaLocal(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Sello propio de una Casa de Paz: casa con corazón (SVG a medida, sin depender de una fuente de íconos). */
function SelloCasaDePaz({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 11 12 4.5 20 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v8.5h12V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.2c-1.5-1-2.7-2-2.7-3.3a1.45 1.45 0 0 1 2.7-.66 1.45 1.45 0 0 1 2.7.66c0 1.3-1.2 2.3-2.7 3.3Z" fill="currentColor" />
    </svg>
  );
}

type BolsaMoneda = Map<string, number>;
interface FinanzasResumen {
  ofrenda: BolsaMoneda;
  diezmo: BolsaMoneda;
  total: BolsaMoneda;
}

function bolsaVacia(): FinanzasResumen {
  return { ofrenda: new Map(), diezmo: new Map(), total: new Map() };
}

function StatFinanciero({ label, valores, color, icon: Icon }: { label: string; valores: BolsaMoneda; color: string; icon: typeof Wallet }) {
  const entradas = Array.from(valores.entries());
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-3"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 25%, transparent)` }}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase" style={{ color }}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {entradas.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sin registros</span>
      ) : (
        <div className="flex flex-col">
          {entradas.map(([simbolo, monto]) => (
            <span key={simbolo} className="text-lg font-bold tabular-nums" style={{ color }}>{simbolo} {monto.toFixed(2)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** [Ofrenda][Diezmo][Total] -- pedido exacto del owner, 2026-08-02. Se reusa
 * igual para el total global de la Red y para el desglose de una sola CdP. */
function BloqueFinanciero({ resumen }: { resumen: FinanzasResumen }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <StatFinanciero label="Ofrenda" valores={resumen.ofrenda} color={VERDE} icon={Gift} />
      <StatFinanciero label="Diezmo" valores={resumen.diezmo} color={AMBAR} icon={Coins} />
      <StatFinanciero label="Total" valores={resumen.total} color={MORADO} icon={Wallet} />
    </div>
  );
}

interface Props {
  redId: string;
  onSeleccionarCdp?: (cdpId: string) => void;
}

export function DashboardLiderRed({ redId, onSeleccionarCdp }: Props) {
  const nombreLider = useAuthStore((s) => s.nombreCompleto);
  const { data, isLoading } = useDashboardLiderRed(redId);

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [rango, setRango] = useState<RangoFechas | null>(null);
  // Solo el Líder de Red ve esto (vive únicamente en este componente, nunca
  // se reusa desde DashboardLiderCdp) -- al presionar "Ver finanzas" en una
  // CdP se despliega su [Ofrenda][Diezmo][Total] debajo de las cards.
  const [cdpFinanzas, setCdpFinanzas] = useState<string | null>(null);
  const { desde, hasta } = rango ?? rangoPeriodoActual(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : (PERIODOS_DASHBOARD.find((p) => p.value === periodo)?.etiqueta ?? 'este mes');
  const { data: ingresosPeriodo } = useIngresosRedPeriodo(redId, desde, hasta);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const { red, kpi, casas_de_paz, cdp_sin_reporte_semana } = data;
  const ingresos = ingresosPeriodo ?? data.ingresos ?? [];

  const ingresosPorMoneda = new Map<string, number>();
  for (const i of ingresos) ingresosPorMoneda.set(i.moneda_simbolo, (ingresosPorMoneda.get(i.moneda_simbolo) ?? 0) + Number(i.total));
  const ingresosEntradas = Array.from(ingresosPorMoneda.entries());

  const casas = [...(casas_de_paz ?? [])].sort((a, b) => (b.ultima_asistencia ?? -1) - (a.ultima_asistencia ?? -1));
  const sinReporte = cdp_sin_reporte_semana ?? [];

  // Contabilidad global de la Red -- [Ofrenda][Diezmo][Total], pedido exacto
  // del owner (2026-08-02). Se arma tanto el total global como uno por CdP
  // (para el desglose que se despliega al presionar "Ver finanzas" en una
  // CdP, debajo de las cards) a partir del mismo recorrido de `ingresos`.
  const finanzasGlobal = bolsaVacia();
  const finanzasPorCdp = new Map<string, FinanzasResumen>();
  for (const c of casas) finanzasPorCdp.set(c.etiqueta, bolsaVacia());
  for (const i of ingresos) {
    const clave = i.casa_de_paz_nombre ?? 'Sin Casa de Paz';
    const bolsa = finanzasPorCdp.get(clave) ?? bolsaVacia();
    finanzasPorCdp.set(clave, bolsa);
    const monto = Number(i.total);
    const destino = i.tipo_codigo === 'OFRENDA' ? bolsa.ofrenda : i.tipo_codigo === 'DIEZMO' ? bolsa.diezmo : null;
    const destinoGlobal = i.tipo_codigo === 'OFRENDA' ? finanzasGlobal.ofrenda : i.tipo_codigo === 'DIEZMO' ? finanzasGlobal.diezmo : null;
    if (destino) destino.set(i.moneda_simbolo, (destino.get(i.moneda_simbolo) ?? 0) + monto);
    if (destinoGlobal) destinoGlobal.set(i.moneda_simbolo, (destinoGlobal.get(i.moneda_simbolo) ?? 0) + monto);
    bolsa.total.set(i.moneda_simbolo, (bolsa.total.get(i.moneda_simbolo) ?? 0) + monto);
    finanzasGlobal.total.set(i.moneda_simbolo, (finanzasGlobal.total.get(i.moneda_simbolo) ?? 0) + monto);
  }
  const finanzasCdpAbierta = cdpFinanzas ? finanzasPorCdp.get(cdpFinanzas) : undefined;

  // Indicadores derivados de los datos reales de la Red.
  const asistenciaTotal = casas.reduce((s, c) => s + (c.ultima_asistencia ?? 0), 0);
  const reportadas = Math.max(0, kpi.cdp_activas - sinReporte.length);

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero icon={Network} eyebrow="Red" title={red.nombre} subtitle={nombreLider ? `Líder: ${nombreLider}` : undefined} />

      {/* ── Barra de período ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Mostrando datos de {etiquetaPeriodo}.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
            <SelectTrigger size="sm" className="w-32 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS_DASHBOARD.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <RangoFechasPopover value={rango} onChange={setRango} />
        </div>
      </div>

      {/* ── Indicadores: mosaicos de color pleno (una sola fila) ──────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiMosaico label="Casas de Paz activas" icon={Home} color={AZUL}>{kpi.cdp_activas}</KpiMosaico>
        <KpiMosaico label="Miembros totales" icon={Users} color={MORADO}>{kpi.miembros_totales}</KpiMosaico>
        <KpiMosaico label="Asistencia promedio" icon={Activity} color={VERDE}>{kpi.asistencia_promedio ?? '—'}</KpiMosaico>
        <KpiMosaico label="Asistencia total" icon={UserCheck} color={MARINO}>{asistenciaTotal || '—'}</KpiMosaico>
        <KpiMosaico label="Reportes al día" icon={ClipboardCheck} color={AMBAR}>{reportadas}/{kpi.cdp_activas}</KpiMosaico>
        <KpiMosaico label={`Ingresos de ${etiquetaPeriodo}`} icon={Wallet} color={TEAL}>
          {ingresosEntradas.length === 0 ? (
            '—'
          ) : (
            <div className="flex flex-col gap-0.5">
              {ingresosEntradas.map(([simbolo, total]) => (
                <span key={simbolo} className="text-lg leading-tight">{simbolo} {total.toFixed(2)}</span>
              ))}
            </div>
          )}
        </KpiMosaico>
      </div>

      {/* ── Aviso: sin reporte esta semana ───────────────────────────────────────── */}
      {sinReporte.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={AlertTriangle}
            color={AMBAR}
            titulo="Sin reporte esta semana"
            descripcion={`${sinReporte.length} Casa${sinReporte.length === 1 ? '' : 's'} de Paz todavía no cargó su reporte.`}
          />
          <div className="flex flex-wrap gap-2 p-5">
            {sinReporte.map((c) => (
              <span key={c.id} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ backgroundColor: AMBAR }}>
                {c.etiqueta}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Casas de Paz: navegación a cada dashboard + finanzas por CdP ───────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Home} color={AZUL} titulo="Casas de Paz" descripcion="Entrá para ver el dashboard de cada casa, o mirá sus finanzas acá mismo" />
        <div className="flex flex-col gap-4 p-5">
          {casas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta Red todavía no tiene Casas de Paz.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {casas.map((c) => (
                <div key={c.casa_de_paz_id} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!onSeleccionarCdp}
                    onClick={() => onSeleccionarCdp?.(c.casa_de_paz_id)}
                    className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-primary/40 enabled:hover:shadow-md"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ background: DEGRADADO_IDENTIDAD, boxShadow: '0 8px 16px -8px color-mix(in oklab, var(--chart-1) 55%, transparent)' }}
                    >
                      <SelloCasaDePaz className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{c.etiqueta}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.ultima_asistencia != null ? `${c.ultima_asistencia} asistentes` : 'Sin reporte'}
                        {c.ultima_fecha ? ` · ${fechaLocal(c.ultima_fecha)}` : ''}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn('h-7 w-fit gap-1.5 self-start rounded-lg px-2 text-[12px]', cdpFinanzas === c.etiqueta && 'bg-muted text-foreground')}
                    onClick={() => setCdpFinanzas((prev) => (prev === c.etiqueta ? null : c.etiqueta))}
                  >
                    <Wallet className="h-3.5 w-3.5" style={{ color: MORADO }} />
                    Ver finanzas
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Finanzas de la CdP elegida -- debajo de las cards, pedido exacto del owner. */}
          {finanzasCdpAbierta && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[13px] font-semibold text-foreground">{cdpFinanzas} · {etiquetaPeriodo}</p>
              <BloqueFinanciero resumen={finanzasCdpAbierta} />
            </div>
          )}
        </div>
      </section>

      {/* ── Contabilidad total de la Red: [Ofrenda][Diezmo][Total] global ──────── */}
      {casas.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Wallet} color={MORADO} titulo="Contabilidad de la Red" descripcion={`Ofrendas y diezmos de todas las Casas de Paz, ${etiquetaPeriodo}`} />
          <div className="p-5">
            <BloqueFinanciero resumen={finanzasGlobal} />
          </div>
        </section>
      )}
    </div>
  );
}
