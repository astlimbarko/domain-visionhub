// KAN-408 seguimiento (2026-09-21, pedido explícito del owner): antes era
// una card más dentro de Cuenta.tsx -- ahora es su propia página completa,
// igual que MiMembresia.tsx ("modal es lento", cita textual). Mismo form,
// mismo esquema zod, solo cambia el contenedor (página en vez de card
// dentro de una lista de secciones).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Circle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { establecerContrasena, mensajeErrorContrasena } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';

const REQUISITOS_CONTRASENA = [
  { clave: 'longitud', texto: 'Mínimo 8 caracteres', test: (v: string) => v.length >= 8 },
  { clave: 'mayuscula', texto: 'Una letra mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { clave: 'minuscula', texto: 'Una letra minúscula', test: (v: string) => /[a-z]/.test(v) },
  { clave: 'numero', texto: 'Un número', test: (v: string) => /\d/.test(v) },
  { clave: 'especial', texto: 'Un carácter especial (!@#$%^&*)', test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
] as const;

const esquemaContrasena = z
  .object({
    contrasena: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Falta una mayúscula')
      .regex(/[a-z]/, 'Falta una minúscula')
      .regex(/\d/, 'Falta un número')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Falta un carácter especial'),
    confirmar: z.string(),
  })
  .refine((v) => v.contrasena === v.confirmar, { message: 'No coinciden', path: ['confirmar'] });
type FormContrasena = z.infer<typeof esquemaContrasena>;

export function CambiarContrasena() {
  const [enviando, setEnviando] = useState(false);
  const form = useForm<FormContrasena>({ resolver: zodResolver(esquemaContrasena) });
  const nuevaContrasena = form.watch('contrasena') ?? '';

  const inputCls = "h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus-visible:bg-background";

  async function onSubmit(datos: FormContrasena) {
    setEnviando(true);
    try {
      await establecerContrasena(datos.contrasena);
      toast.success('Contraseña actualizada');
      form.reset();
    } catch (e) {
      toast.error(mensajeErrorContrasena(e, 'No se pudo actualizar la contraseña'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Link to={ROUTES.CUENTA} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Volver a Mi cuenta
      </Link>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Lock} color={AZUL} titulo="Cambiar contraseña" descripcion="Usá una contraseña que no repitas en otro lado" />
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Nueva</Label>
            <PasswordInput autoComplete="new-password" className={inputCls} {...form.register('contrasena')} />
            {form.formState.errors.contrasena && <p className="text-[11px] text-destructive">{form.formState.errors.contrasena.message}</p>}
          </div>

          {nuevaContrasena && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-3">
              {REQUISITOS_CONTRASENA.map((req) => {
                const cumple = req.test(nuevaContrasena);
                return (
                  <div key={req.clave} className="flex items-center gap-2">
                    {cumple ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-chart-2" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={`text-[11px] ${cumple ? 'text-foreground' : 'text-muted-foreground'}`}>{req.texto}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Confirmar</Label>
            <PasswordInput autoComplete="new-password" className={inputCls} {...form.register('confirmar')} />
            {form.formState.errors.confirmar && <p className="text-[11px] text-destructive">{form.formState.errors.confirmar.message}</p>}
          </div>
          <Button type="submit" disabled={enviando} className="mt-1 self-start rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">
            {enviando ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </section>
    </div>
  );
}
