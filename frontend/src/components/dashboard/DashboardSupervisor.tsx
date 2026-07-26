import { useState } from 'react';
import { Activity, AlertTriangle, Home, Network, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KpiCard } from './KpiCard';
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

  const [periodo, setPeriodo] = useState<PeriodoDashboard>('MES');
  const [rango, setRango] = useState<RangoFechas | null>(null);
  const { desde, hasta } = rango ?? rangoPeriodoActual(periodo);
  const etiquetaPeriodo = rango ? 'el rango elegido' : (PERIODOS_DASHBOARD.find((p) => p.value === periodo)?.etiqueta ?? 'este mes');
  const redIds = (data?.redes_detalle ?? []).map((r) => r.id);
  const { data: ingresosPeriodo } = useIngresosSupervisorPeriodo(redIds, desde, hasta);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full lg:col-span-4" />
      </div>
    );
  }

  const { kpi, redes_detalle, departamentos_activos, alertas } = data;
  const alertasConDatos = Object.entries(alertas).filter(([, v]) => Array.isArray(v) && v.length > 0);
  const ingresos = ingresosPeriodo ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
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
        <RangoFechasPopover value={rango} onChange={setRango} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Redes" valor={kpi.redes} icon={Network} />
        <KpiCard titulo="Casas de Paz" valor={kpi.cdp} icon={Home} />
        <KpiCard titulo="Miembros totales" valor={kpi.miembros_totales} icon={Users} />
        <KpiCard titulo="Asistencia promedio" valor={kpi.asistencia_promedio ?? '—'} icon={Activity} />
      </div>

      {ingresos.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ingresos de {etiquetaPeriodo}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            {ingresos.map((i) => (
              <p key={i.moneda} className="text-lg font-semibold">
                {i.moneda} {Number(i.total).toFixed(2)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {alertasConDatos.length > 0 && (
        <Card className="rounded-2xl border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {alertasConDatos.map(([clave, valor]) => (
              <div key={clave}>
                <p className="text-sm font-medium">
                  {ALERTAS_LABELS[clave] ?? clave} ({(valor as unknown[]).length})
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Redes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {!redes_detalle || redes_detalle.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay redes.</p>
          ) : (
            redes_detalle.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={!onSeleccionarRed}
                onClick={() => onSeleccionarRed?.(r.id)}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm enabled:hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{r.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.cdp} CdP · {r.miembros} miembros · asistencia prom. {r.asistencia_promedio ?? '—'}
                  </p>
                </div>
                {r.incompleta && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    Incompleta
                  </Badge>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Departamentos activos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!departamentos_activos || departamentos_activos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin departamentos activos.</p>
          ) : (
            departamentos_activos.map((d) => (
              <span key={d.id} className="rounded-full border border-border px-2.5 py-1 text-sm">
                {d.nombre}
              </span>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
