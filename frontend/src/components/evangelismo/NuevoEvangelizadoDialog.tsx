import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { useTiposEvangelismo } from '@/hooks/useEvangelismo';
import { SelectorTipoEvangelismo } from './SelectorTipoEvangelismo';

const esquema = z.object({
  tipo_evangelismo_id: z.string().min(1, 'Elegí con qué tipo de evangelismo se lo ganó'),
  primer_nombre: z.string().trim().min(1),
  primer_apellido: z.string().trim().min(1),
  sexo: z.enum(['M', 'F']),
  fecha: z.string().min(1),
  domicilio: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
});

type FormValues = z.infer<typeof esquema>;

const FORM_VACIO = { primer_nombre: '', primer_apellido: '', domicilio: '', telefono: '', tipo_evangelismo_id: '' };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string | undefined;
  fechaInicial: string;
  onCrear: (valores: FormValues) => Promise<void>;
}

/**
 * El formulario queda abierto después de registrar a alguien -- solo se
 * limpia -- para poder cargar a varias personas de una misma salida sin
 * tener que reabrir el diálogo cada vez. "Cerrar" es una acción aparte.
 */
export function NuevoEvangelizadoDialog({ open, onOpenChange, iglesiaId, fechaInicial, onCrear }: Props) {
  const { data: tipos = [] } = useTiposEvangelismo(iglesiaId);
  const [registrados, setRegistrados] = useState(0);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { fecha: fechaInicial, ...FORM_VACIO },
  });

  const sexoActual = watch('sexo');
  const tipoActual = watch('tipo_evangelismo_id');

  async function onSubmit(valores: FormValues) {
    try {
      await onCrear(valores);
      toast.success('Evangelizado registrado');
      setRegistrados((n) => n + 1);
      // Se conserva la fecha y el tipo elegidos: lo más común es cargar a
      // varias personas de la misma salida y el mismo tipo de evangelismo.
      reset({ ...FORM_VACIO, fecha: valores.fecha, tipo_evangelismo_id: valores.tipo_evangelismo_id });
    } catch {
      toast.error('No se pudo registrar');
    }
  }

  function manejarCerrar() {
    setRegistrados(0);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : manejarCerrar())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuevo evangelizado
            {registrados > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-chart-2/10 px-2 py-0.5 text-xs font-semibold text-chart-2">
                <Check className="h-3 w-3" />
                {registrados} registrado{registrados === 1 ? '' : 's'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de evangelismo *</Label>
            <SelectorTipoEvangelismo
              tipos={tipos}
              valor={tipoActual}
              onSeleccionar={(t) => setValue('tipo_evangelismo_id', t.id, { shouldValidate: true })}
            />
            {errors.tipo_evangelismo_id && <p className="text-sm text-destructive">{errors.tipo_evangelismo_id.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primer_nombre">Nombre *</Label>
              <Input id="primer_nombre" {...register('primer_nombre')} />
              {errors.primer_nombre && <p className="text-sm text-destructive">Requerido</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primer_apellido">Apellido *</Label>
              <Input id="primer_apellido" {...register('primer_apellido')} />
              {errors.primer_apellido && <p className="text-sm text-destructive">Requerido</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Sexo *</Label>
            <Select value={sexoActual ?? ''} onValueChange={(v) => setValue('sexo', v as 'M' | 'F', { shouldValidate: true })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Femenino</SelectItem>
              </SelectContent>
            </Select>
            {errors.sexo && <p className="text-sm text-destructive">Requerido</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" {...register('fecha')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="domicilio">Domicilio</Label>
              <Input id="domicilio" {...register('domicilio')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" type="tel" placeholder="Opcional" {...register('telefono')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={manejarCerrar}>
              Cerrar
            </Button>
            <Button type="submit" className="gap-1.5" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="h-3.5 w-3.5" />}
              {isSubmitting ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
