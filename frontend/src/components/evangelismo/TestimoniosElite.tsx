import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { useTestimoniosEvangelismo } from '@/hooks/useEvangelismo';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { fechaLegible } from '@/utils/calendario-fechas';

const AMARILLO = EVANGELISMO_COLOR.AMARILLO;

interface Props {
  casaDePazId: string;
}

/**
 * Pestaña "Testimonios Elite" (2026-09-10, pedido del owner): listado de
 * solo lectura de los milagros/testimonios cargados para evangelizados de
 * tipo Elite. La carga NO sucede acá -- es un campo opcional del propio
 * formulario "Nuevo evangelizado" (NuevoEvangelizadoDialog.tsx) que solo
 * aparece cuando se elige el tipo Elite; esta pestaña solo muestra lo que
 * ya quedó guardado.
 */
export function TestimoniosElite({ casaDePazId }: Props) {
  const { data: testimonios = [], isLoading } = useTestimoniosEvangelismo(casaDePazId);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <TarjetaHeader
        icon={Sparkles}
        color={AMARILLO}
        titulo="Testimonios Elite"
        descripcion={`${testimonios.length} cargado${testimonios.length === 1 ? '' : 's'}`}
      />
      <div className="flex flex-col gap-3 p-5">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : testimonios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se cargó ningún testimonio -- se agregan al registrar un evangelizado de tipo Elite.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {testimonios.map((t) => (
              <div key={t.id} className="flex flex-col gap-1.5 rounded-xl border border-border/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  {t.persona_id ? (
                    <PersonaNombreLink personaId={t.persona_id} className="min-w-0 truncate text-sm font-semibold">
                      {t.nombre_completo}
                    </PersonaNombreLink>
                  ) : (
                    <span className="truncate text-sm font-semibold text-foreground">{t.nombre_completo}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{fechaLegible(t.fecha_creacion.slice(0, 10))}</span>
                </div>
                <p className="text-sm text-foreground/90">{t.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
