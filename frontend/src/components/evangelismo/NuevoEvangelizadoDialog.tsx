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

const esquema = z.object({
  primer_nombre: z.string().trim().min(1),
  primer_apellido: z.string().trim().min(1),
  sexo: z.enum(['M', 'F']),
  fecha: z.string().min(1),
  domicilio: z.string().trim().optional(),
});

type FormValues = z.infer<typeof esquema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fechaInicial: string;
  onCrear: (valores: FormValues) => Promise<void>;
}

export function NuevoEvangelizadoDialog({ open, onOpenChange, fechaInicial, onCrear }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { fecha: fechaInicial },
  });

  const sexoActual = watch('sexo');

  async function onSubmit(valores: FormValues) {
    try {
      await onCrear(valores);
      toast.success('Evangelizado registrado');
      reset({ fecha: fechaInicial });
      onOpenChange(false);
    } catch {
      toast.error('No se pudo registrar');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo evangelizado</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domicilio">Domicilio</Label>
            <Input id="domicilio" {...register('domicilio')} />
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
