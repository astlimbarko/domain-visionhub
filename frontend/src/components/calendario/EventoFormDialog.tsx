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
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { iconoTipoEvento } from '@/utils/tipo-evento-icono';
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
  })
  .refine(
    (v) => {
      // Un evento de un solo día no puede terminar antes de empezar. Un evento de
      // varios días sí puede (un retiro puede arrancar el viernes 18:00 y cerrar
      // el domingo 12:00) — por eso esto solo aplica cuando fecha_fin == fecha_inicio.
      const esUnSoloDia = !v.fecha_fin || v.fecha_fin === v.fecha_inicio;
      if (!esUnSoloDia || !v.hora_inicio || !v.hora_fin) return true;
      return v.hora_fin >= v.hora_inicio;
    },
    { message: 'En un evento de un solo día, la hora de fin no puede ser anterior a la de inicio', path: ['hora_fin'] }
  );

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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tipos.map((t) => {
                const Icono = iconoTipoEvento(t.codigo);
                const activo = tipoActual === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setValue('tipo_evento_id', t.id, { shouldValidate: true })}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all active:scale-[0.97]',
                      activo ? 'border-transparent shadow-sm ring-2 ring-offset-1' : 'border-border/70 bg-background hover:border-border'
                    )}
                    style={
                      activo
                        ? ({ backgroundColor: `color-mix(in oklab, ${t.color} 12%, transparent)`, '--tw-ring-color': t.color } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${t.color} ${activo ? 24 : 14}%, transparent)` }}
                    >
                      <Icono className="h-4.5 w-4.5" style={{ color: t.color }} />
                    </span>
                    <span className={cn('text-[11.5px] leading-tight font-semibold', activo ? 'text-foreground' : 'text-muted-foreground')}>
                      {t.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.tipo_evento_id && <p className="text-sm text-destructive">Elegí un tipo de evento</p>}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Button type="submit" className="gap-1.5" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="h-3.5 w-3.5" />}
              {isSubmitting ? 'Guardando...' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
