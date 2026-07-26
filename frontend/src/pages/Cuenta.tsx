import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { establecerContrasena, establecerPin, obtenerCorreoActual, tengoPin } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

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
const esquemaPin = z.object({ pin: z.string().regex(/^[0-9]{6}$/, '6 dígitos'), confirmarPin: z.string() }).refine((v) => v.pin === v.confirmarPin, { message: 'No coinciden', path: ['confirmarPin'] });
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
  const nuevaContrasena = formContrasena.watch('contrasena') ?? '';

  useEffect(() => { obtenerCorreoActual().then(setCorreo); if (esSuperAdmin) tengoPin().then(setTienePin); }, [esSuperAdmin]);

  async function onSubmitContrasena(datos: FormContrasena) {
    setEnviandoContrasena(true);
    try { await establecerContrasena(datos.contrasena); toast.success('Contraseña actualizada'); formContrasena.reset(); }
    catch { toast.error('Error'); } finally { setEnviandoContrasena(false); }
  }
  async function onSubmitPin(datos: FormPin) {
    setEnviandoPin(true);
    try { await establecerPin(datos.pin); toast.success(tienePin ? 'PIN actualizado' : 'PIN configurado'); setTienePin(true); formPin.reset(); }
    catch { toast.error('Error'); } finally { setEnviandoPin(false); }
  }

  const inputCls = "h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus-visible:bg-background";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="glass-card-elevated flex flex-col items-center gap-4 rounded-3xl p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {(nombreCompleto ?? '?')[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold tracking-tight text-foreground">{nombreCompleto ?? '—'}</p>
          <p className="text-[13px] text-muted-foreground">{correo ?? '—'}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><Lock className="h-4 w-4 text-primary" /></div>
          <h2 className="text-[14px] font-bold text-foreground">Cambiar contraseña</h2>
        </div>
        <form onSubmit={formContrasena.handleSubmit(onSubmitContrasena)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Nueva</Label><Input type="password" autoComplete="new-password" className={inputCls} {...formContrasena.register('contrasena')} />{formContrasena.formState.errors.contrasena && <p className="text-[11px] text-destructive">{formContrasena.formState.errors.contrasena.message}</p>}</div>

          {nuevaContrasena && (
            <div className="glass-subtle flex flex-col gap-1.5 rounded-xl p-3">
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

          <div className="flex flex-col gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Confirmar</Label><Input type="password" autoComplete="new-password" className={inputCls} {...formContrasena.register('confirmar')} />{formContrasena.formState.errors.confirmar && <p className="text-[11px] text-destructive">{formContrasena.formState.errors.confirmar.message}</p>}</div>
          <Button type="submit" disabled={enviandoContrasena} className="mt-1 self-start rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">{enviandoContrasena ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </div>

      {esSuperAdmin && (
        <div className="glass-card rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><ShieldCheck className="h-4 w-4 text-primary" /></div>
            <h2 className="text-[14px] font-bold text-foreground">PIN de Super Admin</h2>
          </div>
          <form onSubmit={formPin.handleSubmit(onSubmitPin)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{tienePin ? 'PIN nuevo' : 'PIN'} (6 dígitos)</Label><Input type="password" inputMode="numeric" maxLength={6} className={inputCls} {...formPin.register('pin')} onChange={(e) => formPin.setValue('pin', e.target.value.replace(/\D/g, '').slice(0, 6))} />{formPin.formState.errors.pin && <p className="text-[11px] text-destructive">{formPin.formState.errors.pin.message}</p>}</div>
            <div className="flex flex-col gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Confirmar</Label><Input type="password" inputMode="numeric" maxLength={6} className={inputCls} {...formPin.register('confirmarPin')} onChange={(e) => formPin.setValue('confirmarPin', e.target.value.replace(/\D/g, '').slice(0, 6))} />{formPin.formState.errors.confirmarPin && <p className="text-[11px] text-destructive">{formPin.formState.errors.confirmarPin.message}</p>}</div>
            <Button type="submit" disabled={enviandoPin} className="mt-1 self-start rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">{enviandoPin ? 'Guardando...' : tienePin ? 'Cambiar' : 'Configurar'}</Button>
          </form>
        </div>
      )}
    </div>
  );
}
