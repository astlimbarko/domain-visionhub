import { useState, type FormEvent } from 'react';
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
import { AvatarPersona, COLORES_AVATAR } from '@/components/shared/AvatarIniciales';
import { BuscadorPersona } from './BuscadorPersona';
import type { CargoVigente, PersonaBusqueda } from '@/types/casas-de-paz.types';

/** Bug real (2026-08-15): mostraba `nombre_completo` a lo bruto -- para una
 * persona sin nombre cargado (sin membresía completa) eso rendereaba una
 * línea vacía. Cae al correo, igual que ya hace el resto de la app. */
function etiquetaCargoVigente(v: CargoVigente): string {
  return v.nombre_completo.trim() || v.correo || 'Sin nombre';
}

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
  /** Segundo argumento (`pin`) solo se completa cuando `onPinChange` está
   * presente -- ver nota de `pin`/`onPinChange` más abajo. */
  onQuitar: (cargoAsignacionId: string, pin?: string) => void;
  quitando?: boolean;
  invitable?: boolean;
  invitando?: boolean;
  onInvitar?: (correo: string) => void;
  /** OTP opcional (2026-08-01, Gestión de Redes; 2026-08-01 extendido a
   * quitar): cuando se pasa `onPinChange`, elegir persona, invitar por
   * correo, o quitar a alguien quedan detrás de un paso de confirmación con
   * código, en vez de aplicarse al instante -- mismo componente, sin afectar
   * a quien no lo necesita (Casas de Paz, autogestión de Líder de Red). */
  pin?: string;
  onPinChange?: (valor: string) => void;
  /** IDs adicionales a excluir de la búsqueda más allá de los vigentes de
   * este mismo cargo (2026-08-05, Estructura Organizacional/KAN-60): evita
   * que quien ya ocupa OTRO cargo exclusivo de la misma entidad (ej. el
   * Líder vigente) aparezca como opción al asignar un cargo no exclusivo
   * (ej. Sublíder) -- REQ-CDP-6. Opcional, no cambia a quien no lo pasa. */
  excluirIdsExtra?: string[];
  /** Q-MR-12 (2026-08-15): id de la Casa de Paz para priorizar sus propios
   * miembros en la búsqueda (ver BuscadorPersona/buscarPersonas). Opcional
   * -- cargos de Red/Departamento no lo pasan y buscan en toda la iglesia
   * directamente, como siempre. */
  cdpId?: string;
  /** Bug real KAN-10x (2026-08-10): cuando se pasa `onPinChange`, este
   * diálogo pedía OTP siempre, sin mirar el switch de OTP por iglesia
   * (estructura_organigrama.otp_requerido) -- a diferencia de los demás
   * diálogos del constructor, que sí lo respetan. Opcional, default `true`
   * (mismo comportamiento de siempre) para no afectar a quien no lo pasa. */
  otpRequerido?: boolean;
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
  quitando = false,
  invitable = false,
  invitando = false,
  onInvitar,
  pin,
  onPinChange,
  excluirIdsExtra = [],
  otpRequerido = true,
  cdpId,
}: Props) {
  const [modo, setModo] = useState<'buscar' | 'invitar'>('buscar');
  const [correoInvitar, setCorreoInvitar] = useState('');
  const [personaElegida, setPersonaElegida] = useState<PersonaBusqueda | null>(null);
  const [aQuitar, setAQuitar] = useState<CargoVigente | null>(null);

  const requiereOtp = onPinChange !== undefined && otpRequerido;
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

  // Bug real (2026-08-15): antes solo confirmaba si la iglesia tenía OTP
  // activado -- con OTP apagado, la X quitaba al instante sin avisar. Ahora
  // siempre pide confirmación; el campo de OTP adentro del cuadro de
  // confirmación sigue siendo condicional (solo aparece si hace falta).
  function manejarClicQuitar(v: CargoVigente) {
    setAQuitar(v);
  }

  function confirmarBaja() {
    if (!aQuitar || !pinValido) return;
    onQuitar(aQuitar.id, pin);
    setAQuitar(null);
  }

  // Bug real (2026-08-15): sin un <form>, Enter en el input de correo o de
  // OTP no hacía nada (solo funcionaba con el mouse) -- un <form> hace que
  // el navegador dispare "submit" con Enter en cualquier input de texto de
  // adentro, sin depender de que cada input tenga su propio manejador.
  function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (aQuitar) {
      confirmarBaja();
    } else if (modo === 'invitar') {
      enviarInvitacion();
    } else if (personaElegida) {
      confirmarAsignacion();
    }
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

        <form onSubmit={manejarSubmit} className="contents">
        <div className="flex flex-col gap-3">
          {cargandoVigentes ? (
            <Skeleton className="h-8 w-full" />
          ) : vigentes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {vigentes.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <AvatarPersona nombre={etiquetaCargoVigente(v)} color={COLORES_AVATAR[i % COLORES_AVATAR.length]} size="sm" />
                    <span className="truncate">{etiquetaCargoVigente(v)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => manejarClicQuitar(v)}
                    disabled={quitando}
                    aria-label="Quitar"
                    // KAN-63: size="icon" son 32px, bajo el minimo tactil de
                    // 44x44 (REQ-MOB-3) -- antes:absolute expande el area de
                    // toque real sin agrandar el icono visible, mismo patron
                    // ya usado en el resto del Constructor (paneles laterales,
                    // botones de zoom/centrar).
                    className="relative before:absolute before:-inset-2 before:content-['']"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nadie asignado todavía.</p>
          )}

          {aQuitar && (
            <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-foreground">
                ¿Dar de baja a <span className="font-medium">{etiquetaCargoVigente(aQuitar)}</span>?
              </p>
              {requiereOtp && onPinChange && <CampoOtp value={pin ?? ''} onChange={onPinChange} />}
              {quitando && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" />
                  Dando de baja...
                </p>
              )}
            </div>
          )}

          {!aQuitar && invitable && (
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

          {!aQuitar && modo === 'buscar' && (
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
                excluirIds={[...vigentes.map((v) => v.persona_id), ...(excluirIdsExtra ?? [])]}
                onSeleccionar={manejarSeleccionPersona}
                cdpId={cdpId}
              />
            )
          )}

          {!aQuitar && modo === 'invitar' && invitable && (
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

          {!aQuitar && requiereOtp && onPinChange && (modo === 'invitar' || personaElegida) && (
            <CampoOtp value={pin ?? ''} onChange={onPinChange} />
          )}

          {!aQuitar && asignando && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              Asignando...
            </p>
          )}
        </div>

        {aQuitar ? (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAQuitar(null)} disabled={quitando}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={quitando || !pinValido}>
              {quitando ? 'Dando de baja...' : 'Confirmar baja'}
            </Button>
          </DialogFooter>
        ) : (
          (modo === 'invitar' ? invitable : !!personaElegida) && (
            <DialogFooter>
              {modo === 'buscar' ? (
                <Button type="submit" disabled={asignando || !personaElegida || !pinValido}>
                  {asignando ? 'Asignando...' : 'Confirmar'}
                </Button>
              ) : (
                <Button type="submit" className="gap-1.5" disabled={invitando || !correoInvitar.trim() || !pinValido}>
                  {invitando && <Spinner className="h-3.5 w-3.5" />}
                  {invitando ? 'Enviando...' : 'Invitar'}
                </Button>
              )}
            </DialogFooter>
          )
        )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
