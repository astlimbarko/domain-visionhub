/**
 * KAN-387 (pedido explícito del owner): "con un clic, Pastor de la iglesia
 * madre o Super Admin marcan una satélite como Hija. Reversible desde la
 * UI." El toggle de `iglesia.tipo` sí funciona de verdad -- lo que a
 * propósito NO hace es resolver cargos/roles compartidos entre esta iglesia
 * y su par (ej. la misma persona como Supervisor en las dos a la vez); eso
 * es una pieza de diseño aparte, todavía sin especificar. El diálogo lo
 * avisa explícitamente.
 *
 * Mismo nivel de seriedad visual que el diálogo de "Anular reporte"
 * (Reportes.tsx, KAN-367) -- caja de advertencia destacada con AlertTriangle
 * -- pero sin la cuenta regresiva de segundos, porque acá la acción es
 * reversible desde la misma UI.
 */
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaNombre: string;
  /** true = SATELITE -> HIJA (graduar); false = HIJA -> SATELITE (revertir). */
  graduar: boolean;
  procesando: boolean;
  /** Tema oscuro (Administración de Super Admin usa fondo oscuro). */
  oscuro?: boolean;
  onConfirmar: () => void;
}

export function GraduarIglesiaDialog({
  open,
  onOpenChange,
  iglesiaNombre,
  graduar,
  procesando,
  oscuro,
  onConfirmar,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !procesando && onOpenChange(v)}>
      <DialogContent className={cn('sm:max-w-sm', oscuro && 'dark')} showCloseButton={false}>
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-destructive">
              {graduar ? `Graduar ${iglesiaNombre} a Hija` : `Volver ${iglesiaNombre} a Satélite`}
            </p>
            <p className="text-sm text-muted-foreground">
              {graduar
                ? 'Pasa de fase de transición a iglesia 100% autónoma, sin compartir nada con la madre. Es reversible desde acá mismo cuando quieras.'
                : 'Vuelve a fase de transición como iglesia satélite, pudiendo compartir personas/cargos puntualmente con la madre. Es reversible desde acá mismo cuando quieras.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Esto no resuelve los cargos o roles que esta iglesia comparte con su par -- si hay
              personas con cargo en las dos, van a quedar así después de {graduar ? 'graduar' : 'revertir'}.
              Revisalos a mano.
            </p>
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="button" disabled={procesando} onClick={onConfirmar}>
            {procesando && <Spinner className="h-4 w-4" />}
            {graduar ? 'Sí, graduar a Hija' : 'Sí, volver a Satélite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
