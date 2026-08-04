import { LogOut, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useOpcionesRol } from '@/hooks/useOpcionesRol';
import { useOpcionesRolContextuales, type OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';
import { useMisRoles } from '@/hooks/useDashboard';
import { cerrarSesion } from '@/services/auth.service';
import { Skeleton } from '@/components/ui/skeleton';
import { GrupoOpcionesRol } from '@/components/seleccionar-rol/GrupoOpcionesRol';
import { AppErrorScreen } from '@/components/ui/logo-spinner';
import { ROUTES } from '@/utils/constants';

export function SeleccionarRol() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const setRolActivo = useAuthStore((s) => s.setRolActivo);
  const logout = useAuthStore((s) => s.logout);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  // Fuente de verdad de "hay ambigüedad real": por TIPO de rol, la misma que
  // usa PrivateLayout -- no se toca. Las opciones contextuales (abajo) son
  // solo para mostrar cada asignación por separado dentro de esos tipos.
  const opciones = useOpcionesRol();
  const opcionesContextuales = useOpcionesRolContextuales();
  // Mismo query que ya usan los hooks de arriba (misma queryKey, sin pedido de
  // red extra) -- solo para leer isError/refetch, ver AppErrorScreen abajo.
  const { isError: fallaRoles, refetch: reintentarRoles } = useMisRoles(iglesiaActivaId ?? undefined);

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;

  async function handleSalir() {
    await cerrarSesion();
    logout();
    queryClient.clear();
  }

  // Esta pantalla vive fuera de PrivateLayout (se autoprotege aparte), así que
  // necesita el mismo blindaje contra "sesión vencida / corte de red" que se
  // agregó ahí -- sin esto, quedaba mostrando el esqueleto para siempre
  // (2026-08-03, mismo bug, confirmado en vivo).
  if (fallaRoles) {
    return <AppErrorScreen onReintentar={() => reintentarRoles()} onCerrarSesion={handleSalir} />;
  }

  // Blindaje contra acceso directo por URL: sin ambigüedad no hay nada que elegir
  // (esto ya cubre al Super Admin sin otros roles: Dashboard lo manda a Administración).
  if (opciones && opciones.length <= 1) return <Navigate to={ROUTES.DASHBOARD} replace />;

  function elegir(opcion: OpcionRolContextual) {
    setRolActivo(opcion.rolUI);
    if (opcion.ruta) {
      navigate(opcion.ruta, { replace: true });
      return;
    }
    navigate(ROUTES.DASHBOARD, { replace: true, state: opcion.vista ? { vista: opcion.vista } : undefined });
  }

  const primerNombre = nombreCompleto?.split(' ')[0];
  const cantidad = opcionesContextuales?.length ?? 0;

  return (
    <div className="flex min-h-svh items-start justify-center bg-muted p-4 py-10 sm:items-center sm:p-6">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-xl shadow-black/[0.06] sm:p-9">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-navy)] shadow-lg shadow-black/10">
            <img src="/logo.png" alt="Centro de Vida" className="h-8 w-8 object-contain brightness-0 invert" />
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {primerNombre ? `Bienvenido, ${primerNombre} 👋` : 'Bienvenido 👋'}
          </h1>
          {opcionesContextuales !== undefined && (
            <p className="text-[15px] text-muted-foreground">
              Tienes <span className="font-bold text-[#0071e3]">{cantidad}</span>{' '}
              {cantidad === 1 ? 'rol asignado' : 'roles asignados'}
              <br />
              Selecciona con cuál deseas ingresar
            </p>
          )}
        </div>

        <div className="mt-7">
          {opcionesContextuales === undefined ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-[60px] w-full rounded-2xl" />
              <Skeleton className="h-[60px] w-full rounded-2xl" />
            </div>
          ) : (
            <GrupoOpcionesRol opciones={opcionesContextuales} onSeleccionar={elegir} />
          )}
        </div>

        <div className="mt-7 flex flex-col items-center gap-4">
          <div className="flex w-full items-center gap-3 text-muted-foreground/40">
            <span className="h-px flex-1 bg-border" />
            <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="h-px flex-1 bg-border" />
          </div>
          <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
            Puedes cambiar de rol en cualquier momento
            <br />
            desde el menú de tu perfil.
          </p>
          <button
            type="button"
            onClick={handleSalir}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
