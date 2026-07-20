import { CalendarCheck2, CalendarClock, PhoneCall, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './KpiCard';
import { SemaforoBadge } from './SemaforoBadge';
import { Timeline, type TimelineItem } from '@/components/shared/Timeline';
import { useDashboardLiderCdp, useDashboardSubliderCdp } from '@/hooks/useDashboard';

interface Props {
  casaDePazId: string;
  esSublider?: boolean;
}

function fmt(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

export function DashboardLiderCdp({ casaDePazId, esSublider = false }: Props) {
  const liderQuery = useDashboardLiderCdp(esSublider ? undefined : casaDePazId);
  const subliderQuery = useDashboardSubliderCdp(esSublider ? casaDePazId : undefined);
  const { data, isLoading } = esSublider ? subliderQuery : liderQuery;

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full lg:col-span-3" />
        <Skeleton className="h-64 w-full lg:col-span-3" />
      </div>
    );
  }

  const { casa_de_paz, kpi, miembros, alertas, asistencia_historico, proximos } = data;

  const pctAsistencia =
    casa_de_paz.miembros_total > 0 && kpi.asistencia_ultima.valor !== null
      ? Math.round((kpi.asistencia_ultima.valor / casa_de_paz.miembros_total) * 100)
      : null;

  const paraLlamar: TimelineItem[] = [
    ...(alertas.reconciliados ?? []).map((r) => ({
      id: `rec-${r.persona_id}`,
      titulo: r.nombre,
      descripcion: 'Reconciliado',
      fecha: fmt(r.fecha_reconciliacion),
      dotColor: 'var(--chart-3)',
    })),
    ...(alertas.simpatizantes ?? []).map((s) => ({
      id: `sim-${s.persona_id}`,
      titulo: s.nombre,
      descripcion: 'Simpatizante',
      fecha: fmt(s.fecha_ingreso),
      dotColor: 'var(--chart-1)',
    })),
  ];

  const historialItems: TimelineItem[] = (asistencia_historico ?? []).map((h) => ({
    id: h.fecha_reunion,
    titulo: `${h.total_asistentes} asistentes`,
    descripcion: `${h.total_mayores} mayores · ${h.total_menores} menores`,
    fecha: fmt(h.fecha_reunion),
  }));

  const proximosItems: TimelineItem[] = (proximos ?? []).map((p, idx) => ({
    id: `${idx}-${p.titulo}`,
    titulo: p.titulo,
    fecha: fmt(p.fecha),
    dotColor: 'var(--chart-4)',
  }));

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{casa_de_paz.nombre ?? 'Casa de Paz'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>Red: {casa_de_paz.red ?? 'sin red'}</span>
          <span>{casa_de_paz.miembros_total} miembros</span>
          <span>Última reunión: {casa_de_paz.ultima_reunion ? new Date(casa_de_paz.ultima_reunion).toLocaleDateString('es-BO') : 'sin registrar'}</span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard titulo="Miembros activos" valor={kpi.miembros_activos.valor} variacionPct={kpi.miembros_activos.variacion_pct} icon={Users} />
        <KpiCard
          titulo="Asistencia última reunión"
          valor={kpi.asistencia_ultima.valor}
          variacionPct={kpi.asistencia_ultima.variacion_pct}
          subtitulo={kpi.asistencia_ultima.fecha ? new Date(kpi.asistencia_ultima.fecha).toLocaleDateString('es-BO') : undefined}
          icon={CalendarCheck2}
          porcentaje={pctAsistencia}
          color="var(--chart-2)"
        />
        {kpi.ingresos_mes !== undefined && (
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del mes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              {!kpi.ingresos_mes || kpi.ingresos_mes.length === 0 ? (
                <p className="text-2xl font-semibold">—</p>
              ) : (
                kpi.ingresos_mes.map((i, idx) => (
                  <p key={idx} className="text-sm">
                    {i.tipo_codigo}: {i.moneda_simbolo} {Number(i.total).toFixed(2)}
                  </p>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {paraLlamar.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base"><PhoneCall className="h-4 w-4 text-muted-foreground" /> Para llamar</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={paraLlamar} />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Miembros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!miembros || miembros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin miembros todavía.</p>
          ) : (
            miembros.map((m) => (
              <div key={m.persona_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{m.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.estado_nombre ?? 'sin estado'}
                    {m.semanas_sin_venir !== null && ` · ${m.semanas_sin_venir} semana(s) sin venir`}
                  </p>
                </div>
                <SemaforoBadge semaforo={m.semaforo} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {asistencia_historico !== undefined && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Últimas reuniones</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={historialItems} vacio="Sin reportes todavía." />
          </CardContent>
        </Card>
      )}

      {proximosItems.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Próximos</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={proximosItems} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
