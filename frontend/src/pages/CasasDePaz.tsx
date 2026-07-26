import { Skeleton } from '@/components/ui/skeleton';
import { useRolUI } from '@/hooks/useRolUI';
import { GestionEstructuraVista } from '@/components/casas-de-paz/GestionEstructuraVista';
import { GestionRedVista } from '@/components/casas-de-paz/GestionRedVista';
import { GestionSubliderVista } from '@/components/casas-de-paz/GestionSubliderVista';

/**
 * Cada rol ve su propia vista de esta sección, con su alcance:
 * - Líder/Sublíder de CdP → GestionSubliderVista (solo sus sublíderes).
 * - Líder de Red → GestionRedVista (SOLO las Casas de Paz de su propia Red;
 *   no ve ni elige otras redes).
 * - Supervisor → GestionEstructuraVista (todas las Redes/CdP de la iglesia).
 * Cada vista maneja sus propios hooks, igual que pages/Dashboard.tsx.
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

  if (rolUI === 'LIDER_RED') {
    return <GestionRedVista />;
  }

  return <GestionEstructuraVista />;
}
