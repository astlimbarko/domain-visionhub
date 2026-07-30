import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { construirSesionDesdeAuth } from '@/services/sesion.service';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';

/**
 * Vuelta del login con Google. `detectSessionInUrl` (default de supabase-js en
 * services/supabase.ts) ya intercambió el código antes de que este componente
 * monte -- acá solo esperamos que la sesión esté lista y armamos la sesión de
 * la app. Siempre navega a Dashboard: es PrivateLayout quien decide si hace
 * falta pasar por /seleccionar-rol.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSesion = useAuthStore((s) => s.setSesion);

  useEffect(() => {
    let cancelado = false;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelado) return;
        if (!data.session) {
          navigate(ROUTES.LOGIN, { replace: true });
          return;
        }
        queryClient.clear();
        setSesion(await construirSesionDesdeAuth());
        navigate(ROUTES.DASHBOARD, { replace: true });
      })
      .catch(() => {
        if (cancelado) return;
        toast.error('No se pudo completar el inicio de sesión con Google.');
        navigate(ROUTES.LOGIN, { replace: true });
      });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-[13px] text-muted-foreground">Iniciando sesión...</p>
      </div>
    </div>
  );
}
