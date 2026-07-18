import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { establecerContrasena, establecerPin, obtenerCorreoActual, tengoPin } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

const esquemaContrasena = z
  .object({
    contrasena: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((v) => v.contrasena === v.confirmar, { message: 'No coinciden', path: ['confirmar'] });

type FormContrasena = z.infer<typeof esquemaContrasena>;

const esquemaPin = z
  .object({
    pin: z.string().regex(/^[0-9]{6}$/, 'Debe tener exactamente 6 dígitos'),
    confirmarPin: z.string(),
  })
  .refine((v) => v.pin === v.confirmarPin, { message: 'No coinciden', path: ['confirmarPin'] });

type FormPin = z.infer<typeof esquemaPin>;

export function Cuenta() {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [correo, setCorreo] = useState<string | null>(null);
  const [tienePin, setTienePin] = useState<boolean | null>(null);
  const [enviandoContrasena, setEnviandoContrasena] = useState(false);
  const [enviandoPin, setEnviandoPin] = useState(false);

  const formContrasena = useForm<FormContrasena>({ resolver: zodResolver(esquemaContrasena) });
  const formPin = useForm<FormPin>({ resolver: zodResolver(esquemaPin) });

  useEffect(() => {
    obtenerCorreoActual().then(setCorreo);
    if (esSuperAdmin) {
      tengoPin().then(setTienePin);
    }
  }, [esSuperAdmin]);

  async function onSubmitContrasena(datos: FormContrasena) {
    setEnviandoContrasena(true);
    try {
      await establecerContrasena(datos.contrasena);
      toast.success('Contraseña actualizada');
      formContrasena.reset();
    } catch {
      toast.error('No se pudo actualizar la contraseña');
    } finally {
      setEnviandoContrasena(false);
    }
  }

  async function onSubmitPin(datos: FormPin) {
    setEnviandoPin(true);
    try {
      await establecerPin(datos.pin);
      toast.success(tienePin ? 'PIN actualizado' : 'PIN configurado');
      setTienePin(true);
      formPin.reset();
    } catch {
      toast.error('No se pudo guardar el PIN');
    } finally {
      setEnviandoPin(false);
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
          <form onSubmit={formContrasena.handleSubmit(onSubmitContrasena)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contrasena">Contraseña nueva</Label>
              <Input id="contrasena" type="password" autoComplete="new-password" {...formContrasena.register('contrasena')} />
              {formContrasena.formState.errors.contrasena && (
                <p className="text-sm text-destructive">{formContrasena.formState.errors.contrasena.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmar">Confirmar contraseña</Label>
              <Input id="confirmar" type="password" autoComplete="new-password" {...formContrasena.register('confirmar')} />
              {formContrasena.formState.errors.confirmar && (
                <p className="text-sm text-destructive">{formContrasena.formState.errors.confirmar.message}</p>
              )}
            </div>
            <Button type="submit" disabled={enviandoContrasena} className="self-start">
              {enviandoContrasena ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {esSuperAdmin && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">PIN de Super Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Se pide, además de tu sesión, para confirmar fusiones y cambios de configuración del sistema.
              {tienePin === false && ' Todavía no tenés uno configurado.'}
            </p>
            <form onSubmit={formPin.handleSubmit(onSubmitPin)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pin">{tienePin ? 'PIN nuevo' : 'PIN'} (6 dígitos)</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  {...formPin.register('pin')}
                  onChange={(e) => formPin.setValue('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {formPin.formState.errors.pin && <p className="text-sm text-destructive">{formPin.formState.errors.pin.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmarPin">Confirmar PIN</Label>
                <Input
                  id="confirmarPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  {...formPin.register('confirmarPin')}
                  onChange={(e) => formPin.setValue('confirmarPin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {formPin.formState.errors.confirmarPin && (
                  <p className="text-sm text-destructive">{formPin.formState.errors.confirmarPin.message}</p>
                )}
              </div>
              <Button type="submit" disabled={enviandoPin} className="self-start">
                {enviandoPin ? 'Guardando...' : tienePin ? 'Cambiar PIN' : 'Configurar PIN'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
