// VisionHub -- KAN-386 seguimiento (2026-09-17): entrypoint de "Membresía"
// -- hoy solo resuelve el caso Líder/Sublíder de CdP (su propia CdP, vía
// ContextoActivo). Líder/Supervisor de Red queda para una vuelta siguiente
// (necesita un selector de CdP dentro de su Red, no está en el alcance
// confirmado de esta primera entrega).
import { Skeleton } from '@/components/ui/skeleton';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { MembresiaCdp } from '@/pages/MembresiaCdp';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';

function CargandoMembresia() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function Membresia() {
  const { contextoActivo, cargando } = useContextoActivo();

  if (cargando || !contextoActivo) return <CargandoMembresia />;

  if (contextoActivo.alcance === 'CDP') {
    return <MembresiaCdp key={contextoActivo.cdpId} casaDePazId={contextoActivo.cdpId} />;
  }

  return (
    <ProximamentePlaceholder
      titulo="Membresía"
      descripcion="Todavía no disponible para tu rol -- por ahora es solo para Líder y Sublíder de Casa de Paz."
    />
  );
}
