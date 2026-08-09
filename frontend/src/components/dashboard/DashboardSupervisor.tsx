import { useRef, useState } from 'react';
import { Activity, AlertTriangle, Home, Layers, Network, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { AZUL, AMBAR, MORADO, TEAL, DashboardHero, KpiMosaico } from './DashboardUI';
import { RangoFechasPopover, type RangoFechas } from './RangoFechasPopover';
import { useDashboardSupervisor, useIngresosSupervisorPeriodo } from '@/hooks/useDashboard';
import { PERIODOS_DASHBOARD, rangoPeriodoActual, type PeriodoDashboard } from '@/utils/periodo-dashboard';

interface Props {
  iglesiaId: string;
  onSeleccionarRed?: (redId: string) => void;
}

const ALERTAS_LABELS: Record<string, string> = {
  cdp_sin_reporte: 'Casas de Paz sin reportar esta semana',
  redes_incompletas: 'Redes sin Encargado de Departamentos o de Ministerio',
  evangelismo_discrepante: 'Reportes con evangelizados declarados distintos de los registrados',
  cdp_sin_red: 'Casas de Paz sin Red vigente',
  iglesia_sin_autoridad: 'Iglesias sin Pastor o Supervisor asignado',
  miembros_inactivos: 'Casas de Paz con miembros inactivos',
};

export function DashboardSupervisor({ iglesiaId, onSeleccionarRed }: Props) {
  const { data, isLoading } = useDashboardSupervisor(iglesiaId);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [rango, setRango] = useState<RangoFechas | null>(null);
  const { desde, hasta } = rango ?? rangoPeriodoActual(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : (PERIODOS_DASHBOARD.find((p) => p.value === periodo)?.etiqueta ?? 'este mes');
  const redIds = (data?.redes_detalle ?? []).map((r) => r.id);
  const { data: ingresosPeriodo } = useIngresosSupervisorPeriodo(redIds, desde, hasta);

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

  const { kpi, redes_detalle, departamentos_activos, alertas } = data;
  const alertasConDatos = Object.entries(alertas).filter(([, v]) => Array.isArray(v) && v.length > 0);
  const ingresos = ingresosPeriodo ?? [];

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      <DashboardHero icon={Network} eyebrow="Supervisión" title="Redes y Casas de Paz" />

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
          <DescargarPdfButton contenedorRef={contenedorRef} nombreArchivo="dashboard-supervisor" />
        </div>
      </div>

      {/* ── Indicadores ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMosaico label="Redes" icon={Network} color={MORADO}>{kpi.redes}</KpiMosaico>
        <KpiMosaico label="Casas de Paz" icon={Home} color={TEAL}>{kpi.cdp}</KpiMosaico>
        <KpiMosaico label="Miembros totales" icon={Users} color={AMBAR}>{kpi.miembros_totales}</KpiMosaico>
        <KpiMosaico label="Asistencia promedio" icon={Activity} color={AZUL}>{kpi.asistencia_promedio ?? '—'}</KpiMosaico>
      </div>

      {/* ── Alertas ───────────────────────────────────────────────────────────── */}
      {alertasConDatos.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={AlertTriangle} color={AMBAR} titulo="Alertas" descripcion="Situaciones que necesitan tu atención" />
          <div className="flex flex-col gap-2.5 p-5">
            {alertasConDatos.map(([clave, valor]) => (
              <div key={clave} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">{ALERTAS_LABELS[clave] ?? clave}</p>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ backgroundColor: AMBAR }}>
                  {(valor as unknown[]).length}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Redes ─────────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Network} color={AZUL} titulo="Redes" descripcion="Entrá para ver el dashboard de cada Red" />
        <div className="p-5">
          {!redes_detalle || redes_detalle.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay redes.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {redes_detalle.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={!onSeleccionarRed}
                  onClick={() => onSeleccionarRed?.(r.id)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-primary/40 enabled:hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{r.nombre}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.cdp} CdP · {r.miembros} miembros · asist. prom. {r.asistencia_promedio ?? '—'}
                    </p>
                  </div>
                  {r.incompleta && (
                    <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-600">Incompleta</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Ingresos ──────────────────────────────────────────────────────────── */}
      {ingresos.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Wallet} color={TEAL} titulo={`Ingresos de ${etiquetaPeriodo}`} descripcion="Total de la iglesia por moneda" />
          <div className="grid gap-2.5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {ingresos.map((i) => (
              <div key={i.moneda} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">{i.moneda}</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: TEAL }}>
                  {i.moneda} {Number(i.total).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Departamentos activos ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Layers} color={MORADO} titulo="Departamentos activos" descripcion="Departamentos con actividad en la iglesia" />
        <div className="flex flex-wrap gap-2 p-5">
          {!departamentos_activos || departamentos_activos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin departamentos activos.</p>
          ) : (
            departamentos_activos.map((d) => (
              <span
                key={d.id}
                className="rounded-full px-3 py-1 text-[12px] font-semibold text-white"
                style={{ backgroundColor: MORADO }}
              >
                {d.nombre}
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
