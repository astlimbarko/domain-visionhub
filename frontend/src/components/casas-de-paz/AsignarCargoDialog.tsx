import { useState } from 'react';
import { Mail, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { BuscadorPersona } from './BuscadorPersona';
import type { CargoVigente, PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  exclusivo: boolean;
  iglesiaId: string | undefined;
  vigentes: CargoVigente[];
  cargandoVigentes: boolean;
  asignando: boolean;
  onAsignar: (persona: PersonaBusqueda) => void;
  onQuitar: (cargoAsignacionId: string) => void;
  invitable?: boolean;
  invitando?: boolean;
  onInvitar?: (correo: string) => void;
  /** OTP opcional (2026-08-01, Gestión de Redes): cuando se pasa
   * `onPinChange`, elegir persona o invitar por correo queda detrás de un
   * paso de confirmación con código, en vez de aplicarse al instante --
   * mismo componente, sin afectar a quien no lo necesita (Departamentos,
   * Casas de Paz). */
  pin?: string;
  onPinChange?: (valor: string) => void;
}

export function AsignarCargoDialog({
  open,
  onOpenChange,
  titulo,
  exclusivo,
  iglesiaId,
  vigentes,
  cargandoVigentes,
  asignando,
  onAsignar,
  onQuitar,
  invitable = false,
  invitando = false,
  onInvitar,
  pin,
  onPinChange,
}: Props) {
  const [modo, setModo] = useState<'buscar' | 'invitar'>('buscar');
  const [correoInvitar, setCorreoInvitar] = useState('');
  const [personaElegida, setPersonaElegida] = useState<PersonaBusqueda | null>(null);

  const requiereOtp = onPinChange !== undefined;
  const pinValido = !requiereOtp || /^[0-9]{6}$/.test(pin ?? '');

  function manejarSeleccionPersona(persona: PersonaBusqueda) {
    if (requiereOtp) {
      setPersonaElegida(persona);
    } else {
      onAsignar(persona);
    }
  }

  function confirmarAsignacion() {
    if (!personaElegida || !pinValido) return;
    onAsignar(personaElegida);
    setPersonaElegida(null);
  }

  function enviarInvitacion() {
    if (!onInvitar || !correoInvitar.trim() || !pinValido) return;
    onInvitar(correoInvitar.trim().toLowerCase());
    setCorreoInvitar('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {exclusivo
              ? 'Asignar una persona nueva reemplaza automáticamente a la actual.'
              : 'Se puede asignar a varias personas a la vez.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {cargandoVigentes ? (
            <Skeleton className="h-8 w-full" />
          ) : vigentes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {vigentes.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                  {v.nombre_completo}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onQuitar(v.id)} aria-label="Quitar">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nadie asignado todavía.</p>
          )}

          {invitable && (
            <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              <button
                type="button"
                onClick={() => { setModo('buscar'); setPersonaElegida(null); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${
                  modo === 'buscar' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                Persona existente
              </button>
              <button
                type="button"
                onClick={() => { setModo('invitar'); setPersonaElegida(null); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${
                  modo === 'invitar' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Invitar por correo
              </button>
            </div>
          )}

          {modo === 'buscar' && (
            personaElegida ? (
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                <span className="truncate">{personaElegida.nombre_completo}</span>
                <button type="button" onClick={() => setPersonaElegida(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cambiar
                </button>
              </div>
            ) : (
              <BuscadorPersona
                iglesiaId={iglesiaId}
                excluirIds={vigentes.map((v) => v.persona_id)}
                onSeleccionar={manejarSeleccionPersona}
              />
            )
          )}

          {modo === 'invitar' && invitable && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">
                Si esta persona todavía no existe en el sistema, mandale una invitación por correo. Al entrar por
                primera vez va a tener que completar el formulario de membresía antes de ver su panel.
              </p>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={correoInvitar}
                onChange={(e) => setCorreoInvitar(e.target.value)}
              />
            </div>
          )}

          {requiereOtp && onPinChange && (modo === 'invitar' || personaElegida) && (
            <CampoOtp value={pin ?? ''} onChange={onPinChange} />
          )}

          {asignando && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              Asignando...
            </p>
          )}
        </div>

        {(modo === 'invitar' ? invitable : !!personaElegida) && (
          <DialogFooter>
            {modo === 'buscar' ? (
              <Button type="button" onClick={confirmarAsignacion} disabled={asignando || !personaElegida || !pinValido}>
                {asignando ? 'Asignando...' : 'Confirmar'}
              </Button>
            ) : (
              <Button type="button" className="gap-1.5" onClick={enviarInvitacion} disabled={invitando || !correoInvitar.trim() || !pinValido}>
                {invitando && <Spinner className="h-3.5 w-3.5" />}
                {invitando ? 'Enviando...' : 'Invitar'}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
