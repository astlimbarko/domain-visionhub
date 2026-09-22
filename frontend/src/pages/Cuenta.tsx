import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { IdCard, Lock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EditorFotoPerfilDialog } from '@/components/shared/EditorFotoPerfilDialog';
import { obtenerCorreoActual } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { useEliminarFotoPerfil, useFotoPerfilPath, useUrlFotoPerfil } from '@/hooks/usePersonaFoto';
import { ROUTES } from '@/utils/constants';

export function Cuenta() {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const [correo, setCorreo] = useState<string | null>(null);

  const { data: fotoPath, isLoading: cargandoFotoPath } = useFotoPerfilPath(personaId ?? undefined);
  const { data: fotoUrl } = useUrlFotoPerfil(fotoPath);
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

      {/* KAN-408 seguimiento (pedido explícito del owner, 2026-09-21): 2
          botones lado a lado, cada uno a su propia página completa (no
          modal, "modal es lento" -- cita textual). Membresía y Cambiar
          contraseña dejaron de ser cards con contenido embebido acá. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Button asChild disabled={!personaId} variant="outline" className="h-auto w-full flex-col items-start gap-1 rounded-2xl border-border/60 p-5 text-left">
          <Link to={ROUTES.CUENTA_MEMBRESIA}>
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <IdCard className="h-4 w-4" />
              Membresía
            </span>
            <span className="text-xs font-normal text-muted-foreground">Tus datos personales, censo y familia</span>
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto w-full flex-col items-start gap-1 rounded-2xl border-border/60 p-5 text-left">
          <Link to={ROUTES.CUENTA_CONTRASENA}>
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lock className="h-4 w-4" />
              Cambiar contraseña
            </span>
            <span className="text-xs font-normal text-muted-foreground">Usá una que no repitas en otro lado</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
