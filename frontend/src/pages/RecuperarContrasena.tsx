import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { solicitarRecuperacionContrasena } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';

const esquema = z.object({ correo: z.string().email() });
type FormValues = z.infer<typeof esquema>;

export function RecuperarContrasena() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: FormValues) {
    setEnviando(true);
    try { await solicitarRecuperacionContrasena(datos.correo, `${window.location.origin}${ROUTES.COMPLETAR_CUENTA}`); setEnviado(true); }
    catch { toast.error('No se pudo enviar el enlace.'); } finally { setEnviando(false); }
  }

  return (
    <div className="aurora-bg flex min-h-svh items-center justify-center p-6">
      <div className="glass-card-elevated w-full max-w-[380px] rounded-3xl p-8">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-navy)] shadow-lg shadow-black/10">
            <img src="/logo.png" alt="VisionHub" className="h-8 w-8 object-contain brightness-0 invert" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Recuperar contraseña</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Te enviaremos un enlace</p>
          </div>
        </div>
        {enviado ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/50 p-5 text-center">
            <svg className="h-8 w-8 text-chart-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <p className="text-[13px] text-muted-foreground">Si ese correo tiene una cuenta, te llegó un enlace.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">Correo</Label>
              <Input type="email" autoComplete="username" placeholder="tucorreo@ejemplo.com" className="h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50" {...register('correo')} />
              {errors.correo && <p className="text-[11px] text-destructive">{errors.correo.message}</p>}
            </div>
            <Button type="submit" disabled={enviando} className="mt-2 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98]">{enviando ? 'Enviando...' : 'Enviar enlace'}</Button>
          </form>
        )}
        <Link to={ROUTES.LOGIN} className="mt-5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary/80">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
      </div>
    </div>
  );
}
