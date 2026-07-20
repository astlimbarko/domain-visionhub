import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  iniciarSesion,
  obtenerCorreoActual,
  obtenerIglesiasAccesibles,
  obtenerPersonaActual,
  soySuperAdmin,
} from '@/services/auth.service';
import { obtenerMiInvitacionPendiente } from '@/services/invitacion-lider.service';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';

const esquema = z.object({ correo: z.string().email(), contrasena: z.string().min(1) });
type FormLogin = z.infer<typeof esquema>;

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [enviando, setEnviando] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormLogin>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: FormLogin) {
    setEnviando(true);
    try {
      await iniciarSesion(datos.correo, datos.contrasena);
      const [persona, iglesias, esSuperAdmin, correo, membresiaPendiente] = await Promise.all([
        obtenerPersonaActual(), obtenerIglesiasAccesibles(), soySuperAdmin(), obtenerCorreoActual(), obtenerMiInvitacionPendiente(),
      ]);
      setSesion({ personaId: persona?.id ?? null, nombreCompleto: persona?.nombre_completo ?? null, correo, iglesias, esSuperAdmin, membresiaPendiente });
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch { toast.error(t('auth.errorCredenciales')); }
    finally { setEnviando(false); }
  }

  return (
    <div className="aurora-bg flex min-h-svh items-center justify-center p-6">
      <div className="glass-card-elevated w-full max-w-[380px] rounded-3xl p-8">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-navy)] shadow-lg shadow-black/10">
            <img src="/logo.png" alt="VisionHub" className="h-8 w-8 object-contain brightness-0 invert" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t('app.nombre')}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Iniciá sesión en tu cuenta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correo" className="text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">{t('auth.correo')}</Label>
            <Input id="correo" type="email" autoComplete="username" placeholder="tucorreo@ejemplo.com"
              className="h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-primary/15"
              {...register('correo')} />
            {errors.correo && <p className="text-[11px] text-destructive">{errors.correo.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contrasena" className="text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">{t('auth.contrasena')}</Label>
            <Input id="contrasena" type="password" autoComplete="current-password" placeholder="••••••••"
              className="h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-primary/15"
              {...register('contrasena')} />
          </div>

          <Button type="submit" disabled={enviando}
            className="mt-3 h-11 rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]">
            {enviando ? t('acciones.cargando') : t('auth.iniciarSesion')}
          </Button>

          <Link to={ROUTES.RECUPERAR_CONTRASENA} className="mt-1 text-center text-[13px] font-medium text-primary transition-colors hover:text-primary/80">
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      </div>
    </div>
  );
}
