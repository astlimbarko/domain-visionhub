// VisionHub -- KAN-386/389 seguimiento (2026-09-17, pedido explícito del
// owner): "Membresía" por Casa de Paz -- wrapper fino sobre MembresiaTabla
// (componente compartido de verdad con AfirmacionPersonas.tsx, ver ese
// archivo), en modo scoped a una sola CdP.
import { useAuthStore } from '@/store/auth.store';
import { MembresiaTabla } from '@/components/personas/MembresiaTabla';

interface Props {
  casaDePazId: string;
  casaDePazEtiqueta?: string;
}

export function MembresiaCdp({ casaDePazId, casaDePazEtiqueta }: Props) {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesiaNombre = useAuthStore((s) => s.iglesias.find((i) => i.id === iglesiaActivaId)?.nombre) ?? 'Centro de Vida';

  return (
    <MembresiaTabla
      iglesiaId={iglesiaActivaId}
      casaDePazId={casaDePazId}
      casaDePazEtiqueta={casaDePazEtiqueta}
      iglesiaNombre={iglesiaNombre}
      descripcion="Miembros de tu Casa de Paz -- click en una fila para ver la ficha completa."
    />
  );
}
