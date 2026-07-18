import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { solicitarRecuperacionContrasena } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';

const esquema = z.object({ correo: z.string().email() });
type FormValues = z.infer<typeof esquema>;

export function RecuperarContrasena() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: FormValues) {
    setEnviando(true);
    try {
      await solicitarRecuperacionContrasena(datos.correo, `${window.location.origin}${ROUTES.COMPLETAR_CUENTA}`);
      setEnviado(true);
    } catch {
      toast.error('No se pudo enviar el enlace. Intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-xl">Recuperar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <p className="text-center text-sm text-muted-foreground">
              Si ese correo tiene una cuenta, te llegó un enlace para elegir una contraseña nueva.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="correo">Correo</Label>
                <Input id="correo" type="email" autoComplete="username" {...register('correo')} />
                {errors.correo && <p className="text-sm text-destructive">{errors.correo.message}</p>}
              </div>
              <Button type="submit" disabled={enviando} className="mt-2">
                {enviando ? 'Enviando...' : 'Mandar enlace'}
              </Button>
            </form>
          )}
          <Link to={ROUTES.LOGIN} className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
            Volver a iniciar sesión
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
