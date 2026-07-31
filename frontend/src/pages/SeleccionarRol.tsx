import { LogOut } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useOpcionesRol } from '@/hooks/useOpcionesRol';
import { cerrarSesion } from '@/services/auth.service';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/utils/constants';
import type { RolUI } from '@/utils/permisos';

export function SeleccionarRol() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const setRolActivo = useAuthStore((s) => s.setRolActivo);
  const logout = useAuthStore((s) => s.logout);
  const opciones = useOpcionesRol();

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  // Blindaje contra acceso directo por URL: sin ambigüedad no hay nada que elegir
  // (esto ya cubre al Super Admin sin otros roles: Dashboard lo manda a Administración).
  if (opciones && opciones.length <= 1) return <Navigate to={ROUTES.DASHBOARD} replace />;

  function elegir(rolUI: RolUI) {
    setRolActivo(rolUI);
    navigate(ROUTES.DASHBOARD, { replace: true });
  }

  async function handleSalir() {
    await cerrarSesion();
    logout();
    queryClient.clear();
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-navy)] shadow-lg shadow-black/10">
          <img src="/logo.png" alt="VisionHub" className="h-8 w-8 object-contain brightness-0 invert" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {nombreCompleto ? `Hola, ${nombreCompleto.split(' ')[0]}` : 'Elegí tu rol'}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Tenés más de un rol asignado. Elegí con cuál querés ingresar.</p>
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {opciones === undefined
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
          : opciones.map(({ rolUI, label, icon: Icon, color }) => (
              <button
                key={rolUI}
                type="button"
                onClick={() => elegir(rolUI)}
                className="flex flex-col items-start gap-4 rounded-2xl p-6 text-left text-white shadow-lg transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 75%, #000) 100%)` }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                </span>
                <span className="text-[15px] font-bold tracking-tight">{label}</span>
              </button>
            ))}
      </div>

      <button
        type="button"
        onClick={handleSalir}
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" /> Salir
      </button>
    </div>
  );
}
