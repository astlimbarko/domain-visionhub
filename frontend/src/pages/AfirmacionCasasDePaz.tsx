import { Home } from 'lucide-react';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { useAuthStore } from '@/store/auth.store';
import { PanelCasasDePazAfirmacion } from '@/components/afirmacion/PanelCasasDePazAfirmacion';

export function AfirmacionCasasDePaz() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Home}
          color={AZUL}
          titulo="Casas de Paz"
          descripcion="Todas las Casas de Paz de la iglesia, organizadas por Red."
        />
        <div className="p-5">
          <PanelCasasDePazAfirmacion iglesiaId={iglesiaActivaId} />
        </div>
      </section>
    </div>
  );
}
