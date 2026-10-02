import { useAuthStore } from '@/store/auth.store';
import { DEPARTAMENTO_META } from '@/utils/departamentos';

// KAN-491: pantalla de entrada a Afirmación pasó de ser un dashboard
// (DashboardAfirmacion) a una portada simple -- solo el nombre del
// departamento + el logo. El dashboard real ya no se usa acá (sigue
// existiendo el componente, por si se retoma en otro lado); las métricas
// viven ahora en cada proceso (Altar/Bautismo/RSIL/Membresía).
// Nota: no existe logo POR IGLESIA en el modelo (IglesiaAccesible no trae
// logo/logo_url); el único logo real del sistema es la marca (/logo.png,
// el mismo del sidebar), así que lo usamos acá sobre un sello teñido con el
// color institucional de Afirmación.
const COLOR_AFIRMACION = DEPARTAMENTO_META.AFIRMACION.color;

export function Afirmacion() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesias = useAuthStore((s) => s.iglesias);

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  const nombreIglesia = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre;

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border/60 bg-card py-20 shadow-sm">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-3xl"
        style={{ backgroundColor: `color-mix(in oklab, ${COLOR_AFIRMACION} 14%, transparent)` }}
      >
        <img src="/logo.png" alt={nombreIglesia ?? 'Logo'} className="h-12 w-12 object-contain" />
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">AFIRMACIÓN</h1>
        {nombreIglesia && <p className="mt-2 text-sm text-muted-foreground">{nombreIglesia}</p>}
      </div>
    </div>
  );
}
