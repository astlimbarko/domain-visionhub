import { Navigate, useParams } from 'react-router-dom';
import { Crosshair, Minus, Plus, Search } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { AppLoadingScreen } from '@/components/ui/logo-spinner';
import { ROUTES } from '@/utils/constants';

/**
 * Constructor visual de la estructura organizacional (KAN-52). Vive fuera de
 * PrivateLayout/AppShell a proposito -- barra superior oscura exclusiva de
 * este modulo (KAN-53), se autoprotege con isAuthenticated + rol igual que
 * los paneles minimos de gestion. Referencia visual:
 * opencode/Epica Estructura Organizacional/1/*.jpeg.
 *
 * Tarea 1 (KAN-53): solo el acceso y la barra superior. El lienzo con las
 * tarjetas de Pastor/Supervisor/Departamentos/Redes/Casas de Paz es la
 * Tarea 2, todavia sin implementar -- se deja un placeholder abajo.
 */
export function EstructuraOrganizacional() {
  const { iglesiaId } = useParams<{ iglesiaId: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const iglesias = useAuthStore((s) => s.iglesias);
  const rolUI = useRolUI();

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (rolUI === null) return <AppLoadingScreen />;
  // Acceso: Super Admin (completo) y Supervisor de la Vision en Accion
  // (limitado, se acota en tareas siguientes) -- el resto, afuera.
  if (rolUI !== 'SUPER_ADMIN' && rolUI !== 'SUPERVISOR') {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const iglesia = iglesias.find((i) => i.id === iglesiaId);

  return (
    <div className="flex h-svh flex-col bg-[#eef1f6]">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-[#0a0e1a] px-6 py-3">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.png" alt="VisionHub" className="h-8 w-8 rounded-lg object-contain brightness-0 invert" />
          <span className="text-[15px] font-bold text-white">
            Vision<span className="font-normal text-white/70">Hub</span>
          </span>
        </div>
        <div className="hidden h-8 w-px shrink-0 bg-white/15 sm:block" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-white">Estructura Organizacional</h1>
          <p className="truncate text-[12.5px] text-white/50">
            {iglesia
              ? `Crea entidades y asigna responsables para construir la estructura de ${iglesia.nombre}.`
              : 'Crea entidades y asigna responsables para construir la estructura inicial de la iglesia.'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              placeholder="Buscar persona o entidad"
              className="h-10 w-64 rounded-xl border border-white/15 bg-white/5 pr-3 pl-9 text-[13px] text-white placeholder:text-white/40 outline-none focus-visible:border-white/30"
            />
          </div>
          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/15 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
          >
            <Crosshair className="h-4 w-4" /> Centrar estructura
          </button>
          <div className="flex h-10 items-center gap-1 rounded-xl border border-white/15 px-1.5 text-white">
            <button type="button" aria-label="Alejar" className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-[13px] tabular-nums">100%</span>
            <button type="button" aria-label="Acercar" className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">El lienzo de la estructura se implementa en la siguiente etapa.</p>
      </main>
    </div>
  );
}
