import { Building2, Home, Network, Users, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE, AMBAR, MARINO, TEAL, DashboardHero, KpiMosaico } from './DashboardUI';
import { useDashboardPastor } from '@/hooks/useDashboard';

interface Props {
  onSeleccionarIglesia: (iglesiaId: string) => void;
}

export function DashboardPastor({ onSeleccionarIglesia }: Props) {
  const { data, isLoading, isError } = useDashboardPastor(true);

  if (isError) {
    return <p className="text-sm text-muted-foreground">Todavía no tenés ningún panel asignado en esta iglesia.</p>;
  }

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

  const { iglesias, ingresos_por_moneda } = data;
  const totalMiembros = (iglesias ?? []).reduce((acc, i) => acc + i.miembros_cdp, 0);
  const totalRedes = (iglesias ?? []).reduce((acc, i) => acc + i.redes, 0);
  const totalFamilias = (iglesias ?? []).reduce((acc, i) => acc + i.familias, 0);

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero icon={Building2} eyebrow="Pastoral" title="Mis Iglesias" />

      {/* ── Indicadores ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMosaico label="Iglesias" icon={Building2} color={MARINO}>{iglesias?.length ?? 0}</KpiMosaico>
        <KpiMosaico label="Redes totales" icon={Network} color={VERDE}>{totalRedes}</KpiMosaico>
        <KpiMosaico label="Miembros totales" icon={Users} color={AZUL}>{totalMiembros}</KpiMosaico>
        <KpiMosaico label="Familias totales" icon={Home} color={AMBAR}>{totalFamilias}</KpiMosaico>
      </div>

      {/* ── Iglesias ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Building2} color={AZUL} titulo="Iglesias" descripcion="Entrá para ver el detalle de cada iglesia" />
        <div className="p-5">
          {!iglesias || iglesias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin iglesias asignadas.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {iglesias.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onSeleccionarIglesia(i.id)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {i.nombre} {!i.activa && <span className="text-muted-foreground">(inactiva)</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {i.ciudad} · {i.redes} red(es) · {i.cdp} CdP · {i.miembros_cdp} miembros · {i.familias} familias
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{i.moneda_defecto}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Ingresos del mes por Iglesia ──────────────────────────────────────── */}
      {ingresos_por_moneda && ingresos_por_moneda.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Wallet} color={TEAL} titulo="Ingresos del mes por Iglesia" descripcion="Ofrendas y diezmos del mes en curso" />
          <div className="grid gap-2.5 p-5 sm:grid-cols-2">
            {ingresos_por_moneda.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{i.iglesia}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{i.tipo}</p>
                </div>
                <span className="shrink-0 text-[15px] font-bold tabular-nums" style={{ color: TEAL }}>
                  {i.moneda} {Number(i.total).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
