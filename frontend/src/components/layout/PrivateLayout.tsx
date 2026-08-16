import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useMisRoles } from '@/hooks/useDashboard';
import { cerrarSesion } from '@/services/auth.service';
import { obtenerMiMembresiaIncompleta } from '@/services/membresia-extendida.service';
import { ROUTES } from '@/utils/constants';
import { obtenerPanelContexto, rutaInicialParaContexto } from '@/utils/paneles-contexto';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';
import { AppLoadingScreen, AppErrorScreen } from '@/components/ui/logo-spinner';
import { ModalAnuncios } from '@/components/anuncios/ModalAnuncios';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);
  const setMembresiaPendiente = useAuthStore((s) => s.setMembresiaPendiente);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const location = useLocation();
  const { contextoActivo, contextosDisponibles, cargando } = useContextoActivo();
  // Mismo query que usa useOpcionesRol por debajo (misma queryKey, React Query
  // lo dedupe -- no es un pedido de red extra) -- se necesita acá solo para
  // leer isError/refetch, que useOpcionesRol no expone.
  const { isError: fallaRoles, refetch: reintentarRoles } = useMisRoles(iglesiaActivaId ?? undefined);

  // KAN-179 (seguimiento): el gate solo se evaluaba una vez, al iniciar
  // sesión, contra la iglesia del rol MÁS ANTIGUO -- si la persona tiene
  // roles en más de una iglesia y cambia a otra, no se volvía a chequear.
  // Se re-evalúa cada vez que cambia la iglesia del contexto activo (elegir
  // rol por primera vez o "Cambiar rol" después), pisando membresiaPendiente
  // con lo que corresponda a la iglesia recién activada (incluido null, si
  // ahí sí está completa).
  const iglesiaContextoId = contextoActivo && 'iglesiaId' in contextoActivo ? contextoActivo.iglesiaId : null;
  useEffect(() => {
    if (!iglesiaContextoId) return;
    let vigente = true;
    obtenerMiMembresiaIncompleta(iglesiaContextoId)
      .then((resultado) => { if (vigente) setMembresiaPendiente(resultado); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [iglesiaContextoId, setMembresiaPendiente]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // KAN-179: el caso de invitación real (invitacion_lider/invitacion_
  // departamento, invitacion.id !== null) todavía no tiene ningún cargo
  // creado -- no hay panel posible detrás, sigue siendo lo único visible.
  // El caso general (id === null, ej. Pastor/Supervisor asignado directo)
  // SÍ tiene panel ya resuelto (el cargo vive en usuario_rol, no depende de
  // que exista Persona) -- ese se muestra como modal ENCIMA del panel, más
  // abajo.
  if (membresiaPendiente && membresiaPendiente.id !== null) {
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
      {membresiaPendiente && <MembresiaObligatoria invitacion={membresiaPendiente} />}
      {/* T5/T6 (KAN-106/107): pedido explicito del owner 2026-08-16 -- son
          "anuncios de inicio de sesion", tienen que verse siempre al
          ingresar, por delante del formulario de membresia si tambien
          aplica (antes esperaba a que no hubiera membresia pendiente, lo
          que podia dejarlo sin mostrarse por sesiones enteras). Montado
          siempre; ModalAnuncios ya usa z-index mas alto para quedar
          arriba de MembresiaObligatoria cuando coinciden. */}
      <ModalAnuncios />
    </AppShell>
  );
}
