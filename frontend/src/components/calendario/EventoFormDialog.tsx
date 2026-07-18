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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TipoEvento } from '@/types/calendario.types';

const esquema = z
  .object({
    tipo_evento_id: z.string().min(1),
    titulo: z.string().trim().min(1),
    descripcion: z.string().trim().optional(),
    fecha_inicio: z.string().min(1),
    fecha_fin: z.string().optional(),
    hora_inicio: z.string().optional(),
    hora_fin: z.string().optional(),
  })
  .refine((v) => !v.fecha_fin || v.fecha_fin >= v.fecha_inicio, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fecha_fin'],
  });

type FormValues = z.infer<typeof esquema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipos: TipoEvento[];
  fechaInicial: string;
  onCrear: (valores: FormValues) => Promise<void>;
}

export function EventoFormDialog({ open, onOpenChange, tipos, fechaInicial, onCrear }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { fecha_inicio: fechaInicial },
  });

  const tipoActual = watch('tipo_evento_id');

  async function onSubmit(valores: FormValues) {
    try {
      await onCrear(valores);
      toast.success('Evento creado');
      reset({ fecha_inicio: fechaInicial });
      onOpenChange(false);
    } catch (e) {
      const error = e as { code?: string; message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (error?.code === '42501' || mensaje.includes('row-level security') || mensaje.includes('permission denied')) {
        toast.error('No tenés permiso para crear este tipo de evento aquí');
      } else {
        toast.error('No se pudo crear el evento');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de evento *</Label>
            <Select value={tipoActual ?? ''} onValueChange={(v) => setValue('tipo_evento_id', v, { shouldValidate: true })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipo_evento_id && <p className="text-sm text-destructive">Requerido</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" {...register('titulo')} />
            {errors.titulo && <p className="text-sm text-destructive">Requerido</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" {...register('descripcion')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fecha_inicio">Fecha inicio *</Label>
              <Input id="fecha_inicio" type="date" {...register('fecha_inicio')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fecha_fin">Fecha fin</Label>
              <Input id="fecha_fin" type="date" {...register('fecha_fin')} />
              {errors.fecha_fin && <p className="text-sm text-destructive">{errors.fecha_fin.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hora_inicio">Hora inicio</Label>
              <Input id="hora_inicio" type="time" {...register('hora_inicio')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hora_fin">Hora fin</Label>
              <Input id="hora_fin" type="time" {...register('hora_fin')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
