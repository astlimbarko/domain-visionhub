import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import type { MonedaActiva } from '@/types/panel-supervisor.types';
import type { TipoIngreso } from '@/types/finanzas.types';

const esquema = z.object({
  tipo_ingreso_id: z.string().min(1),
  moneda_id: z.string().min(1),
  monto: z.string().min(1),
  fecha: z.string().min(1),
});

type FormValues = z.infer<typeof esquema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipos: TipoIngreso[];
  monedas: MonedaActiva[];
  fechaInicial: string;
  onCrear: (valores: { tipo_ingreso_id: string; moneda_id: string; monto: number; fecha: string }) => Promise<void>;
}

export function NuevoIngresoDialog({ open, onOpenChange, tipos, monedas, fechaInicial, onCrear }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { fecha: fechaInicial, moneda_id: monedas[0]?.moneda_id },
  });

  const tipoActual = watch('tipo_ingreso_id');
  const monedaActual = watch('moneda_id');

  async function onSubmit(valores: FormValues) {
    try {
      await onCrear({
        tipo_ingreso_id: valores.tipo_ingreso_id,
        moneda_id: valores.moneda_id,
        monto: Number(valores.monto),
        fecha: valores.fecha,
      });
      toast.success('Ingreso registrado');
      reset({ fecha: fechaInicial, moneda_id: monedas[0]?.moneda_id });
      onOpenChange(false);
    } catch {
      toast.error('No se pudo registrar el ingreso');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo ingreso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo *</Label>
            <Select value={tipoActual ?? ''} onValueChange={(v) => setValue('tipo_ingreso_id', v, { shouldValidate: true })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipo_ingreso_id && <p className="text-sm text-destructive">Requerido</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="monto">Monto *</Label>
              <Input id="monto" type="number" step="0.01" min="0.01" {...register('monto')} />
              {errors.monto && <p className="text-sm text-destructive">Requerido</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Moneda *</Label>
              <Select value={monedaActual ?? ''} onValueChange={(v) => setValue('moneda_id', v, { shouldValidate: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {monedas.map((m) => (
                    <SelectItem key={m.moneda_id} value={m.moneda_id}>
                      {m.simbolo} {m.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" {...register('fecha')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
