import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BuscadorPersona } from './BuscadorPersona';
import type { CargoVigente, PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  exclusivo: boolean;
  iglesiaId: string | undefined;
  vigentes: CargoVigente[];
  cargandoVigentes: boolean;
  asignando: boolean;
  onAsignar: (persona: PersonaBusqueda) => void;
  onQuitar: (cargoAsignacionId: string) => void;
}

export function AsignarCargoDialog({
  open,
  onOpenChange,
  titulo,
  exclusivo,
  iglesiaId,
  vigentes,
  cargandoVigentes,
  asignando,
  onAsignar,
  onQuitar,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {exclusivo
              ? 'Asignar una persona nueva reemplaza automáticamente a la actual.'
              : 'Se puede asignar a varias personas a la vez.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {cargandoVigentes ? (
            <Skeleton className="h-8 w-full" />
          ) : vigentes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {vigentes.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                  {v.nombre_completo}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onQuitar(v.id)} aria-label="Quitar">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nadie asignado todavía.</p>
          )}

          <BuscadorPersona
            iglesiaId={iglesiaId}
            excluirIds={vigentes.map((v) => v.persona_id)}
            onSeleccionar={onAsignar}
          />
          {asignando && <p className="text-sm text-muted-foreground">Asignando...</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
