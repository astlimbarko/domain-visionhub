import { useState } from 'react';
import { HelpCircle, LogOut } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useOpcionesRolContextuales, type OpcionRolContextual } from '@/hooks/useOpcionesRolContextuales';
import { useMisRoles } from '@/hooks/useDashboard';
import { cerrarSesion } from '@/services/auth.service';
import { Skeleton } from '@/components/ui/skeleton';
import { GrupoOpcionesRol } from '@/components/seleccionar-rol/GrupoOpcionesRol';
import { AyudaSeleccionarRol } from '@/components/seleccionar-rol/AyudaSeleccionarRol';
import { AppErrorScreen } from '@/components/ui/logo-spinner';
import { iniciales } from '@/components/shared/AvatarIniciales';
import { ROUTES } from '@/utils/constants';
import { rutaInicialParaContexto } from '@/utils/paneles-contexto';

/** Trunca un correo largo conservando el dominio visible en vez de cortarlo
 * a lo bruto (ej. "juan.perez.gonzalez…@somoscdv.com") -- así el saludo no
 * se rompe ni queda ilegible cuando no hay nombre cargado todavía. */
function truncarCorreo(correo: string, maxLargo = 26): string {
  if (correo.length <= maxLargo) return correo;
  const arroba = correo.lastIndexOf('@');
  const dominio = arroba === -1 ? '' : correo.slice(arroba);
  const espacioLocal = maxLargo - dominio.length - 1;
  if (!dominio || espacioLocal < 3) return `${correo.slice(0, maxLargo - 1)}…`;
  return `${correo.slice(0, espacioLocal)}…${dominio}`;
}

export function SeleccionarRol() {
  const navigate = useNavigate();
  const [mostrandoAyuda, setMostrandoAyuda] = useState(false);
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const correo = useAuthStore((s) => s.correo);
  const setContextoActivo = useAuthStore((s) => s.setContextoActivo);
  const logout = useAuthStore((s) => s.logout);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesias = useAuthStore((s) => s.iglesias);
  const nombreIglesia = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre ?? 'VisionHub';

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

  // Sin ambigüedad contextual no hay nada que elegir. El contexto único se
  // persiste automáticamente al entrar al layout privado.
  if (opcionesContextuales && opcionesContextuales.length <= 1) {
    const unica = opcionesContextuales[0];
    return <Navigate to={unica ? rutaInicialParaContexto(unica.contexto) : ROUTES.DASHBOARD} replace />;
  }

  function elegir(opcion: OpcionRolContextual) {
    setContextoActivo(opcion.contexto);
    navigate(rutaInicialParaContexto(opcion.contexto), { replace: true });
  }

  const primerNombre = nombreCompleto?.trim() ? nombreCompleto.trim().split(' ')[0] : null;
  // Si la persona todavía no cargó su nombre (recién asignada, sin membresía
  // completa), el saludo cae al correo con el que inició sesión.
  const saludo = primerNombre ?? (correo ? truncarCorreo(correo) : null);
  const cantidad = opcionesContextuales?.length ?? 0;

  return (
    <div
      className="relative flex min-h-svh items-start justify-center overflow-hidden p-4 py-6 sm:items-center sm:p-6"
      style={{
        // KAN-191 (revisión): la primera versión eran manchas borrosas muy
        // tenues sobre un fondo casi blanco -- se veía "lavado" comparado con
        // el mockup (multirol.jpeg), que es un degradado diagonal que cubre
        // toda la pantalla. Esto reemplaza esa base por un linear-gradient
        // real violeta→blanco→verde con los mismos tokens de siempre
        // (--chart-4/--chart-2), así sigue adaptándose solo a dark mode.
        background:
          'linear-gradient(135deg, color-mix(in oklab, var(--chart-4) 38%, var(--background)) 0%, var(--background) 55%, color-mix(in oklab, var(--chart-2) 32%, var(--background)) 100%)',
      }}
    >
      {/* Manchas borrosas encima del degradado, como textura extra (mismo
          recurso blur-3xl de GRADIENTE_HERO en los dashboards). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[var(--chart-4)]/30 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--chart-2)]/25 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[var(--chart-1)]/10 blur-3xl" />
      </div>

      {/* KAN-194: tope de alto + scroll propio -- mismo patrón que ya usa
          DialogContent (dialog.tsx) para no depender de que la lista de
          roles siempre entre. Con 6-7 roles la tarjeta ya no empuja toda la
          página, hace scroll adentro y "Cerrar sesión" sigue siempre a mano. */}
      <div className="scrollbar-minimal relative max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl bg-card p-5 shadow-xl shadow-black/[0.06] sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-navy)]">
              <img src="/logo.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain brightness-0 invert" />
            </span>
            <span className="truncate text-[13px] font-semibold text-foreground">{nombreIglesia}</span>
          </div>
          {/* KAN-193: abre la ayuda del selector de rol (multirol-help.jpeg).
              Hacer clic de nuevo sobre el mismo ícono vuelve a la lista de
              roles -- alternativa rápida al botón "Volver a mis roles". */}
          <button
            type="button"
            onClick={() => setMostrandoAyuda((v) => !v)}
            aria-label={mostrandoAyuda ? 'Volver a mis roles' : 'Ayuda'}
            title={mostrandoAyuda ? 'Volver a mis roles' : '¿Necesitás ayuda?'}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[var(--chart-1)] hover:text-[var(--chart-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>

        {mostrandoAyuda ? (
          <AyudaSeleccionarRol onVolver={() => setMostrandoAyuda(false)} />
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-navy)] text-[12px] font-bold text-white shadow-lg shadow-black/10">
                {nombreCompleto ? iniciales(nombreCompleto) : null}
              </div>
              <h1
                className="mt-1 w-full truncate px-2 text-lg font-extrabold tracking-tight text-foreground"
                title={saludo && correo ? correo : undefined}
              >
                {saludo ? `Bienvenido, ${saludo}` : 'Bienvenido'}
              </h1>
              {opcionesContextuales !== undefined && (
                <p className="text-[12.5px] text-muted-foreground">
                  Tienes <span className="font-bold text-[#0071e3]">{cantidad}</span>{' '}
                  {cantidad === 1 ? 'rol asignado' : 'roles asignados'} — elegí con cuál ingresar
                </p>
              )}
            </div>

            <div className="mt-3">
              {opcionesContextuales === undefined ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-[60px] w-full rounded-2xl" />
                  <Skeleton className="h-[60px] w-full rounded-2xl" />
                </div>
              ) : (
                <GrupoOpcionesRol opciones={opcionesContextuales} onSeleccionar={elegir} />
              )}
            </div>

            <div className="mt-2.5 flex flex-col items-center gap-2">
              <p className="text-center text-[11px] text-muted-foreground">
                Podés cambiar de rol después desde tu perfil.
              </p>
              <button
                type="button"
                onClick={handleSalir}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-1.5 text-[13px] font-medium text-destructive transition-colors hover:border-destructive/40 hover:bg-destructive/10 active:border-destructive active:bg-destructive active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
