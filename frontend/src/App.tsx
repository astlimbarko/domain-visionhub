import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/utils/constants';
import { rolesPermitidosPara } from '@/utils/permisos';
import { RegistroPublico } from '@/pages/RegistroPublico';
import { Login } from '@/pages/Login';
import { RecuperarContrasena } from '@/pages/RecuperarContrasena';
import { CompletarCuenta } from '@/pages/CompletarCuenta';
import { Dashboard } from '@/pages/Dashboard';
import { Cuenta } from '@/pages/Cuenta';
import { PrivateLayout } from '@/components/layout/PrivateLayout';
import { RequiereRol } from '@/components/layout/RequiereRol';
import { RequiereCapacidad } from '@/components/layout/RequiereCapacidad';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';

// Módulos menos visitados que Dashboard/Cuenta: se cargan bajo demanda para
// que el bundle inicial no incluya código de páginas que la mayoría de
// sesiones nunca abre en la primera carga.
const Personas = lazy(() => import('@/pages/Personas').then((m) => ({ default: m.Personas })));
const CasasDePaz = lazy(() => import('@/pages/CasasDePaz').then((m) => ({ default: m.CasasDePaz })));
const Ministerios = lazy(() => import('@/pages/Ministerios').then((m) => ({ default: m.Ministerios })));
const Reportes = lazy(() => import('@/pages/Reportes').then((m) => ({ default: m.Reportes })));
const HistorialReportes = lazy(() => import('@/pages/HistorialReportes').then((m) => ({ default: m.HistorialReportes })));
const HistorialAsistencia = lazy(() => import('@/pages/HistorialAsistencia').then((m) => ({ default: m.HistorialAsistencia })));
const Calendario = lazy(() => import('@/pages/Calendario').then((m) => ({ default: m.Calendario })));
const Evangelismo = lazy(() => import('@/pages/Evangelismo').then((m) => ({ default: m.Evangelismo })));
const Finanzas = lazy(() => import('@/pages/Finanzas').then((m) => ({ default: m.Finanzas })));
const PanelSupervisor = lazy(() => import('@/pages/PanelSupervisor').then((m) => ({ default: m.PanelSupervisor })));
const Administracion = lazy(() => import('@/pages/Administracion').then((m) => ({ default: m.Administracion })));
const Afirmacion = lazy(() => import('@/pages/Afirmacion').then((m) => ({ default: m.Afirmacion })));
const AfirmacionFormulario = lazy(() => import('@/pages/AfirmacionFormulario').then((m) => ({ default: m.AfirmacionFormulario })));
const AfirmacionUrls = lazy(() => import('@/pages/AfirmacionUrls').then((m) => ({ default: m.AfirmacionUrls })));

function CargandoPagina() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

// Afirmación no se protege por RolUI (RequiereRol) sino por una capacidad
// ortogonal (departamento_cargo) -- necesita su propio hook, de ahi el
// componente aparte en vez de un elemento JSX inline como el resto. Tres
// rutas hermanas (Dashboard/Formulario/URLs), cada una con su propio item
// de nav (ver NAV_ITEMS_AFIRMACION) -- no una sola pagina con sub-nav interno.
function RutaAfirmacion({ children }: { children: ReactNode }) {
  const esLiderAfirmacion = useEsLiderAfirmacion();
  return (
    <Suspense fallback={<CargandoPagina />}>
      <RequiereCapacidad permitido={esLiderAfirmacion}>{children}</RequiereCapacidad>
    </Suspense>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Sin esto, cada vez que se remonta un componente (volver a una pestaña,
      // ir y volver de un módulo) vuelve a pedir todo con isLoading=true, aunque
      // se haya pedido hace 2 segundos -- se siente como un "corte" al navegar.
      // 30s alcanza para que la navegación normal use el cache; lo que sí
      // necesita estar siempre fresco (ediciones propias, listas que cambian
      // seguido) ya invalida explícitamente via queryClient en sus mutations.
      staleTime: 1000 * 30,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.REGISTRO_PUBLICO} element={<RegistroPublico />} />
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path={ROUTES.RECUPERAR_CONTRASENA} element={<RecuperarContrasena />} />
          <Route path={ROUTES.COMPLETAR_CUENTA} element={<CompletarCuenta />} />

          <Route element={<PrivateLayout />}>
            {/* Dashboard: accesible para todos los roles */}
            <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />

            {/* Cuenta: accesible para todos */}
            <Route path={ROUTES.CUENTA} element={<Cuenta />} />

            {/* Rutas protegidas por rol — páginas cargadas bajo demanda (ver imports lazy arriba) */}
            <Route path={ROUTES.PERSONAS} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.PERSONAS)}><Personas /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.CASAS_DE_PAZ} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.CASAS_DE_PAZ)}><CasasDePaz /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.MINISTERIOS} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.MINISTERIOS)}><Ministerios /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.REPORTES} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.REPORTES)}><Reportes /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.HISTORIAL_REPORTES} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.HISTORIAL_REPORTES)}><HistorialReportes /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.HISTORIAL_ASISTENCIA} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.HISTORIAL_ASISTENCIA)}><HistorialAsistencia /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.CALENDARIO} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.CALENDARIO)}><Calendario /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.EVANGELISMO} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.EVANGELISMO)}><Evangelismo /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.FINANZAS} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.FINANZAS)}><Finanzas /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.PANEL_SUPERVISOR} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.PANEL_SUPERVISOR)}><PanelSupervisor /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.ADMINISTRACION} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.ADMINISTRACION)}><Administracion /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.AFIRMACION} element={<RutaAfirmacion><Afirmacion /></RutaAfirmacion>} />
            <Route path={ROUTES.AFIRMACION_FORMULARIO} element={<RutaAfirmacion><AfirmacionFormulario /></RutaAfirmacion>} />
            <Route path={ROUTES.AFIRMACION_URLS} element={<RutaAfirmacion><AfirmacionUrls /></RutaAfirmacion>} />
          </Route>

          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
