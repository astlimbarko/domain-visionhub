import { useAuthStore } from '@/store/auth.store';
import { PanelUrlsAfirmacion } from '@/components/afirmacion/PanelUrlsAfirmacion';

export function AfirmacionUrls() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">URL de membresía</h1>
        <p className="text-sm text-muted-foreground">Activar y administrar los enlaces públicos de registro de cada líder de Casa de Paz.</p>
      </div>

      <div className="glass-card-elevated rounded-2xl p-5 sm:p-6">
        <PanelUrlsAfirmacion iglesiaId={iglesiaActivaId} />
      </div>
    </div>
  );
}
