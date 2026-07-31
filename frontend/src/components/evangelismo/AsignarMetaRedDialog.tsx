import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Flag } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { VERDE } from '@/components/dashboard/DashboardUI';
import { aISO } from '@/utils/calendario-fechas';
import type { MetaCdpRed } from '@/types/evangelismo.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cdp: MetaCdpRed | null;
  asignando: boolean;
  onAsignar: (params: { meta: number; fechaInicio: string; fechaFin: string }) => Promise<void>;
}

/** Rango por defecto: el mes en curso -- el líder puede ampliarlo a mano. */
function rangoMesActual() {
  const hoy = new Date();
  const desde = aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = aISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
  return { desde, hasta };
}

export function AsignarMetaRedDialog({ open, onOpenChange, cdp, asignando, onAsignar }: Props) {
  const [meta, setMeta] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    if (!open) return;
    const { desde, hasta } = rangoMesActual();
    setMeta(cdp?.origen === 'ASIGNADA' && cdp.meta != null ? String(cdp.meta) : '');
    setFechaInicio(desde);
    setFechaFin(hasta);
  }, [open, cdp]);

  const metaNumero = Number(meta);
  const puedeGuardar = meta.trim() !== '' && metaNumero > 0 && !!fechaInicio && !!fechaFin && fechaFin >= fechaInicio;

  async function handleGuardar() {
    if (!puedeGuardar) return;
    try {
      await onAsignar({ meta: metaNumero, fechaInicio, fechaFin });
      toast.success(`Meta asignada a ${cdp?.etiqueta}`);
      onOpenChange(false);
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('excl_meta_asignada_solapada') || mensaje.includes('exclusion')) {
        toast.error('Ya hay una meta asignada para esa Casa de Paz en un rango que se solapa');
      } else {
        toast.error('No se pudo asignar la meta');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Asignar meta de evangelismo</DialogTitle>
          <SeccionIconHeader icon={Flag} color={VERDE} titulo="Asignar meta de evangelismo" descripcion={cdp?.etiqueta} />
          <DialogDescription className="pt-1">
            Mientras esté vigente, esta meta manda sobre la propia que haya fijado la Casa de Paz.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta_red_valor" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Meta (cantidad de evangelizados)
            </Label>
            <Input
              id="meta_red_valor"
              type="number"
              min={1}
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Ej. 10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meta_red_desde" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Desde</Label>
              <Input id="meta_red_desde" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meta_red_hasta" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Hasta</Label>
              <Input id="meta_red_hasta" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={asignando || !puedeGuardar} className="gap-1.5">
            {asignando && <Spinner className="h-3.5 w-3.5" />}
            {asignando ? 'Guardando...' : 'Asignar meta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
