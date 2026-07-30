import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useOpcionesRol } from '@/hooks/useOpcionesRol';
import { ROUTES } from '@/utils/constants';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';
import { Skeleton } from '@/components/ui/skeleton';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const rolActivo = useAuthStore((s) => s.rolActivo);
  // SuperAdmin nunca pasa por acá (early-return abajo), pero el hook se llama
  // siempre -- las reglas de hooks no permiten condicionarlo.
  const opciones = useOpcionesRol();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (membresiaPendiente) {
    return <MembresiaObligatoria invitacion={membresiaPendiente} />;
  }

  // SuperAdmin conserva su atajo directo (a /administracion): nunca elige rol.
  if (!esSuperAdmin) {
    if (opciones === undefined) {
      return (
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      );
    }

    const rolActivoValido = opciones.some((o) => o.rolUI === rolActivo);
    if (opciones.length > 1 && !rolActivoValido) {
      return <Navigate to={ROUTES.SELECCIONAR_ROL} replace />;
    }
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
