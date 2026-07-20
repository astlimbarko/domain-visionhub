import { Activity, AlertTriangle, Home, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './KpiCard';
import { useDashboardLiderRed } from '@/hooks/useDashboard';

interface Props {
  redId: string;
  onSeleccionarCdp?: (cdpId: string) => void;
}

export function DashboardLiderRed({ redId, onSeleccionarCdp }: Props) {
  const { data, isLoading } = useDashboardLiderRed(redId);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full lg:col-span-4" />
      </div>
    );
  }

  const { red, kpi, casas_de_paz, cdp_sin_reporte_semana, ingresos } = data;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{red.nombre}</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Casas de Paz activas" valor={kpi.cdp_activas} icon={Home} />
        <KpiCard titulo="Miembros totales" valor={kpi.miembros_totales} icon={Users} />
        <KpiCard titulo="Asistencia promedio" valor={kpi.asistencia_promedio ?? '—'} icon={Activity} />
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ofrendas del mes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {!kpi.ofrendas_mes || kpi.ofrendas_mes.length === 0 ? (
              <p className="text-2xl font-semibold">—</p>
            ) : (
              kpi.ofrendas_mes.map((o) => (
                <p key={o.moneda} className="text-lg font-semibold">
                  {o.moneda} {Number(o.total).toFixed(2)}
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {cdp_sin_reporte_semana && cdp_sin_reporte_semana.length > 0 && (
        <Card className="rounded-2xl border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Sin reporte esta semana
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {cdp_sin_reporte_semana.map((c) => (
              <span key={c.id} className="rounded-full border border-amber-500/50 px-2.5 py-1 text-amber-700">
                {c.etiqueta}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Casas de Paz — ranking por asistencia</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {!casas_de_paz || casas_de_paz.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta red todavía no tiene Casas de Paz.</p>
          ) : (
            casas_de_paz.map((c) => (
              <button
                key={c.casa_de_paz_id}
                type="button"
                disabled={!onSeleccionarCdp}
                onClick={() => onSeleccionarCdp?.(c.casa_de_paz_id)}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm enabled:hover:bg-accent"
              >
                <span className="font-medium">{c.etiqueta}</span>
                <span className="text-muted-foreground">
                  {c.ultima_asistencia ?? 'sin reporte'}
                  {c.ultima_fecha && ` · ${new Date(c.ultima_fecha).toLocaleDateString('es-BO')}`}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {ingresos && ingresos.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ingresos por Casa de Paz</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {ingresos.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span>
                  {i.casa_de_paz_nombre} — {i.tipo_codigo}
                </span>
                <span className="text-muted-foreground">
                  {i.moneda_simbolo} {Number(i.total).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
