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
}

/**
 * Confirmación liviana de dos pasos para acciones destructivas simples (ej.
 * quitar a alguien de un cargo, eliminar un evento): el click que dispara la
 * acción solo abre este diálogo, y hace falta un segundo click en
 * "Confirmar" para que se ejecute. A diferencia de ConfirmarCambioDialog, no
 * pide motivo ni PIN.
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
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" className="gap-1.5" onClick={onConfirmar} disabled={procesando}>
            {procesando && <Spinner className="h-3.5 w-3.5" />}
            {procesando ? textoProcesando : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
