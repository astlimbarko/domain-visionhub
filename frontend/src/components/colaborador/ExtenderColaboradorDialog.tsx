import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { useExtenderColaboradorSesion } from '@/hooks/useColaborador';
import type { ColaboradorListado } from '@/types/colaborador.types';

const OPCIONES = [
  { valor: '30', label: '30 minutos' },
  { valor: '60', label: '1 hora' },
  { valor: '360', label: '6 horas' },
  { valor: '1440', label: '1 día' },
];

interface Props {
  colaborador: ColaboradorListado | null;
  iglesiaId: string | undefined;
  departamentoCodigo: string;
  onOpenChange: (open: boolean) => void;
}

export function ExtenderColaboradorDialog({ colaborador, iglesiaId, departamentoCodigo, onOpenChange }: Props) {
  const [minutos, setMinutos] = useState('60');
  const extender = useExtenderColaboradorSesion(iglesiaId, departamentoCodigo);

  function confirmar() {
    if (!colaborador) return;
    extender.mutate(
      { sesionId: colaborador.id, minutos: Number(minutos) },
      {
        onSuccess: () => {
          toast.success('Tiempo extendido.');
          onOpenChange(false);
        },
        onError: () => toast.error('No se pudo extender el tiempo.'),
      }
    );
  }

  return (
    <Dialog open={!!colaborador} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Extender tiempo</DialogTitle>
          <DialogDescription>{colaborador?.persona_nombre}</DialogDescription>
        </DialogHeader>
        <Select value={minutos} onValueChange={setMinutos}>
          <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={confirmar} disabled={extender.isPending}>
            {extender.isPending ? 'Extendiendo...' : 'Extender'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
