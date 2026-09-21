import { Check, UserSearch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { AMBAR } from '@/components/dashboard/DashboardUI';
import type { PersonaSimilar } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidatos: PersonaSimilar[];
  /** El nombre que se estaba por cargar, para el mensaje ("¿Te referís a
   * uno de estos en vez de crear a X?"). */
  nombreTentativo: string;
  /** "Sí" -- usa/vincula el registro existente en vez de crear uno nuevo. */
  onUsarExistente: (persona: PersonaSimilar) => void;
  /** "No" -- son personas distintas, sigue el alta normal tal cual. */
  onNoEsLaMisma: () => void;
}

/**
 * KAN-407: modal "¿Te referís a...?" -- aparece al confirmar el alta de una
 * "persona nueva" (Evangelismo, Casas de Paz) cuando `fn_buscar_personas_similares`
 * (pg_trgm) encuentra a alguien con un nombre muy parecido ya cargado en la
 * misma iglesia. Pensado para errores de tipeo, no coincidencias exactas --
 * esas ya las cubre el buscador normal antes de llegar a este mini-formulario.
 */
export function ConfirmarPosibleDuplicadoDialog({
  open,
  onOpenChange,
  candidatos,
  nombreTentativo,
  onUsarExistente,
  onNoEsLaMisma,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Posible persona duplicada</DialogTitle>
          <SeccionIconHeader icon={UserSearch} color={AMBAR} titulo="¿Ya está en el sistema?" />
          <DialogDescription className="pt-1">
            Antes de crear a <span className="font-medium text-foreground">{nombreTentativo}</span> como persona
            nueva, encontramos {candidatos.length === 1 ? 'a alguien' : 'a estas personas'} con un nombre parecido
            en la iglesia -- puede ser un error de tipeo de la misma persona.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {candidatos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onUsarExistente(c)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-chart-2" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.nombre_completo}</span>
              {c.casa_de_paz_nombre && (
                <span className="shrink-0 text-xs text-muted-foreground">de {c.casa_de_paz_nombre}</span>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="gap-1.5" onClick={onNoEsLaMisma}>
            <X className="h-3.5 w-3.5" />
            No, es una persona distinta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
