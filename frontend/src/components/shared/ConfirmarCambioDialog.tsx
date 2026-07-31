import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion?: string;
  procesando: boolean;
  /** Cuando es false, no pide un motivo escrito -- solo el PIN si corresponde. */
  requiereMotivo?: boolean;
  /** Pedir siempre el código OTP, sin importar si quien confirma es Super
   * Admin (2026-08-01, Gestión de Redes: "esto es delicado" para el
   * Supervisor, no solo para Super Admin). */
  siempreOtp?: boolean;
  onConfirmar: (motivo: string, pin?: string) => void;
}

/** Todo cambio de fusion o de configuracion pide un motivo escrito; si quien
 * lo hace es Super Admin (o si `siempreOtp`), ademas pide un codigo de
 * confirmacion por correo (OTP, 15-gestion-administrativa Panel 1 --
 * reemplaza al PIN estatico). */
export function ConfirmarCambioDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  procesando,
  requiereMotivo = true,
  siempreOtp = false,
  onConfirmar,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const pideOtp = esSuperAdmin || siempreOtp;
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const pinValido = !pideOtp || /^[0-9]{6}$/.test(pin);
  const puedeConfirmar = (!requiereMotivo || motivo.trim().length > 0) && pinValido;

  function handleConfirmar() {
    if (!puedeConfirmar) return;
    onConfirmar(motivo.trim(), pideOtp ? pin : undefined);
    setMotivo('');
    setPin('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {requiereMotivo && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo_cambio">Motivo (obligatorio)</Label>
              <Textarea
                id="motivo_cambio"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por qué se hace este cambio"
              />
            </div>
          )}
          {pideOtp && <CampoOtp value={pin} onChange={setPin} />}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleConfirmar} disabled={procesando || !puedeConfirmar}>
            {procesando ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
