import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/services/supabase';
import { establecerContrasena, vincularGoogleAInvitacion } from '@/services/auth.service';
import { construirSesionDesdeAuth } from '@/services/sesion.service';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';

const esquema = z.object({ contrasena: z.string().min(8, 'Mínimo 8 caracteres'), confirmar: z.string() }).refine((v) => v.contrasena === v.confirmar, { message: 'No coinciden', path: ['confirmar'] });
type FormValues = z.infer<typeof esquema>;

export function CompletarCuenta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'invalido'>('cargando');
  const [enviando, setEnviando] = useState(false);
  const [vinculandoGoogle, setVinculandoGoogle] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  async function continuarConGoogle() {
    setVinculandoGoogle(true);
    try {
      await vincularGoogleAInvitacion();
      // No hay nada más que hacer acá: linkIdentity redirige a Google y, al
      // volver, AuthCallback.tsx arma la sesión de la app -- este componente
      // ya no sigue montado para cuando eso pasa.
    } catch {
      toast.error('No se pudo continuar con Google');
      setVinculandoGoogle(false);
    }
  }

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data }) => { if (activo && data.session) setEstado('listo'); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (activo && session) setEstado('listo'); });
    const t = setTimeout(() => { if (activo) setEstado((a) => a === 'cargando' ? 'invalido' : a); }, 5000);
    return () => { activo = false; sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function onSubmit(datos: FormValues) {
    setEnviando(true);
    try {
      await establecerContrasena(datos.contrasena);
      queryClient.clear();
      setSesion(await construirSesionDesdeAuth());
      toast.success('Contraseña creada'); navigate(ROUTES.DASHBOARD, { replace: true });
    } catch { toast.error('No se pudo guardar'); } finally { setEnviando(false); }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="w-full max-w-[380px] rounded-3xl border border-border bg-card p-8 shadow-xl shadow-black/5">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-navy)] shadow-lg shadow-black/10">
            <img src="/logo.png" alt="Centro de Vida" className="h-8 w-8 object-contain brightness-0 invert" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Elegí tu contraseña</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Configurá una contraseña segura</p>
          </div>
        </div>
        {estado === 'cargando' && <Skeleton className="h-44 w-full rounded-2xl" />}
        {estado === 'invalido' && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/50 p-5 text-center">
            <svg className="h-8 w-8 text-destructive/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            <p className="text-[13px] text-muted-foreground">Este enlace no es válido o ya venció.</p>
          </div>
        )}
        {estado === 'listo' && (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={vinculandoGoogle}
              onClick={() => void continuarConGoogle()}
              className="h-11 gap-2 rounded-2xl border-border font-semibold"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.92l-3.88-3c-1.07.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09C3.26 21.3 7.31 24 12 24z" /><path fill="#FBBC05" d="M5.31 14.31A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.58.4-2.31V6.6H1.3A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.3 5.4z" /><path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.6l4 3.09c.94-2.82 3.58-4.92 6.69-4.92z" /></svg>
              {vinculandoGoogle ? 'Redirigiendo…' : 'Continuar con Google'}
            </Button>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              o
              <div className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">Contraseña nueva</Label>
                <Input type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" className="h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50" {...register('contrasena')} />
                {errors.contrasena && <p className="text-[11px] text-destructive">{errors.contrasena.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">Confirmar</Label>
                <Input type="password" autoComplete="new-password" placeholder="••••••••" className="h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50" {...register('confirmar')} />
                {errors.confirmar && <p className="text-[11px] text-destructive">{errors.confirmar.message}</p>}
              </div>
              <Button type="submit" disabled={enviando} className="mt-2 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98]">{enviando ? 'Guardando...' : 'Guardar y entrar'}</Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
