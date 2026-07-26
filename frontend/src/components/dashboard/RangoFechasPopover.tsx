import { useState } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface RangoFechas {
  desde: string;
  hasta: string;
}

interface Props {
  value: RangoFechas | null;
  onChange: (rango: RangoFechas | null) => void;
}

function fmtCorto(fechaISO: string) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

/**
 * Filtro de rango de fechas totalmente opcional para los headers de
 * dashboard: por defecto no hay rango (value=null) y los paneles usan su
 * período/cantidad habitual. Elegir un rango acá lo reemplaza.
 */
export function RangoFechasPopover({ value, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(value?.desde ?? '');
  const [hasta, setHasta] = useState(value?.hasta ?? '');

  function abrir(open: boolean) {
    if (open) {
      setDesde(value?.desde ?? '');
      setHasta(value?.hasta ?? '');
    }
    setAbierto(open);
  }

  function aplicar() {
    if (!desde || !hasta) return;
    onChange(desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde });
    setAbierto(false);
  }

  function limpiar() {
    onChange(null);
    setDesde('');
    setHasta('');
    setAbierto(false);
  }

  return (
    <Popover open={abierto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 rounded-xl border-border/60 bg-muted/40 text-sm font-normal ${value ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {value ? `${fmtCorto(value.desde)} – ${fmtCorto(value.hasta)}` : 'Rango personalizado'}
          {value && (
            <span
              role="button"
              aria-label="Quitar rango"
              onClick={(e) => {
                e.stopPropagation();
                limpiar();
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Rango de fechas personalizado</p>
            <p className="text-[11px] text-muted-foreground">Opcional — reemplaza el período elegido arriba.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rango_desde" className="text-xs">Desde</Label>
              <Input id="rango_desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rango_hasta" className="text-xs">Hasta</Label>
              <Input id="rango_hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
              Limpiar
            </Button>
            <Button type="button" size="sm" disabled={!desde || !hasta} onClick={aplicar}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
