import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ROUTES } from '@/utils/constants';
import { RegistroPublico } from '@/pages/RegistroPublico';
import { Login } from '@/pages/Login';
import { RecuperarContrasena } from '@/pages/RecuperarContrasena';
import { CompletarCuenta } from '@/pages/CompletarCuenta';
import { Dashboard } from '@/pages/Dashboard';
import { Personas } from '@/pages/Personas';
import { CasasDePaz } from '@/pages/CasasDePaz';
import { Ministerios } from '@/pages/Ministerios';
import { Reportes } from '@/pages/Reportes';
import { Calendario } from '@/pages/Calendario';
import { Evangelismo } from '@/pages/Evangelismo';
import { Finanzas } from '@/pages/Finanzas';
import { PanelSupervisor } from '@/pages/PanelSupervisor';
import { Cuenta } from '@/pages/Cuenta';
import { Administracion } from '@/pages/Administracion';
import { PrivateLayout } from '@/components/layout/PrivateLayout';
import { RequiereOperativo } from '@/components/layout/RequiereOperativo';
import { RequiereSuperAdmin } from '@/components/layout/RequiereSuperAdmin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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
            <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
            <Route path={ROUTES.PERSONAS} element={<Personas />} />
            <Route path={ROUTES.CASAS_DE_PAZ} element={<CasasDePaz />} />
            <Route path={ROUTES.MINISTERIOS} element={<Ministerios />} />
            <Route path={ROUTES.REPORTES} element={<Reportes />} />
            <Route path={ROUTES.CALENDARIO} element={<Calendario />} />
            <Route path={ROUTES.EVANGELISMO} element={<Evangelismo />} />
            <Route path={ROUTES.FINANZAS} element={<Finanzas />} />
            <Route path={ROUTES.CUENTA} element={<Cuenta />} />
            <Route
              path={ROUTES.PANEL_SUPERVISOR}
              element={
                <RequiereOperativo>
                  <PanelSupervisor />
                </RequiereOperativo>
              }
            />
            <Route
              path={ROUTES.ADMINISTRACION}
              element={
                <RequiereSuperAdmin>
                  <Administracion />
                </RequiereSuperAdmin>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
