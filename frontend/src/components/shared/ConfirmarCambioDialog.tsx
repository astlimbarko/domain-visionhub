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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion?: string;
  procesando: boolean;
  /** Cuando es false, no pide un motivo escrito -- solo el PIN si corresponde. */
  requiereMotivo?: boolean;
  onConfirmar: (motivo: string, pin?: string) => void;
}

/** Todo cambio de fusion o de configuracion pide un motivo escrito; si quien
 * lo hace es Super Admin, ademas pide su PIN de 6 digitos. */
export function ConfirmarCambioDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  procesando,
  requiereMotivo = true,
  onConfirmar,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const puedeConfirmar = (!requiereMotivo || motivo.trim().length > 0) && pinValido;

  function handleConfirmar() {
    if (!puedeConfirmar) return;
    onConfirmar(motivo.trim(), esSuperAdmin ? pin : undefined);
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
          {esSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin_cambio">Tu PIN de Super Admin</Label>
              <Input
                id="pin_cambio"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 dígitos"
              />
            </div>
          )}
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
