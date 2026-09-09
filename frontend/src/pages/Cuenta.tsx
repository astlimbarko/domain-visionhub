import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Lock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { EditorFotoPerfilDialog } from '@/components/shared/EditorFotoPerfilDialog';
import { AZUL } from '@/components/dashboard/DashboardUI';
import { establecerContrasena, mensajeErrorContrasena, obtenerCorreoActual } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { useEliminarFotoPerfil, useFotoPerfilPath, useUrlFirmadaFotoPerfil } from '@/hooks/usePersonaFoto';

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

export function Cuenta() {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const [correo, setCorreo] = useState<string | null>(null);
  const [enviandoContrasena, setEnviandoContrasena] = useState(false);
  const formContrasena = useForm<FormContrasena>({ resolver: zodResolver(esquemaContrasena) });
  const nuevaContrasena = formContrasena.watch('contrasena') ?? '';

  const { data: fotoPath, isLoading: cargandoFotoPath } = useFotoPerfilPath(personaId ?? undefined);
  const { data: fotoUrl } = useUrlFirmadaFotoPerfil(fotoPath);
  const eliminarFoto = useEliminarFotoPerfil();
  const [archivoParaRecortar, setArchivoParaRecortar] = useState<File | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { obtenerCorreoActual().then(setCorreo); }, []);

  function onQuitarFoto() {
    if (!personaId || !fotoPath) return;
    eliminarFoto.mutate(
      { personaId, path: fotoPath },
      { onError: () => toast.error('No se pudo quitar la foto'), onSuccess: () => toast.success('Foto quitada') }
    );
  }

  async function onSubmitContrasena(datos: FormContrasena) {
    setEnviandoContrasena(true);
    try { await establecerContrasena(datos.contrasena); toast.success('Contraseña actualizada'); formContrasena.reset(); }
    catch (e) { toast.error(mensajeErrorContrasena(e, 'No se pudo actualizar la contraseña')); } finally { setEnviandoContrasena(false); }
  }

  const inputCls = "h-11 rounded-2xl border-border bg-muted/50 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus-visible:bg-background";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 shadow-xl shadow-black/5">
        <div className="relative h-20 w-20">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {cargandoFotoPath ? (
              <Spinner className="h-5 w-5 text-primary-foreground/70" />
            ) : fotoUrl ? (
              <img src={fotoUrl} alt={nombreCompleto ?? 'Foto de perfil'} className="h-full w-full object-cover" />
            ) : (
              (nombreCompleto ?? '?')[0]?.toUpperCase()
            )}
          </div>
          <button
            type="button"
            onClick={() => inputArchivoRef.current?.click()}
            className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-background text-foreground shadow-sm hover:bg-muted"
            aria-label="Cambiar foto de perfil"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {fotoUrl && (
            <button
              type="button"
              onClick={onQuitarFoto}
              disabled={eliminarFoto.isPending}
              className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-background text-destructive shadow-sm hover:bg-destructive/10"
              aria-label="Quitar foto de perfil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) setArchivoParaRecortar(archivo);
              e.target.value = '';
            }}
          />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold tracking-tight text-foreground">{nombreCompleto ?? '—'}</p>
          <p className="text-[13px] text-muted-foreground">{correo ?? '—'}</p>
        </div>
      </div>

      {archivoParaRecortar && personaId && iglesiaActivaId && (
        <EditorFotoPerfilDialog
          archivo={archivoParaRecortar}
          iglesiaId={iglesiaActivaId}
          personaId={personaId}
          onCerrar={() => setArchivoParaRecortar(null)}
          onSubida={() => setArchivoParaRecortar(null)}
        />
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Lock} color={AZUL} titulo="Cambiar contraseña" descripcion="Usá una contraseña que no repitas en otro lado" />
        <form onSubmit={formContrasena.handleSubmit(onSubmitContrasena)} className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Nueva</Label><PasswordInput autoComplete="new-password" className={inputCls} {...formContrasena.register('contrasena')} />{formContrasena.formState.errors.contrasena && <p className="text-[11px] text-destructive">{formContrasena.formState.errors.contrasena.message}</p>}</div>

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

          <div className="flex flex-col gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Confirmar</Label><PasswordInput autoComplete="new-password" className={inputCls} {...formContrasena.register('confirmar')} />{formContrasena.formState.errors.confirmar && <p className="text-[11px] text-destructive">{formContrasena.formState.errors.confirmar.message}</p>}</div>
          <Button type="submit" disabled={enviandoContrasena} className="mt-1 self-start rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">{enviandoContrasena ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </section>
    </div>
  );
}
