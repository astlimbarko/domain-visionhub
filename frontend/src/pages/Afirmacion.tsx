import { Church } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DEPARTAMENTO_META } from '@/utils/departamentos';

// KAN-491: pantalla de entrada a Afirmación pasó de ser un dashboard
// (DashboardAfirmacion) a una portada simple -- solo el nombre del
// departamento + el logo de la iglesia activa. El dashboard real ya no
// se usa acá (sigue existiendo el componente, por si se retoma en otro
// lado), las métricas viven ahora en cada proceso (Altar/Bautismo/RSIL/
// Membresía).
const COLOR_AFIRMACION = DEPARTAMENTO_META.AFIRMACION.color;

export function Afirmacion() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesias = useAuthStore((s) => s.iglesias);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  // TODO: logo de la iglesia cuando esté disponible (hoy IglesiaAccesible
  // no trae ningún campo de logo/logo_url) -- por ahora placeholder con ícono.
  const logoUrl = undefined as string | undefined;
  const nombreIglesia = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre;

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border/60 bg-card py-20 shadow-sm">
      {logoUrl ? (
        <img src={logoUrl} alt={nombreIglesia ?? 'Logo de la iglesia'} className="h-24 w-24 rounded-2xl object-contain" />
      ) : (
        <div
          className="flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{ backgroundColor: `color-mix(in oklab, ${COLOR_AFIRMACION} 14%, transparent)` }}
        >
          <Church className="h-11 w-11" style={{ color: COLOR_AFIRMACION }} />
        </div>
      )}

      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">AFIRMACIÓN</h1>
        {nombreIglesia && <p className="mt-2 text-sm text-muted-foreground">{nombreIglesia}</p>}
      </div>
    </div>
  );
}
