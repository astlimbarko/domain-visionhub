import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ROUTES } from '@/utils/constants';
import { rolesPermitidosPara } from '@/utils/permisos';
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
import { RequiereRol } from '@/components/layout/RequiereRol';

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
            {/* Dashboard: accesible para todos los roles */}
            <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />

            {/* Cuenta: accesible para todos */}
            <Route path={ROUTES.CUENTA} element={<Cuenta />} />

            {/* Rutas protegidas por rol */}
            <Route path={ROUTES.PERSONAS} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.PERSONAS)}><Personas /></RequiereRol>
            } />
            <Route path={ROUTES.CASAS_DE_PAZ} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.CASAS_DE_PAZ)}><CasasDePaz /></RequiereRol>
            } />
            <Route path={ROUTES.MINISTERIOS} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.MINISTERIOS)}><Ministerios /></RequiereRol>
            } />
            <Route path={ROUTES.REPORTES} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.REPORTES)}><Reportes /></RequiereRol>
            } />
            <Route path={ROUTES.CALENDARIO} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.CALENDARIO)}><Calendario /></RequiereRol>
            } />
            <Route path={ROUTES.EVANGELISMO} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.EVANGELISMO)}><Evangelismo /></RequiereRol>
            } />
            <Route path={ROUTES.FINANZAS} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.FINANZAS)}><Finanzas /></RequiereRol>
            } />
            <Route path={ROUTES.PANEL_SUPERVISOR} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.PANEL_SUPERVISOR)}><PanelSupervisor /></RequiereRol>
            } />
            <Route path={ROUTES.ADMINISTRACION} element={
              <RequiereRol permitidos={rolesPermitidosPara(ROUTES.ADMINISTRACION)}><Administracion /></RequiereRol>
            } />
          </Route>

          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
