import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { solicitarRecuperacionContrasena } from '@/services/auth.service';
import { useEstablecerContrasenaTemporal } from '@/features/estructura-organizacional/useEstructuraOrganizacional';
import { obtenerUrlBase } from '@/utils/app-url';
import { ROUTES } from '@/utils/constants';
import type { EntidadReenvioInvitacion } from '@/features/estructura-organizacional/types';

interface Props {
  correo: string;
  /** A qué entidad/persona pertenece -- lo necesita establecer-contrasena-temporal
   * para el chequeo de permiso (mismas 4 RPC que ya usa reenviar-invitacion-cargo). */
  entidad: EntidadReenvioInvitacion;
  className?: string;
}

const ESTILO_DEFECTO =
  "relative flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-slate-500 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * KAN-278: además del enlace de siempre (resetPasswordForEmail -- puede
 * "vencer" antes de tiempo si un escáner de seguridad del correo de la
 * persona ya lo consumió, caso real: mariajulietavm2020@gmail.com), ofrece
 * asignarle una contraseña temporal directo a la cuenta -- sin ningún enlace
 * de un solo uso de por medio. Quien la usa se la dice a la persona en
 * persona, nunca por escrito (ni acá ni en el correo de aviso que se manda).
 * Al primer login con esa contraseña, un gate obligatorio le pide elegir una
 * propia antes de seguir (useAuthStore/RequiereCambioContrasena).
 */
export function RestablecerContrasenaBoton({ correo, entidad, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [establecerFija, setEstablecerFija] = useState(false);
  const [contrasena, setContrasena] = useState('12345678');
  const [enviandoLink, setEnviandoLink] = useState(false);
  const establecerTemporal = useEstablecerContrasenaTemporal();

  function cerrarYLimpiar() {
    setAbierto(false);
    setEstablecerFija(false);
    setContrasena('12345678');
  }

  function manejarEnviarLink() {
    setEnviandoLink(true);
    solicitarRecuperacionContrasena(correo, `${obtenerUrlBase()}${ROUTES.COMPLETAR_CUENTA}`)
      .then(() => { toast.success(`Enlace de restablecimiento enviado a ${correo}`); cerrarYLimpiar(); })
      .catch(() => toast.error('No se pudo enviar el enlace'))
      .finally(() => setEnviandoLink(false));
  }

  function manejarEstablecerFija() {
    if (contrasena.trim().length < 8) {
      toast.error('Mínimo 8 caracteres');
      return;
    }
    establecerTemporal.mutate(
      { entidad, contrasena: contrasena.trim() },
      {
        onSuccess: () => {
          toast.success('Contraseña asignada. Decísela a la persona en persona -- no se la escribas.');
          cerrarYLimpiar();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo asignar'),
      },
    );
  }

  const procesando = enviandoLink || establecerTemporal.isPending;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className ?? ESTILO_DEFECTO}>
        <KeyRound className="h-3 w-3" />
        Restablecer contraseña
      </button>

      <Dialog open={abierto} onOpenChange={(v) => !procesando && (v ? setAbierto(true) : cerrarYLimpiar())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>{correo}</DialogDescription>
          </DialogHeader>

          <label className="group/field flex items-start gap-2.5">
            <Checkbox
              checked={establecerFija}
              onCheckedChange={(v) => setEstablecerFija(v === true)}
              disabled={procesando}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground">
              Establecer contraseña ahora mismo, en vez de enviar un enlace por correo -- se la vas a decir vos, en persona, nunca por escrito.
            </span>
          </label>

          {establecerFija && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">Contraseña</Label>
              <PasswordInput
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                disabled={procesando}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarYLimpiar} disabled={procesando}>
              Cancelar
            </Button>
            <Button type="button" className="gap-1.5" disabled={procesando} onClick={establecerFija ? manejarEstablecerFija : manejarEnviarLink}>
              {procesando && <Spinner className="h-3.5 w-3.5" />}
              {establecerFija
                ? (establecerTemporal.isPending ? 'Asignando...' : 'Asignar contraseña')
                : (enviandoLink ? 'Enviando...' : 'Enviar enlace')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
