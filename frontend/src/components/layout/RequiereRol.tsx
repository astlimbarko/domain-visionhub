/**
 * Guard genérico de ruta basado en roles.
 * Reemplaza a RequiereOperativo y RequiereSuperAdmin.
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useRolUI } from '@/hooks/useRolUI';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/utils/constants';
import type { RolUI } from '@/utils/permisos';

interface Props {
  permitidos: RolUI[];
  children: ReactNode;
}

export function RequiereRol({ permitidos, children }: Props) {
  const rolUI = useRolUI();

  // Mientras se carga el rol, mostrar skeleton
  if (rolUI === null) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!permitidos.includes(rolUI)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
