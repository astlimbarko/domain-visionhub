import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (membresiaPendiente) {
    return <MembresiaObligatoria invitacion={membresiaPendiente} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
