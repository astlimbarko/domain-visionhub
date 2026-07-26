import { useAuthStore } from '@/store/auth.store';
import { DashboardAfirmacion } from '@/components/afirmacion/DashboardAfirmacion';

export function Afirmacion() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Afirmación</h1>
        <p className="text-sm text-muted-foreground">Resumen de membresía y enlaces públicos de Casas de Paz.</p>
      </div>

      <DashboardAfirmacion iglesiaId={iglesiaActivaId} />
    </div>
  );
}
