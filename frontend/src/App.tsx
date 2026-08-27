import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ContenidoCargando } from '@/components/ui/logo-spinner';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';
import { useAuthStore } from '@/store/auth.store';
import { supabase } from '@/services/supabase';
import { ROUTES } from '@/utils/constants';
import { rolesPermitidosPara } from '@/utils/permisos';
import { RegistroPublico } from '@/pages/RegistroPublico';
import { Login } from '@/pages/Login';
import { RecuperarContrasena } from '@/pages/RecuperarContrasena';
import { CompletarCuenta } from '@/pages/CompletarCuenta';
import { SeleccionarRol } from '@/pages/SeleccionarRol';
import { AuthCallback } from '@/pages/AuthCallback';
import { Dashboard } from '@/pages/Dashboard';
import { Cuenta } from '@/pages/Cuenta';
import { PrivateLayout } from '@/components/layout/PrivateLayout';
import { RequiereRol } from '@/components/layout/RequiereRol';
import { RequiereCapacidad } from '@/components/layout/RequiereCapacidad';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';
import { useEsLiderJovenes, useEsEncargadoMatrimonios } from '@/hooks/useRolesGlobales';

// Módulos menos visitados que Dashboard/Cuenta: se cargan bajo demanda para
// que el bundle inicial no incluya código de páginas que la mayoría de
// sesiones nunca abre en la primera carga.
const Personas = lazy(() => import('@/pages/Personas').then((m) => ({ default: m.Personas })));
const CasasDePaz = lazy(() => import('@/pages/CasasDePaz').then((m) => ({ default: m.CasasDePaz })));
const Ministerios = lazy(() => import('@/pages/Ministerios').then((m) => ({ default: m.Ministerios })));
const Reportes = lazy(() => import('@/pages/Reportes').then((m) => ({ default: m.Reportes })));
const ControlReportes = lazy(() => import('@/pages/ControlReportes').then((m) => ({ default: m.ControlReportes })));
const HistorialReportes = lazy(() => import('@/pages/HistorialReportes').then((m) => ({ default: m.HistorialReportes })));
const HistorialAsistencia = lazy(() => import('@/pages/HistorialAsistencia').then((m) => ({ default: m.HistorialAsistencia })));
const Calendario = lazy(() => import('@/pages/Calendario').then((m) => ({ default: m.Calendario })));
const Evangelismo = lazy(() => import('@/pages/Evangelismo').then((m) => ({ default: m.Evangelismo })));
const Visitas = lazy(() => import('@/pages/Visitas').then((m) => ({ default: m.Visitas })));
const Finanzas = lazy(() => import('@/pages/Finanzas').then((m) => ({ default: m.Finanzas })));
const PanelSupervisor = lazy(() => import('@/pages/PanelSupervisor').then((m) => ({ default: m.PanelSupervisor })));
const Departamentos = lazy(() => import('@/pages/Departamentos').then((m) => ({ default: m.Departamentos })));
const GestionRedes = lazy(() => import('@/pages/GestionRedes').then((m) => ({ default: m.GestionRedes })));
const Administracion = lazy(() => import('@/pages/Administracion').then((m) => ({ default: m.Administracion })));
const PastorGestion = lazy(() => import('@/pages/PastorGestion').then((m) => ({ default: m.PastorGestion })));
const EstructuraOrganizacional = lazy(() => import('@/pages/EstructuraOrganizacional').then((m) => ({ default: m.EstructuraOrganizacional })));
const ConstructorResumen = lazy(() => import('@/pages/ConstructorResumen').then((m) => ({ default: m.ConstructorResumen })));
const Afirmacion = lazy(() => import('@/pages/Afirmacion').then((m) => ({ default: m.Afirmacion })));
const AfirmacionFormulario = lazy(() => import('@/pages/AfirmacionFormulario').then((m) => ({ default: m.AfirmacionFormulario })));
const AfirmacionUrls = lazy(() => import('@/pages/AfirmacionUrls').then((m) => ({ default: m.AfirmacionUrls })));
const AfirmacionCasasDePaz = lazy(() => import('@/pages/AfirmacionCasasDePaz').then((m) => ({ default: m.AfirmacionCasasDePaz })));
const AfirmacionPersonas = lazy(() => import('@/pages/AfirmacionPersonas').then((m) => ({ default: m.AfirmacionPersonas })));
const Jovenes = lazy(() => import('@/pages/Jovenes').then((m) => ({ default: m.Jovenes })));
const Matrimonios = lazy(() => import('@/pages/Matrimonios').then((m) => ({ default: m.Matrimonios })));
const Anuncios = lazy(() => import('@/pages/Anuncios').then((m) => ({ default: m.Anuncios })));
const AnuncioForm = lazy(() => import('@/pages/AnuncioForm').then((m) => ({ default: m.AnuncioForm })));

function CargandoPagina() {
  return <ContenidoCargando />;
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

// Mismo patron que RutaAfirmacion: capacidad ortogonal (persona_cargo Tipo B
// de nivel IGLESIA), acceso global de solo lectura sin depender de RolUI.
function RutaJovenes({ children }: { children: ReactNode }) {
  const esLiderJovenes = useEsLiderJovenes();
  return (
    <Suspense fallback={<CargandoPagina />}>
      <RequiereCapacidad permitido={esLiderJovenes}>{children}</RequiereCapacidad>
    </Suspense>
  );
}

function RutaMatrimonios({ children }: { children: ReactNode }) {
  const esEncargadoMatrimonios = useEsEncargadoMatrimonios();
  return (
    <Suspense fallback={<CargandoPagina />}>
      <RequiereCapacidad permitido={esEncargadoMatrimonios}>{children}</RequiereCapacidad>
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
  const personaFichaId = useFichaPersonaStore((s) => s.personaId);
  const cerrarFichaPersona = useFichaPersonaStore((s) => s.cerrar);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Bug real reportado (2026-08-11): "isAuthenticated" es un flag propio
  // persistido en localStorage, nunca se recalculaba solo porque la sesión
  // real de Supabase se invalidara (refresh token vencido por estar mucho
  // tiempo sin abrir la app, token corrupto, etc.) -- así que quedaba
  // "pegado" en true, y el primer síntoma era una consulta fallando con 401
  // (pantalla "No se pudo conectar" de PrivateLayout) en vez de mandar
  // directo a /login. Verificado en vivo (corrompiendo el refresh token en
  // localStorage) que en este caso -- token ya inválido desde el arranque,
  // no una sesión activa que se corta -- Supabase emite 'INITIAL_SESSION'
  // con session=null, NO 'SIGNED_OUT' (ese solo dispara si había una sesión
  // en memoria y se pierde a mitad de camino) -- hay que cubrir los dos.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento, session) => {
      const sinSesionReal = (evento === 'SIGNED_OUT' || evento === 'INITIAL_SESSION') && !session;
      if (sinSesionReal && isAuthenticated) {
        logout();
        queryClient.clear();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [isAuthenticated, logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.REGISTRO_PUBLICO} element={<RegistroPublico />} />
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path={ROUTES.RECUPERAR_CONTRASENA} element={<RecuperarContrasena />} />
          <Route path={ROUTES.COMPLETAR_CUENTA} element={<CompletarCuenta />} />
          <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
          {/* Fuera de PrivateLayout a propósito: PrivateLayout redirige *hacia* acá
              cuando hay ambigüedad de rol, así que esta ruta no puede depender de
              PrivateLayout para su propio guard (se autoprotege con isAuthenticated). */}
          <Route path={ROUTES.SELECCIONAR_ROL} element={<SeleccionarRol />} />

          {/* Paneles minimos de gestion (15-gestion-administrativa, Panel 3/4,
              2026-07-31): sin sidebar/AppShell a proposito -- solo funcionalidad
              de crear, se autoprotegen con isAuthenticated igual que
              SeleccionarRol. Estetica pendiente para una sesion posterior. */}
          <Route path={ROUTES.PASTOR_GESTION} element={
            <Suspense fallback={<CargandoPagina />}>
              <PastorGestion />
            </Suspense>
          } />

          {/* Estructura organizacional (KAN-52/53): fuera de PrivateLayout a
              propósito, barra superior oscura propia -- se autoprotege igual
              que PastorGestion. */}
          <Route path={ROUTES.ESTRUCTURA_ORGANIZACIONAL} element={
            <Suspense fallback={<CargandoPagina />}>
              <EstructuraOrganizacional />
            </Suspense>
          } />

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
            <Route path={ROUTES.REPORTES_EDITAR} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.REPORTES_EDITAR)}><Reportes /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.CONTROL_REPORTES} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.CONTROL_REPORTES)}><ControlReportes /></RequiereRol>
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
            <Route path={ROUTES.VISITAS} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.VISITAS)}><Visitas /></RequiereRol>
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
            <Route path={ROUTES.DEPARTAMENTOS} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.DEPARTAMENTOS)}><Departamentos /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.GESTION_REDES} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.GESTION_REDES)}><GestionRedes /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.ADMINISTRACION} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.ADMINISTRACION)}><Administracion /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.CONSTRUCTOR_RESUMEN} element={
              <Suspense fallback={<CargandoPagina />}>
                <RequiereRol permitidos={rolesPermitidosPara(ROUTES.CONSTRUCTOR_RESUMEN)}><ConstructorResumen /></RequiereRol>
              </Suspense>
            } />
            <Route path={ROUTES.AFIRMACION} element={<RutaAfirmacion><Afirmacion /></RutaAfirmacion>} />
            <Route path={ROUTES.AFIRMACION_FORMULARIO} element={<RutaAfirmacion><AfirmacionFormulario /></RutaAfirmacion>} />
            <Route path={ROUTES.AFIRMACION_URLS} element={<RutaAfirmacion><AfirmacionUrls /></RutaAfirmacion>} />
            <Route path={ROUTES.AFIRMACION_CASAS_DE_PAZ} element={<RutaAfirmacion><AfirmacionCasasDePaz /></RutaAfirmacion>} />
            <Route path={ROUTES.AFIRMACION_PERSONAS} element={<RutaAfirmacion><AfirmacionPersonas /></RutaAfirmacion>} />
            <Route path={ROUTES.JOVENES} element={<RutaJovenes><Jovenes /></RutaJovenes>} />
            <Route path={ROUTES.MATRIMONIOS} element={<RutaMatrimonios><Matrimonios /></RutaMatrimonios>} />

            {/* Anuncios (KAN-101): la pagina se autoprotege leyendo su propia
                capacidad vía fn_anuncio_mi_capacidad. Item de nav en
                permisos.ts para Pastor/Supervisor/Líder de Red/Supervisor
                de Red; Casa de Paz sin acceso todavía (pedido del owner).
                Crear/editar en pagina propia (2026-08-15, pedido del
                owner: mas control que un modal). */}
            <Route path={ROUTES.ANUNCIOS} element={
              <Suspense fallback={<CargandoPagina />}>
                <Anuncios />
              </Suspense>
            } />
            <Route path={ROUTES.ANUNCIO_NUEVO} element={
              <Suspense fallback={<CargandoPagina />}>
                <AnuncioForm />
              </Suspense>
            } />
            <Route path={ROUTES.ANUNCIO_EDITAR} element={
              <Suspense fallback={<CargandoPagina />}>
                <AnuncioForm />
              </Suspense>
            } />
          </Route>

          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
      <FichaPersonaSheet personaId={personaFichaId} onOpenChange={(open) => !open && cerrarFichaPersona()} />
    </QueryClientProvider>
  );
}

export default App;
