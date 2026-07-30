import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActualizarReunionCdp } from '@/hooks/useCasasDePaz';

/** 0=domingo … 6=sábado (getDay() de JS, espejo del CHECK en la BD). */
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

const SIN_DIA = 'SIN_DIA';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cdpId: string;
  diaReunion: number | null;
  horaReunion: string | null;
}

export function EditarReunionCdpDialog({ open, onOpenChange, cdpId, diaReunion, horaReunion }: Props) {
  const [dia, setDia] = useState<string>(SIN_DIA);
  const [hora, setHora] = useState('');
  const actualizar = useActualizarReunionCdp();

  useEffect(() => {
    if (!open) return;
    setDia(diaReunion === null ? SIN_DIA : String(diaReunion));
    // La BD guarda 'HH:MM:SS'; el input type=time usa 'HH:MM'.
    setHora(horaReunion ? horaReunion.slice(0, 5) : '');
  }, [open, diaReunion, horaReunion]);

  function handleGuardar() {
    actualizar.mutate(
      {
        cdpId,
        diaReunion: dia === SIN_DIA ? null : Number(dia),
        horaReunion: hora ? hora : null,
      },
      {
        onSuccess: () => {
          toast.success('Horario de reunión guardado');
          onOpenChange(false);
        },
        onError: () => toast.error('No se pudo guardar el horario'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Día y hora de reunión</DialogTitle>
          <DialogDescription>Cuándo se reúne semanalmente esta Casa de Paz.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reunion_dia">Día de la semana</Label>
            <Select value={dia} onValueChange={setDia}>
              <SelectTrigger id="reunion_dia" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_DIA}>Sin definir</SelectItem>
                {DIAS_SEMANA.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reunion_hora">Hora</Label>
            <Input id="reunion_hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={actualizar.isPending}>
            {actualizar.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
