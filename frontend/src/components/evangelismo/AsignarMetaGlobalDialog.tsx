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
import { AMBAR } from '@/components/dashboard/DashboardUI';
import { aISO } from '@/utils/calendario-fechas';
import type { MetaGlobalRed } from '@/types/evangelismo.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redNombre: string;
  metaActual: MetaGlobalRed | null;
  asignando: boolean;
  onAsignar: (params: { meta: number; fechaInicio: string; fechaFin: string }) => Promise<void>;
}

function rangoMesActual() {
  const hoy = new Date();
  const desde = aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = aISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
  return { desde, hasta };
}

/**
 * Meta Global de la Red: un único objetivo para toda la red, distinto de las
 * metas por CdP individual (AsignarMetaRedDialog). Mismo patrón de rango de
 * fechas -- "modificar" es asignar un rango nuevo, ya que
 * excl_meta_asignada_red_solapada no permite dos vigentes al mismo tiempo.
 */
export function AsignarMetaGlobalDialog({ open, onOpenChange, redNombre, metaActual, asignando, onAsignar }: Props) {
  const [meta, setMeta] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    if (!open) return;
    const { desde, hasta } = rangoMesActual();
    setMeta(metaActual ? String(metaActual.meta) : '');
    setFechaInicio(metaActual?.fecha_inicio ?? desde);
    setFechaFin(metaActual?.fecha_fin ?? hasta);
  }, [open, metaActual]);

  const metaNumero = Number(meta);
  const puedeGuardar = meta.trim() !== '' && metaNumero > 0 && !!fechaInicio && !!fechaFin && fechaFin >= fechaInicio;

  async function handleGuardar() {
    if (!puedeGuardar) return;
    try {
      await onAsignar({ meta: metaNumero, fechaInicio, fechaFin });
      toast.success('Meta Global actualizada');
      onOpenChange(false);
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('excl_meta_asignada_red_solapada') || mensaje.includes('exclusion')) {
        toast.error('Ya hay una Meta Global para un rango que se solapa con este');
      } else {
        toast.error('No se pudo guardar la Meta Global');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Meta Global de la Red</DialogTitle>
          <SeccionIconHeader icon={Flag} color={AMBAR} titulo="Meta Global de la Red" descripcion={redNombre} />
          <DialogDescription className="pt-1">
            Objetivo total de evangelismo de toda la red, independiente de las metas por Casa de Paz.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta_global_valor" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Meta (cantidad de evangelizados)
            </Label>
            <Input
              id="meta_global_valor"
              type="number"
              min={1}
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Ej. 50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meta_global_desde" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Desde</Label>
              <Input id="meta_global_desde" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meta_global_hasta" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Hasta</Label>
              <Input id="meta_global_hasta" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={asignando || !puedeGuardar} className="gap-1.5">
            {asignando && <Spinner className="h-3.5 w-3.5" />}
            {asignando ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
