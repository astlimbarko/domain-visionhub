/**
 * Guard por capacidad booleana, ortogonal a RequiereRol (que filtra por
 * RolUI). Usar cuando el acceso no depende del rol de sistema sino de una
 * asignacion aparte (ej. Lider de Afirmacion via departamento_cargo).
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';

interface Props {
  permitido: boolean;
  children: ReactNode;
}

export function RequiereCapacidad({ permitido, children }: Props) {
  if (!permitido) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  return <>{children}</>;
}
