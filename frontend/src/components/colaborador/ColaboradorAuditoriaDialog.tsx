import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuditoriaColaborador } from '@/hooks/useColaborador';
import type { ColaboradorListado } from '@/types/colaborador.types';

interface Props {
  colaborador: ColaboradorListado | null;
  onOpenChange: (open: boolean) => void;
}

/** KAN-405: "el líder debe poder ver, de cada Colaborador, qué personas
 * cargó/modificó -- no solo que existió". */
export function ColaboradorAuditoriaDialog({ colaborador, onOpenChange }: Props) {
  const { data: items = [], isLoading } = useAuditoriaColaborador(colaborador?.id);

  return (
    <Dialog open={!!colaborador} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auditoría -- {colaborador?.persona_nombre}</DialogTitle>
          <DialogDescription>Personas que registró o modificó con el código {colaborador?.codigo}.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No cargó ni modificó ninguna persona.
          </p>
        ) : (
          <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
            {items.map((it) => (
              <div key={it.persona_id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3.5 py-2.5 text-sm">
                <span className="truncate font-medium">{it.nombre_completo}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{it.accion === 'ALTA' ? 'Alta' : 'Modificación'}</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(it.fecha_creacion).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
