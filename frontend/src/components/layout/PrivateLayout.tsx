import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useMisRoles } from '@/hooks/useDashboard';
import { cerrarSesion } from '@/services/auth.service';
import { obtenerMiActualizacionMembresiaPendiente, obtenerMiMembresiaIncompleta } from '@/services/membresia-extendida.service';
import { ROUTES } from '@/utils/constants';
import { obtenerPanelContexto, rutaInicialParaContexto } from '@/utils/paneles-contexto';
import { AppShell } from '@/components/layout/AppShell';
import { MembresiaObligatoria } from '@/pages/MembresiaObligatoria';
import { ActualizacionMembresiaModal } from '@/components/shared/ActualizacionMembresiaModal';
import { AppLoadingScreen, AppErrorScreen } from '@/components/ui/logo-spinner';
import { ModalAnuncios } from '@/components/anuncios/ModalAnuncios';

export function PrivateLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membresiaPendiente = useAuthStore((s) => s.membresiaPendiente);
  const setMembresiaPendiente = useAuthStore((s) => s.setMembresiaPendiente);
  const actualizacionMembresiaPendiente = useAuthStore((s) => s.actualizacionMembresiaPendiente);
  const setActualizacionMembresiaPendiente = useAuthStore((s) => s.setActualizacionMembresiaPendiente);
  const saltarActualizacionMembresiaLocal = useAuthStore((s) => s.saltarActualizacionMembresiaLocal);
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

  // KAN-252 Parte B: se chequea recién cuando la membresía YA está completa
  // (membresiaPendiente en null) -- a diferencia de ese gate, esto no
  // bloquea el panel, solo se muestra encima (como ModalAnuncios).
  useEffect(() => {
    if (!isAuthenticated || membresiaPendiente) return;
    let vigente = true;
    obtenerMiActualizacionMembresiaPendiente()
      .then((resultado) => { if (vigente) setActualizacionMembresiaPendiente(resultado); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [isAuthenticated, membresiaPendiente, setActualizacionMembresiaPendiente]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // KAN-252 (seguimiento): el caso de invitación real (invitacion_lider,
  // invitacion.id !== null) sigue sin panel hasta que la persona completa la
  // página 1 del wizard ("Tu nombre") -- recién ahí se crea la Persona real +
  // el cargo (fn_aceptar_invitacion_lider), porque el trigger que valida
  // Persona exige nombre/apellido/sexo reales, que no existen antes de esa
  // página. El caso general (id === null) sí tiene panel resuelto desde el
  // inicio (el cargo vive en usuario_rol, no depende de que exista Persona).
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
      {!membresiaPendiente && actualizacionMembresiaPendiente && (
        <ActualizacionMembresiaModal
          iglesiaId={actualizacionMembresiaPendiente.iglesia_id}
          faltaTelefono={actualizacionMembresiaPendiente.falta_telefono}
          faltaMinisterio={actualizacionMembresiaPendiente.falta_ministerio}
          onGuardado={() => setActualizacionMembresiaPendiente(null)}
          onSaltar={saltarActualizacionMembresiaLocal}
        />
      )}
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
