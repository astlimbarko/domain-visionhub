import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { iniciarSesion, iniciarSesionConGoogle } from '@/services/auth.service';
import { construirSesionDesdeAuth } from '@/services/sesion.service';
import { useAuthStore } from '@/store/auth.store';
import { GOOGLE_AUTH_HABILITADO, ROUTES } from '@/utils/constants';

const esquema = z.object({ correo: z.string().email(), contrasena: z.string().min(1) });
type FormLogin = z.infer<typeof esquema>;

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [enviando, setEnviando] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormLogin>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: FormLogin) {
    setEnviando(true);
    try {
      await iniciarSesion(datos.correo, datos.contrasena);
      // Nueva identidad: descartar la caché de la cuenta anterior. Sin esto,
      // dos cuentas de la misma iglesia comparten queryKey (ej. mis-roles) y
      // la segunda ve los roles cacheados de la primera (sidebar/panel del rol
      // equivocado).
      queryClient.clear();
      setSesion(await construirSesionDesdeAuth());
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch { toast.error(t('auth.errorCredenciales')); }
    finally { setEnviando(false); }
  }

  async function onClickGoogle() {
    try { await iniciarSesionConGoogle(); }
    catch { toast.error('No se pudo iniciar sesión con Google.'); }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="w-full max-w-[380px] rounded-3xl border border-border bg-card p-8 shadow-xl shadow-black/5">
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

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase">o</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={!GOOGLE_AUTH_HABILITADO}
          title={GOOGLE_AUTH_HABILITADO ? undefined : 'Próximamente'}
          onClick={onClickGoogle}
          className="h-11 w-full gap-2.5 rounded-2xl border-border text-[14px] font-semibold text-foreground hover:bg-muted"
        >
          <GoogleIcon className="h-4.5 w-4.5" />
          Continuar con Google
        </Button>
      </div>
    </div>
  );
}
