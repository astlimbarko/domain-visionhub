import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useEliminarProcesoAfirmacion } from '@/hooks/useAfirmacion';
import type { ProcesoAfirmacionCodigo } from '@/services/afirmacion.service';

/**
 * Botón "eliminar" (ícono papelera) + modal de confirmación para quitar un
 * registro de la pestaña "Registro" de un proceso de Afirmación. Pedido del
 * owner (2026-10-03): sirve para que los propios colaboradores borren posibles
 * duplicados -- es su responsabilidad. Hace soft-delete del registro del
 * proceso (no borra la persona). Se usa en una fila/tarjeta clickeable que abre
 * la ficha, así que corta la propagación para no abrir la ficha al borrar.
 */
export function EliminarRegistroProceso({
  registroId,
  nombre,
  procesoCodigo,
}: {
  registroId: string;
  nombre: string;
  procesoCodigo: ProcesoAfirmacionCodigo;
}) {
  const [abierto, setAbierto] = useState(false);
  const eliminar = useEliminarProcesoAfirmacion();

  function confirmar(e: React.MouseEvent) {
    e.stopPropagation();
    eliminar.mutate(
      { registroId, procesoCodigo },
      {
        onSuccess: () => {
          toast.success('Registro eliminado.');
          setAbierto(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el registro'),
      },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Eliminar registro"
        title="Eliminar registro"
        onClick={(e) => {
          e.stopPropagation();
          setAbierto(true);
        }}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>¿Eliminar este registro?</DialogTitle>
            <DialogDescription>
              Se quitará el registro de <span className="font-medium text-foreground">{nombre}</span> de esta lista. Usalo
              para borrar duplicados. No elimina a la persona, solo este registro. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={(e) => e.stopPropagation()} disabled={eliminar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmar} disabled={eliminar.isPending} className="gap-1.5">
              {eliminar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
