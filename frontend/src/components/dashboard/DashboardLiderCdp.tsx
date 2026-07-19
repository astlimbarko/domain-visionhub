import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './KpiCard';
import { SemaforoBadge } from './SemaforoBadge';
import { useDashboardLiderCdp, useDashboardSubliderCdp } from '@/hooks/useDashboard';

interface Props {
  casaDePazId: string;
  esSublider?: boolean;
}

export function DashboardLiderCdp({ casaDePazId, esSublider = false }: Props) {
  const liderQuery = useDashboardLiderCdp(esSublider ? undefined : casaDePazId);
  const subliderQuery = useDashboardSubliderCdp(esSublider ? casaDePazId : undefined);
  const { data, isLoading } = esSublider ? subliderQuery : liderQuery;

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full lg:col-span-3" />
        <Skeleton className="h-64 w-full lg:col-span-3" />
      </div>
    );
  }

  const { casa_de_paz, kpi, miembros, alertas, asistencia_historico, proximos } = data;

  return (
    <div className="flex flex-col gap-4">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard titulo="Miembros activos" valor={kpi.miembros_activos.valor} variacionPct={kpi.miembros_activos.variacion_pct} />
        <KpiCard
          titulo="Asistencia última reunión"
          valor={kpi.asistencia_ultima.valor}
          variacionPct={kpi.asistencia_ultima.variacion_pct}
          subtitulo={kpi.asistencia_ultima.fecha ? new Date(kpi.asistencia_ultima.fecha).toLocaleDateString('es-BO') : undefined}
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

      {(alertas.reconciliados?.length || alertas.simpatizantes?.length) ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Para llamar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {alertas.reconciliados?.map((r) => (
              <p key={r.persona_id}>
                <span className="font-medium">{r.nombre}</span> — reconciliado el {new Date(r.fecha_reconciliacion).toLocaleDateString('es-BO')}
              </p>
            ))}
            {alertas.simpatizantes?.map((s) => (
              <p key={s.persona_id}>
                <span className="font-medium">{s.nombre}</span> — simpatizante desde {new Date(s.fecha_ingreso).toLocaleDateString('es-BO')}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
          <CardContent className="flex flex-col gap-1.5">
            {!asistencia_historico || asistencia_historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin reportes todavía.</p>
            ) : (
              asistencia_historico.map((h) => (
                <div key={h.fecha_reunion} className="flex items-center justify-between text-sm">
                  <span>{new Date(h.fecha_reunion).toLocaleDateString('es-BO')}</span>
                  <span className="text-muted-foreground">
                    {h.total_asistentes} asistentes ({h.total_mayores} mayores, {h.total_menores} menores)
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {proximos && proximos.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Próximos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {proximos.map((p, idx) => (
              <p key={idx}>
                {p.titulo} — {new Date(p.fecha).toLocaleDateString('es-BO')}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
