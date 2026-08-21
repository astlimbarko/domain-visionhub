import { Link2 } from 'lucide-react';
import { MARINO } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { useAuthStore } from '@/store/auth.store';
import { PanelUrlsAfirmacion } from '@/components/afirmacion/PanelUrlsAfirmacion';

export function AfirmacionUrls() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Link2}
          color={MARINO}
          titulo="URL de membresía"
          descripcion="Cada líder de Casa de Paz tiene su propio enlace público de registro -- activalo para que pueda compartirlo y recibir gente directo en su CdP."
        />
        <div className="p-5">
          <PanelUrlsAfirmacion iglesiaId={iglesiaActivaId} />
        </div>
      </section>
    </div>
  );
}
