import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './KpiCard';
import { useDashboardPastor } from '@/hooks/useDashboard';

interface Props {
  onSeleccionarIglesia: (iglesiaId: string) => void;
}

export function DashboardPastor({ onSeleccionarIglesia }: Props) {
  const { data, isLoading } = useDashboardPastor(true);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full lg:col-span-4" />
      </div>
    );
  }

  const { iglesias, ingresos_por_moneda } = data;
  const totalMiembros = (iglesias ?? []).reduce((acc, i) => acc + i.miembros_cdp, 0);
  const totalRedes = (iglesias ?? []).reduce((acc, i) => acc + i.redes, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Iglesias" valor={iglesias?.length ?? 0} />
        <KpiCard titulo="Redes totales" valor={totalRedes} />
        <KpiCard titulo="Miembros totales" valor={totalMiembros} />
        <KpiCard titulo="Familias totales" valor={(iglesias ?? []).reduce((acc, i) => acc + i.familias, 0)} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Mis Iglesias</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!iglesias || iglesias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin iglesias asignadas.</p>
          ) : (
            iglesias.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onSeleccionarIglesia(i.id)}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div>
                  <p className="font-medium">
                    {i.nombre} {!i.activa && '(inactiva)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i.ciudad} · {i.redes} red(es) · {i.cdp} CdP · {i.miembros_cdp} miembros · {i.familias} familias
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{i.moneda_defecto}</span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {ingresos_por_moneda && ingresos_por_moneda.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ingresos del mes por Iglesia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {ingresos_por_moneda.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span>
                  {i.iglesia} — {i.tipo}
                </span>
                <span className="text-muted-foreground">
                  {i.moneda} {Number(i.total).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
