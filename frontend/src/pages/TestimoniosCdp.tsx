import { MessageCircleHeart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { MORADO } from '@/components/dashboard/DashboardUI';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useTestimoniosCdp } from '@/hooks/useReporte';
import { fechaLegible } from '@/utils/calendario-fechas';

/**
 * "Testimonio" (dashboard del Líder de CdP, 2026-09-08): lista de testimonios
 * ya guardados en los reportes semanales (campo libre `testimonios`, existe
 * desde el diseño original) agrupados por reunión -- solo lectura, no agrega
 * una forma nueva de cargar testimonios, se siguen escribiendo desde el
 * formulario de Reportes.
 */
export function TestimoniosCdp() {
  const { contextoActivo } = useContextoActivo();
  const cdpActiva = contextoActivo?.alcance === 'CDP' ? contextoActivo.cdpId : undefined;
  const { data: testimonios = [], isLoading } = useTestimoniosCdp(cdpActiva);

  if (!cdpActiva) {
    return (
      <ProximamentePlaceholder
        titulo="Testimonio"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay testimonios que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={MessageCircleHeart}
          color={MORADO}
          titulo="Testimonios"
          descripcion="Lo que se anotó en el campo Testimonios de cada reporte semanal"
        />
        <div className="flex flex-col gap-3 p-5">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : testimonios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no se registró ningún testimonio en los reportes de tu Casa de Paz.
            </p>
          ) : (
            testimonios.map((t) => (
              <div key={t.reporte_id} className="flex flex-col gap-1.5 rounded-xl border border-border/60 px-4 py-3">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{fechaLegible(t.fecha_reunion)}</p>
                <p className="text-sm whitespace-pre-wrap text-foreground">{t.testimonios}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
