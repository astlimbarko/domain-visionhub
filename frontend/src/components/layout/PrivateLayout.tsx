import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useMisRoles } from '@/hooks/useDashboard';
import { cerrarSesion } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';
import { obtenerPanelContexto, rutaInicialParaContexto } from '@/utils/paneles-contexto';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';
import { AppLoadingScreen, AppErrorScreen } from '@/components/ui/logo-spinner';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const location = useLocation();
  const { contextoActivo, contextosDisponibles, cargando } = useContextoActivo();
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

  if (cargando || contextosDisponibles === undefined) {
    return <AppLoadingScreen />;
  }

  if (contextosDisponibles.length > 0 && !contextoActivo) {
    return <Navigate to={ROUTES.SELECCIONAR_ROL} replace />;
  }

  // Una cuenta todavía sin panel conserva acceso al inicio vacío y a Cuenta,
  // pero no puede abrir módulos por URL.
  if (!contextoActivo) {
    const rutaBase = location.pathname === ROUTES.DASHBOARD || location.pathname === ROUTES.CUENTA;
    if (!rutaBase) return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (contextoActivo && !obtenerPanelContexto(contextoActivo).puedeAccederRuta(location.pathname)) {
    return <Navigate to={rutaInicialParaContexto(contextoActivo)} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
