import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/services/supabase';
import {
  establecerContrasena,
  obtenerCorreoActual,
  obtenerIglesiasAccesibles,
  obtenerPersonaActual,
  soySuperAdmin,
} from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';

const esquema = z
  .object({
    contrasena: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((v) => v.contrasena === v.confirmar, { message: 'No coinciden', path: ['confirmar'] });

type FormValues = z.infer<typeof esquema>;

export function CompletarCuenta() {
  const navigate = useNavigate();
  const setSesion = useAuthStore((s) => s.setSesion);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'invalido'>('cargando');
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (activo && data.session) setEstado('listo');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (activo && session) setEstado('listo');
    });

    const vencido = setTimeout(() => {
      if (activo) setEstado((actual) => (actual === 'cargando' ? 'invalido' : actual));
    }, 5000);

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
      clearTimeout(vencido);
    };
  }, []);

  async function onSubmit(datos: FormValues) {
    setEnviando(true);
    try {
      await establecerContrasena(datos.contrasena);
      const [persona, iglesias, esSuperAdmin, correo] = await Promise.all([
        obtenerPersonaActual(),
        obtenerIglesiasAccesibles(),
        soySuperAdmin(),
        obtenerCorreoActual(),
      ]);
      setSesion({
        personaId: persona?.id ?? null,
        nombreCompleto: persona?.nombre_completo ?? null,
        correo,
        iglesias,
        esSuperAdmin,
      });
      toast.success('Contraseña creada');
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch {
      toast.error('No se pudo guardar la contraseña');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-xl">Elegí tu contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {estado === 'cargando' && <Skeleton className="h-32 w-full" />}
          {estado === 'invalido' && (
            <p className="text-center text-sm text-muted-foreground">
              Este enlace no es válido o ya venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?" en el inicio de sesión.
            </p>
          )}
          {estado === 'listo' && (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contrasena">Contraseña nueva</Label>
                <Input id="contrasena" type="password" autoComplete="new-password" {...register('contrasena')} />
                {errors.contrasena && <p className="text-sm text-destructive">{errors.contrasena.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <Input id="confirmar" type="password" autoComplete="new-password" {...register('confirmar')} />
                {errors.confirmar && <p className="text-sm text-destructive">{errors.confirmar.message}</p>}
              </div>
              <Button type="submit" disabled={enviando} className="mt-2">
                {enviando ? 'Guardando...' : 'Guardar y entrar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
