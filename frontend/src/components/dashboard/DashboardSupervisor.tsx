import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './KpiCard';
import { useDashboardSupervisor } from '@/hooks/useDashboard';

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

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full lg:col-span-4" />
      </div>
    );
  }

  const { kpi, redes_detalle, departamentos_activos, alertas } = data;
  const alertasConDatos = Object.entries(alertas).filter(([, v]) => Array.isArray(v) && v.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Redes" valor={kpi.redes} />
        <KpiCard titulo="Casas de Paz" valor={kpi.cdp} />
        <KpiCard titulo="Miembros totales" valor={kpi.miembros_totales} />
        <KpiCard titulo="Asistencia promedio" valor={kpi.asistencia_promedio ?? '—'} />
      </div>

      {kpi.ingresos_mes && kpi.ingresos_mes.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ingresos del mes</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            {kpi.ingresos_mes.map((i) => (
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
