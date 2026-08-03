import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useOpcionesRol } from '@/hooks/useOpcionesRol';
import { ROUTES } from '@/utils/constants';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';
import { AppLoadingScreen } from '@/components/ui/logo-spinner';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);
  const rolActivo = useAuthStore((s) => s.rolActivo);
  const opciones = useOpcionesRol();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (membresiaPendiente) {
    return <MembresiaObligatoria invitacion={membresiaPendiente} />;
  }

  // Un Super Admin sin otros roles resuelve solo (opciones.length <= 1) y
  // sigue de largo con su atajo a /administracion -- solo si además tiene
  // otro rol (opciones.length > 1) se lo manda a elegir, igual que a cualquiera.
  if (opciones === undefined) {
    return <AppLoadingScreen />;
  }

  const rolActivoValido = opciones.some((o) => o.rolUI === rolActivo);
  if (opciones.length > 1 && !rolActivoValido) {
    return <Navigate to={ROUTES.SELECCIONAR_ROL} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
