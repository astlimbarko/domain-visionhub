import { useAuthStore } from '@/store/auth.store';
import { PanelCasasDePazAfirmacion } from '@/components/afirmacion/PanelCasasDePazAfirmacion';

export function AfirmacionCasasDePaz() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Casas de Paz</h1>
        <p className="text-sm text-muted-foreground">Todas las Casas de Paz de la iglesia, organizadas por Red.</p>
      </div>

      <div className="glass-card-elevated rounded-2xl p-5 sm:p-6">
        <PanelCasasDePazAfirmacion iglesiaId={iglesiaActivaId} />
      </div>
    </div>
  );
}
