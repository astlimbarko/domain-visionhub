import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { establecerContrasena, obtenerCorreoActual } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

const esquema = z
  .object({
    contrasena: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((v) => v.contrasena === v.confirmar, { message: 'No coinciden', path: ['confirmar'] });

type FormValues = z.infer<typeof esquema>;

export function Cuenta() {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const [correo, setCorreo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    obtenerCorreoActual().then(setCorreo);
  }, []);

  async function onSubmit(datos: FormValues) {
    setEnviando(true);
    try {
      await establecerContrasena(datos.contrasena);
      toast.success('Contraseña actualizada');
      reset();
    } catch {
      toast.error('No se pudo actualizar la contraseña');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Mi cuenta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          <p className="text-sm text-muted-foreground">Nombre</p>
          <p className="text-sm font-medium">{nombreCompleto ?? '—'}</p>
          <p className="mt-3 text-sm text-muted-foreground">Correo</p>
          <p className="text-sm font-medium">{correo ?? '—'}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Button type="submit" disabled={enviando} className="self-start">
              {enviando ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
