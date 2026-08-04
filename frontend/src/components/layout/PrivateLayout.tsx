import { Navigate, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useOpcionesRol } from '@/hooks/useOpcionesRol';
import { useMisRoles } from '@/hooks/useDashboard';
import { cerrarSesion } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';
import { AppLoadingScreen, AppErrorScreen } from '@/components/ui/logo-spinner';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);
  const rolActivo = useAuthStore((s) => s.rolActivo);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const opciones = useOpcionesRol();
  // Mismo query que usa useOpcionesRol por debajo (misma queryKey, React Query
  // lo dedupe -- no es un pedido de red extra) -- se necesita acá solo para
  // leer isError/refetch, que useOpcionesRol no expone.
  const { isError: fallaRoles, refetch: reintentarRoles } = useMisRoles(iglesiaActivaId ?? undefined);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (membresiaPendiente) {
    return <MembresiaObligatoria invitacion={membresiaPendiente} />;
  }

  async function handleCerrarSesion() {
    await cerrarSesion();
    logout();
    queryClient.clear();
  }

  // Bug real reportado (2026-08-03): antes "cargando" y "falló" devolvían lo
  // mismo (undefined) desde useOpcionesRol, así que una sesión vencida o un
  // corte de red dejaba a la persona viendo el logo de carga para siempre,
  // sin ninguna salida. Se distingue el caso de error explícitamente acá.
  if (fallaRoles) {
    return <AppErrorScreen onReintentar={() => reintentarRoles()} onCerrarSesion={handleCerrarSesion} />;
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
