import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CampoOtp } from '@/components/shared/CampoOtp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion?: string;
  procesando?: boolean;
  onConfirmar: () => void;
  /** Texto del botón de confirmación en reposo, ej. "Sí, eliminar". Por defecto "Sí, quitar". */
  textoConfirmar?: string;
  /** Texto del botón de confirmación mientras se procesa, ej. "Eliminando...". Por defecto "Quitando...". */
  textoProcesando?: string;
  /** OTP opcional (2026-08-06, Estructura Organizacional): cuando se pasan
   * estas 3 props juntas, el diálogo muestra el campo y bloquea "Confirmar"
   * hasta que el código tenga 6 dígitos. Opcional -- no afecta a quien no
   * las pasa (Calendario, Casas de Paz). El criterio de cuándo exigirlo lo
   * decide quien usa el diálogo, no este componente. */
  otpRequerido?: boolean;
  otp?: string;
  onOtpChange?: (valor: string) => void;
}

/**
 * Confirmación liviana de dos pasos para acciones destructivas simples (ej.
 * quitar a alguien de un cargo, eliminar un evento): el click que dispara la
 * acción solo abre este diálogo, y hace falta un segundo click en
 * "Confirmar" para que se ejecute. A diferencia de ConfirmarCambioDialog, no
 * pide motivo ni ata el OTP a si el actor es Super Admin.
 */
export function ConfirmarQuitarDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  procesando,
  onConfirmar,
  textoConfirmar = 'Sí, quitar',
  textoProcesando = 'Quitando...',
  otpRequerido,
  otp,
  onOtpChange,
}: Props) {
  const pideOtp = otpRequerido && onOtpChange !== undefined;
  const otpValido = !pideOtp || /^\d{6}$/.test(otp ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        {pideOtp && onOtpChange && <CampoOtp value={otp ?? ''} onChange={onOtpChange} />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" className="gap-1.5" onClick={onConfirmar} disabled={procesando || !otpValido}>
            {procesando && <Spinner className="h-3.5 w-3.5" />}
            {procesando ? textoProcesando : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
