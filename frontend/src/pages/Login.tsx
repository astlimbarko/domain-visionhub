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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const esquema = z.object({
  correo: z.string().email(),
  contrasena: z.string().min(1),
});

type FormLogin = z.infer<typeof esquema>;

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormLogin>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: FormLogin) {
    setEnviando(true);
    try {
      await iniciarSesion(datos.correo, datos.contrasena);
      const [persona, iglesias, esSuperAdmin, correo, membresiaPendiente] = await Promise.all([
        obtenerPersonaActual(),
        obtenerIglesiasAccesibles(),
        soySuperAdmin(),
        obtenerCorreoActual(),
        obtenerMiInvitacionPendiente(),
      ]);
      setSesion({
        personaId: persona?.id ?? null,
        nombreCompleto: persona?.nombre_completo ?? null,
        correo,
        iglesias,
        esSuperAdmin,
        membresiaPendiente,
      });
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch {
      toast.error(t('auth.errorCredenciales'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-xl">{t('app.nombre')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correo">{t('auth.correo')}</Label>
              <Input id="correo" type="email" autoComplete="username" {...register('correo')} />
              {errors.correo && <p className="text-sm text-destructive">{errors.correo.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contrasena">{t('auth.contrasena')}</Label>
              <Input id="contrasena" type="password" autoComplete="current-password" {...register('contrasena')} />
            </div>
            <Button type="submit" disabled={enviando} className="mt-2">
              {enviando ? t('acciones.cargando') : t('auth.iniciarSesion')}
            </Button>
            <Link to={ROUTES.RECUPERAR_CONTRASENA} className="text-center text-sm text-muted-foreground hover:text-foreground">
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
