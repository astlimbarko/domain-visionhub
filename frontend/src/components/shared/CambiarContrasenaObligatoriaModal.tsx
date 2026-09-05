import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { confirmarCambioContrasena, establecerContrasena, mensajeErrorContrasena } from '@/services/auth.service';

interface Props {
  onGuardado: () => void;
  onSaltar: () => void;
}

/**
 * KAN-278: aparece cuando la cuenta tiene una contraseña temporal puesta por
 * un admin (`establecer-contrasena-temporal`, app_metadata.debe_cambiar_
 * contrasena). "Ahora no" solo la pospone para esta vez (mismo patrón que
 * ActualizacionMembresiaModal) -- vuelve a aparecer en la próxima carga
 * mientras la persona no ponga una contraseña propia de verdad.
 */
export function CambiarContrasenaObligatoriaModal({ onGuardado, onSaltar }: Props) {
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (contrasena.length < 8) { toast.error('Mínimo 8 caracteres'); return; }
    if (contrasena !== confirmar) { toast.error('No coinciden'); return; }
    setEnviando(true);
    try {
      await establecerContrasena(contrasena);
      await confirmarCambioContrasena();
      toast.success('Contraseña actualizada');
      onGuardado();
    } catch (e) {
      toast.error(mensajeErrorContrasena(e, 'No se pudo guardar'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Cambiá tu contraseña</DialogTitle>
          <DialogDescription>Estás usando una contraseña temporal. Elegí una propia para seguir.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Contraseña nueva</Label>
            <PasswordInput
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              disabled={enviando}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Confirmar</Label>
            <PasswordInput value={confirmar} onChange={(e) => setConfirmar(e.target.value)} disabled={enviando} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onSaltar} disabled={enviando}>
            Ahora no
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={enviando} className="min-w-32">
            {enviando ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
