import { Star, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import type { ParticipanteMinisterio } from '@/types/ministerios.types';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministerioNombre: string;
  iglesiaId: string | undefined;
  participantes: ParticipanteMinisterio[];
  cargando: boolean;
  agregando: boolean;
  onAgregar: (persona: PersonaBusqueda) => void;
  onQuitar: (participanteId: string) => void;
  onHacerLider: (participanteId: string) => void;
}

export function DetalleMinisterioDialog({
  open,
  onOpenChange,
  ministerioNombre,
  iglesiaId,
  participantes,
  cargando,
  agregando,
  onAgregar,
  onQuitar,
  onHacerLider,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ministerioNombre}</DialogTitle>
          <DialogDescription>Puede haber varias personas; como máximo una es líder vigente.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {cargando ? (
            <Skeleton className="h-8 w-full" />
          ) : participantes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {participantes.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                  <div>
                    <p className="flex items-center gap-1.5">
                      {p.es_lider && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                      {p.nombre_completo}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.red_nombre}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!p.es_lider && (
                      <Button variant="ghost" size="sm" onClick={() => onHacerLider(p.id)}>
                        Hacer líder
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onQuitar(p.id)} aria-label="Quitar">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nadie asignado todavía.</p>
          )}

          <BuscadorPersona
            iglesiaId={iglesiaId}
            excluirIds={participantes.map((p) => p.persona_id)}
            onSeleccionar={onAgregar}
          />
          {agregando && <p className="text-sm text-muted-foreground">Agregando...</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
