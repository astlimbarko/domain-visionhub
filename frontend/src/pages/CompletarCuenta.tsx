import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/services/supabase';
import { establecerContrasena, obtenerCorreoActual, obtenerIglesiasAccesibles, obtenerPersonaActual, soySuperAdmin } from '@/services/auth.service';
import { obtenerMiInvitacionPendiente } from '@/services/invitacion-lider.service';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';

const esquema = z.object({ contrasena: z.string().min(8, 'Mínimo 8 caracteres'), confirmar: z.string() }).refine((v) => v.contrasena === v.confirmar, { message: 'No coinciden', path: ['confirmar'] });
type FormValues = z.infer<typeof esquema>;

export function CompletarCuenta() {
  const navigate = useNavigate();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'invalido'>('cargando');
  const [enviando, setEnviando] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(esquema) });

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
      const [persona, iglesias, esSuperAdmin, correo, mem] = await Promise.all([obtenerPersonaActual(), obtenerIglesiasAccesibles(), soySuperAdmin(), obtenerCorreoActual(), obtenerMiInvitacionPendiente()]);
      setSesion({ personaId: persona?.id ?? null, nombreCompleto: persona?.nombre_completo ?? null, correo, iglesias, esSuperAdmin, membresiaPendiente: mem });
      toast.success('Contraseña creada'); navigate(ROUTES.DASHBOARD, { replace: true });
    } catch { toast.error('No se pudo guardar'); } finally { setEnviando(false); }
  }

  return (
    <div className="aurora-bg flex min-h-svh items-center justify-center p-6">
      <div className="glass-card-elevated w-full max-w-[380px] rounded-3xl p-8">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-navy)] shadow-lg shadow-black/10">
            <img src="/logo.png" alt="VisionHub" className="h-8 w-8 object-contain brightness-0 invert" />
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
        )}
      </div>
    </div>
  );
}
