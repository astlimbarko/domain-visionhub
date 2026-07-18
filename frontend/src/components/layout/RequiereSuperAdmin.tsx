import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';

export function RequiereSuperAdmin({ children }: { children: ReactNode }) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);

  if (!esSuperAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
