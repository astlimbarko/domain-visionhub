import { Skeleton } from '@/components/ui/skeleton';
import { useRolUI } from '@/hooks/useRolUI';
import { GestionEstructuraVista } from '@/components/casas-de-paz/GestionEstructuraVista';
import { GestionSubliderVista } from '@/components/casas-de-paz/GestionSubliderVista';

/**
 * El líder/sublíder de Casa de Paz ve una vista propia enfocada solo en sus
 * sublíderes (GestionSubliderVista); Supervisor y Líder de Red ven la vista
 * estructural completa de Redes/Casas de Paz (GestionEstructuraVista).
 * Cada vista maneja sus propios hooks de datos, igual que pages/Dashboard.tsx.
 */
export function CasasDePaz() {
  const rolUI = useRolUI();

  if (rolUI === null) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (rolUI === 'LIDER_CDP' || rolUI === 'SUBLIDER_CDP') {
    return <GestionSubliderVista />;
  }

  return <GestionEstructuraVista />;
}
